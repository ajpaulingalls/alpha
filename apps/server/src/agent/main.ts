import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  llm,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import path from "node:path";
import OpenAI from "openai";
import { findUserById, updateUserName } from "@alpha/data/crud/users";
import {
  createCortexLLM,
  FAST_MODEL,
  STANDARD_MODEL,
} from "./plugins/cortexLLM";
import {
  createSession,
  endSession,
  findPreviousSession,
  markCatchUpDelivered,
} from "@alpha/data/crud/sessions";
import {
  createPreferences,
  findPreferencesByUserId,
} from "@alpha/data/crud/preferences";
import {
  recordListen,
  updateCompletedPercent,
} from "@alpha/data/crud/listen-history";
import {
  findRecentEpisodes,
  findNewEpisodesForUser,
  findExistingEpisodeIds,
  findEpisodeById,
  findEpisodesByShow,
} from "@alpha/data/crud/episodes";
import {
  searchCachedResponses,
  createCachedResponse,
  incrementHitCount,
} from "@alpha/data/crud/cached-responses";
import {
  searchTopicsByEmbedding,
  findTopicsByEpisode,
} from "@alpha/data/crud/topics";
import { ContentClient } from "@alpha/content";
import { CortexClient } from "@alpha/cortex";
import { AGENT_NAME } from "./constants";
import { type AlphaSessionData, isNewUser } from "./types";
import {
  createNotifyClient,
  registerRemoteControls,
  type RemoteControls,
} from "./rpc";
import { SetupAgent, type SetupAgentDeps } from "./agents/SetupAgent";
import { CatchUpAgent, type CatchUpAgentDeps } from "./agents/CatchUpAgent";
import type { BrowseAgentDeps } from "./agents/BrowseAgent";
import { AudioRecorder } from "./generation/AudioRecorder";
import { StreamingGenerator } from "./generation/StreamingGenerator";
import { computeExpiry } from "./generation/ExpiryRules";
import { embedQuery } from "./tools/types";
import { createInactivityHandler } from "./inactivity";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData["vad"] = await silero.VAD.load();

    const contentGraphqlUrl = process.env["CONTENT_GRAPHQL_URL"];
    const cortexApiUrl = process.env["CORTEX_API_URL"];
    if (!contentGraphqlUrl || !cortexApiUrl) {
      throw new Error(
        "CONTENT_GRAPHQL_URL and CORTEX_API_URL environment variables are required",
      );
    }

    for (const [name, value] of [
      ["CONTENT_GRAPHQL_URL", contentGraphqlUrl],
      ["CORTEX_API_URL", cortexApiUrl],
    ] as const) {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error(`${name} must use http or https protocol`);
      }
      if (parsed.search || parsed.hash) {
        throw new Error(`${name} must not contain query strings or fragments`);
      }
    }

    proc.userData["contentClient"] = new ContentClient(contentGraphqlUrl);
    proc.userData["cortexClient"] = new CortexClient(cortexApiUrl);
    proc.userData["openai"] = new OpenAI();
    proc.userData["fastLLM"] = createCortexLLM(cortexApiUrl, FAST_MODEL);
    proc.userData["standardLLM"] = createCortexLLM(
      cortexApiUrl,
      STANDARD_MODEL,
    );
    proc.userData["audioRecorder"] = new AudioRecorder({
      openai: proc.userData["openai"] as OpenAI,
    });
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData["vad"] as silero.VAD;
    const contentClient = ctx.proc.userData["contentClient"] as ContentClient;
    const cortexClient = ctx.proc.userData["cortexClient"] as CortexClient;
    const audioRecorder = ctx.proc.userData["audioRecorder"] as AudioRecorder;
    const fastLLM = ctx.proc.userData["fastLLM"] as llm.LLM;
    const standardLLM = ctx.proc.userData["standardLLM"] as llm.LLM;

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    const userId = participant.identity;
    const notifyClient = createNotifyClient(ctx.room, userId);

    // Mutable remote control handlers — PlaybackAgent sets real callbacks on enter
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = () => {};
    const remoteControls: RemoteControls = {
      onTogglePlayback: noop,
      onSkipForward: noop,
    };
    registerRemoteControls(ctx.room, userId, remoteControls);

    const [user, dbSession] = await Promise.all([
      findUserById(userId),
      createSession(userId),
    ]);

    const isNew = isNewUser(user);

    const generator = new StreamingGenerator({
      cortexClient,
      audioRecorder,
      createCachedResponse,
      embedQuery: (query: string) => embedQuery(cortexClient, query),
      computeExpiry,
      audioDir: path.join(process.cwd(), "audio", "cache"),
    });

    // Mutable ref wired to session.shutdown() after session creation
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    let shutdownSession = () => {};
    let sessionEnded = false;

    const browseDeps: BrowseAgentDeps = {
      notifyClient,
      cortexClient,
      contentClient,
      searchCachedResponses,
      searchTopicsByEmbedding,
      generator,
      findEpisodesByShow,
      findEpisodeById,
      recordListen,
      incrementHitCount,
      findTopicsByEpisode,
      updateCompletedPercent,
      remoteControls,
      audioDir: path.join(process.cwd(), "audio", "topics"),
      endDbSession: async (sessionId: string, uid: string) => {
        if (sessionEnded) return;
        sessionEnded = true;
        await endSession(sessionId, uid);
      },
      shutdownSession: () => shutdownSession(),
    };

    const catchUpDeps: CatchUpAgentDeps = {
      notifyClient,
      findPreviousSession,
      findPreferencesByUserId,
      markCatchUpDelivered,
      recordListen,
      contentClient,
      cortexClient,
      findRecentEpisodes,
      findNewEpisodesForUser,
      findExistingEpisodeIds,
      browseDeps,
    };

    const userData: AlphaSessionData = {
      userId,
      userName: isNew ? undefined : user?.name,
      sessionId: dbSession.id,
    };

    const setupDeps: SetupAgentDeps = {
      notifyClient,
      updateUserName,
      createPreferences,
    };
    const agent = isNew
      ? SetupAgent.create(setupDeps, catchUpDeps, fastLLM)
      : CatchUpAgent.create(catchUpDeps);

    const session = new voice.AgentSession<AlphaSessionData>({
      vad,
      stt: "deepgram/nova-3:multi",
      llm: standardLLM,
      tts: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      userData,
      voiceOptions: { userAwayTimeout: 120 },
    });

    // Wire session shutdown to endSession tool
    shutdownSession = () =>
      session.shutdown({ drain: true, reason: "user-ended" });

    // End DB session on disconnect/shutdown (skips if tool already ended it)
    ctx.addShutdownCallback(async () => {
      if (sessionEnded) return;
      sessionEnded = true;
      await endSession(dbSession.id, userId).catch((err) =>
        console.error("Failed to end session on shutdown:", err),
      );
    });

    // Log session close reason
    session.on(voice.AgentSessionEventTypes.Close, ({ reason }) => {
      console.log(
        `Session ${dbSession.id} closed (user: ${userId}, reason: ${reason})`,
      );
    });

    // Handle user inactivity
    session.on(
      voice.AgentSessionEventTypes.UserStateChanged,
      createInactivityHandler({
        onCheckIn: () =>
          session.generateReply({
            instructions:
              "The user has been silent for a while. " +
              "Briefly ask if they're still there.",
          }),
        onTimeout: () =>
          session.shutdown({ drain: true, reason: "inactivity" }),
      }),
    );

    await session.start({ agent, room: ctx.room });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: AGENT_NAME,
  }),
);
