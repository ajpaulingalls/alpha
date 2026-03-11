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
import { AGENT_NAME } from "./constants";
import { type AlphaSessionData, isNewUser } from "./types";
import { SetupAgent } from "./agents/SetupAgent";
import { CatchUpAgent } from "./agents/CatchUpAgent";

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData["vad"] = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData["vad"] as silero.VAD;

    await ctx.connect();
    const participant = await ctx.waitForParticipant();
    const userId = participant.identity;
    const user = await findUserById(userId);

    const isNew = isNewUser(user);

    const userData: AlphaSessionData = {
      userId,
      userName: isNew ? undefined : user?.name,
    };

    const agent = isNew ? SetupAgent.create() : CatchUpAgent.create();

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
