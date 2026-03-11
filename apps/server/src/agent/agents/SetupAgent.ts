import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import { updateUserName } from "@alpha/data/crud/users";
import { createPreferences } from "@alpha/data/crud/preferences";
import type { AlphaSessionData } from "../types";
import { CatchUpAgent, type CatchUpAgentDeps } from "./CatchUpAgent";

export class SetupAgent extends voice.Agent<AlphaSessionData> {
  async onEnter() {
    this.session.generateReply({
      instructions: "Welcome the user to Alpha and ask for their name.",
    });
  }

  static create(catchUpDeps: CatchUpAgentDeps, agentLLM?: llm.LLM) {
    return new SetupAgent({
      llm: agentLLM,
      instructions:
        "You are Alpha, an AI-powered podcast assistant meeting a new user for the first time. " +
        "Your goal is to welcome them warmly and learn their name. " +
        "Once they tell you their name, use the recordName tool to save it. " +
        "Keep your tone friendly, warm, and conversational.",
      tools: {
        recordName: llm.tool({
          description:
            "Record the user's name after they introduce themselves.",
          parameters: z.object({
            name: z
              .string()
              .trim()
              .min(1)
              .max(100)
              .describe("The user's first name"),
          }),
          execute: async ({ name }, { ctx }) => {
            if (ctx.userData.userName) {
              return "Name already recorded.";
            }

            await Promise.all([
              updateUserName(ctx.userData.userId, name),
              createPreferences(ctx.userData.userId),
            ]);
            ctx.userData.userName = name;

            return llm.handoff({
              agent: CatchUpAgent.create(catchUpDeps),
              returns:
                "Deliver this intro to the user, addressing them by name: " +
                "\"Hey [user's name], I'm Alpha. " +
                "I'm going to catch you up on what's been happening today. " +
                "If anything catches your ear, just jump in — ask me a question, " +
                "tell me to go deeper, or say 'next' to move on. " +
                "Here's what's going on...\"",
            });
          },
        }),
      },
    });
  }
}
