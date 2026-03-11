import { llm } from "@livekit/agents";
import { z } from "zod";
import type { CortexClient } from "@alpha/cortex";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import { embedQuery, mapEpisodeSummary } from "./types";

export function createSearchPodcastsTool(deps: {
  cortexClient: CortexClient;
  findEpisodesByShow: (
    showName: string,
    limit?: number
  ) => Promise<PodcastEpisode[]>;
  searchTopicsByEmbedding: (
    embedding: number[],
    limit?: number
  ) => Promise<(PodcastTopic & { distance: number })[]>;
}) {
  return llm.tool({
    description:
      "Search for podcast episodes by show name and/or content similarity.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query for finding relevant podcast content"),
      showName: z
        .string()
        .max(255)
        .optional()
        .describe("Optional show name to filter episodes by"),
    }),
    execute: async ({ query, showName }) => {
      try {
        const [embedding, episodes] = await Promise.all([
          embedQuery(deps.cortexClient, query),
          showName
            ? deps.findEpisodesByShow(showName, 10)
            : Promise.resolve([] as PodcastEpisode[]),
        ]);

        if (!embedding) {
          return JSON.stringify({
            episodes: episodes.map(mapEpisodeSummary),
            topics: [],
            error: "Failed to generate query embedding.",
          });
        }

        const topics = await deps.searchTopicsByEmbedding(embedding, 10);

        return JSON.stringify({
          episodes: episodes.map(mapEpisodeSummary),
          topics: topics.map((t) => ({
            id: t.id,
            title: t.title,
            summary: t.summary,
            episodeId: t.episodeId,
            score: t.distance,
          })),
        });
      } catch (err) {
        console.error("searchPodcasts tool error:", err);
        return JSON.stringify({ error: "Podcast search failed." });
      }
    },
  });
}
