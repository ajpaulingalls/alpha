import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from "@livekit/agents";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { fileURLToPath } from "node:url";
import { findUserById } from "@alpha/data/crud/users";
import {
  createSession,
  findPreviousSession,
  markCatchUpDelivered,
} from "@alpha/data/crud/sessions";
import { findPreferencesByUserId } from "@alpha/data/crud/preferences";
import { recordListen } from "@alpha/data/crud/listen-history";
import {
  findRecentEpisodes,
  findNewEpisodesForUser,
  findExistingEpisodeIds,
} from "@alpha/data/crud/episodes";
import { ContentClient } from "@alpha/content";
import { CortexClient } from "@alpha/cortex";
import { AGENT_NAME } from "./constants";
import { type AlphaSessionData, isNewUser } from "./types";
import { SetupAgent } from "./agents/SetupAgent";
import { CatchUpAgent, type CatchUpAgentDeps } from "./agents/CatchUpAgent";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData["vad"] = await silero.VAD.load();

    const contentGraphqlUrl = process.env["CONTENT_GRAPHQL_URL"];
    const cortexApiUrl = process.env["CORTEX_API_URL"];
    if (!contentGraphqlUrl || !cortexApiUrl) {
      throw new Error(
        "CONTENT_GRAPHQL_URL and CORTEX_API_URL environment variables are required"
      );
    }

    proc.userData["contentClient"] = new ContentClient(contentGraphqlUrl);
    proc.userData["cortexClient"] = new CortexClient(cortexApiUrl);
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData["vad"] as silero.VAD;
    const contentClient = ctx.proc.userData["contentClient"] as ContentClient;
    const cortexClient = ctx.proc.userData["cortexClient"] as CortexClient;

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    const userId = participant.identity;

    const [user, dbSession] = await Promise.all([
      findUserById(userId),
      createSession(userId),
    ]);

    const isNew = isNewUser(user);

    const catchUpDeps: CatchUpAgentDeps = {
      findPreviousSession,
      findPreferencesByUserId,
      markCatchUpDelivered,
      recordListen,
      contentClient,
      cortexClient,
      findRecentEpisodes,
      findNewEpisodesForUser,
      findExistingEpisodeIds,
    };

    const userData: AlphaSessionData = {
      userId,
      userName: isNew ? undefined : user?.name,
      sessionId: dbSession.id,
    };

    const agent = isNew
      ? SetupAgent.create(catchUpDeps)
      : CatchUpAgent.create(catchUpDeps);

    const session = new voice.AgentSession<AlphaSessionData>({
      vad,
      stt: "deepgram/nova-3:multi",
      llm: "openai/gpt-4.1-mini",
      tts: "cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      turnDetection: new livekit.turnDetector.MultilingualModel(),
      userData,
    });

    await session.start({ agent, room: ctx.room });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: AGENT_NAME,
  })
);
