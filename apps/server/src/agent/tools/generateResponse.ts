import { llm } from "@livekit/agents";
import { z } from "zod";
import type { StreamingGenerator } from "../generation/StreamingGenerator";
import type { AlphaSessionData } from "../types";

export function createGenerateResponseTool(deps: {
  generator: StreamingGenerator;
}) {
  return llm.tool({
    description:
      "Generate an original spoken response to the user's question using AI. " +
      "Use this when no cached response or podcast topic adequately answers the query. " +
      "Provide the user's query and any relevant context from search results.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The user's question or topic"),
      context: z
        .string()
        .max(5000)
        .default("")
        .describe(
          "Relevant context from search results to ground the response"
        ),
    }),
    execute: async ({ query, context }, { ctx }) => {
      try {
        const userData = ctx.userData as AlphaSessionData;
        const result = await deps.generator.generate(
          query,
          context,
          userData.userId
        );

        result.cachingPromise.catch((err) => {
          console.error("Background caching error:", err);
        });

        return JSON.stringify({
          generatedResponse: result.text,
          caching: true,
        });
      } catch (err) {
        console.error("generateResponse tool error:", err);
        return JSON.stringify({ error: "Failed to generate response." });
      }
    },
  });
}
