import { llm } from "@livekit/agents";
import { z } from "zod";
import type { CortexClient } from "@alpha/cortex";

export function createFetchWireHighlightsTool(deps: {
  cortexClient: CortexClient;
}) {
  return llm.tool({
    description:
      "Fetch the latest wire service highlights and breaking news summaries.",
    parameters: z.object({
      since: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 date — fetch highlights published after this time"),
    }),
    execute: async ({ since }) => {
      try {
        const query = since
          ? `Latest wire service highlights and breaking news since ${since}`
          : "Latest wire service highlights and breaking news";

        const { result, sources } = await deps.cortexClient.rag(query);

        return JSON.stringify({
          highlights: result,
          sources: sources.map((s) => ({
            title: s.title,
            content: s.content,
            url: s.url,
          })),
        });
      } catch (err) {
        console.error("fetchWireHighlights tool error:", err);
        return JSON.stringify({ error: "Failed to fetch wire highlights." });
      }
    },
  });
}
