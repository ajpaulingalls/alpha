import { llm } from "@livekit/agents";
import { z } from "zod";
import type { AlphaSessionData } from "../types";

export interface EndSessionDeps {
  endDbSession: (sessionId: string, userId: string) => Promise<unknown>;
  shutdownSession: () => void;
}

export function createEndSessionTool(deps: EndSessionDeps) {
  return llm.tool({
    description:
      "End the current session when the user wants to stop, says goodbye, " +
      "or says 'I'm done'. Call this before saying your final goodbye.",
    parameters: z.object({}),
    execute: async (_params, { ctx }) => {
      try {
        const { sessionId, userId } = ctx.userData as AlphaSessionData;
        await deps.endDbSession(sessionId, userId);
        deps.shutdownSession();
        return "Session ended. Say a brief, warm goodbye to the user.";
      } catch (err) {
        console.error("endSession tool error:", err);
        return JSON.stringify({ error: "Failed to end session." });
      }
    },
  });
}
