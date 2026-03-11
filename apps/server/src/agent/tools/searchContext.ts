import { llm } from "@livekit/agents";
import { z } from "zod";
import type { CortexClient } from "@alpha/cortex";

export interface SearchContextDeps {
  cortexClient: CortexClient;
}

export function createSearchContextTool(deps: SearchContextDeps) {
  return llm.tool({
    description:
      "Search for additional context about the podcast content being played. " +
      "Use when the user asks a question about what they're hearing.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The user's question about the content"),
    }),
    execute: async ({ query }) => {
      try {
        const result = await deps.cortexClient.rag(query);
        if (!result.result) {
          return JSON.stringify({
            answer: "I couldn't find additional context on that topic.",
          });
        }
        return JSON.stringify({
          answer: result.result,
          sources: result.sources,
        });
      } catch (err) {
        console.error("searchContext tool error:", err);
        return JSON.stringify({
          answer: "Sorry, I had trouble looking that up.",
        });
      }
    },
  });
}
