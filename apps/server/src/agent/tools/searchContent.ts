import { llm } from "@livekit/agents";
import { z } from "zod";
import type { CortexClient } from "@alpha/cortex";
import type { ContentClient } from "@alpha/content";
import type { CachedResponse } from "@alpha/data/schema/cached_responses";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import type { ContentResult } from "./types";
import { embedQuery } from "./types";

export function createSearchContentTool(deps: {
  cortexClient: CortexClient;
  contentClient: ContentClient;
  searchCachedResponses: (
    queryEmbedding: number[],
    similarityThreshold: number,
    limit?: number
  ) => Promise<(CachedResponse & { distance: number })[]>;
  searchTopicsByEmbedding: (
    embedding: number[],
    limit?: number
  ) => Promise<(PodcastTopic & { distance: number })[]>;
  incrementHitCount?: (id: string) => Promise<unknown>;
}) {
  return llm.tool({
    description:
      "Search across cached responses, podcast topics, and articles to find the best content for a query. Returns results ranked by relevance.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("The search query to find relevant content"),
    }),
    execute: async ({ query }) => {
      try {
        const [embedding, articleResults] = await Promise.all([
          embedQuery(deps.cortexClient, query),
          deps.contentClient.searchArticles(query),
        ]);

        const results: ContentResult[] = [];

        if (embedding) {
          const [cachedResults, topicResults] = await Promise.all([
            deps.searchCachedResponses(embedding, 0.3, 5),
            deps.searchTopicsByEmbedding(embedding, 10),
          ]);

          for (const cached of cachedResults) {
            results.push({
              contentType: "cached_response",
              id: cached.id,
              title: cached.contentType ?? "cached_response",
              summary: cached.responseText ?? "",
              score: cached.distance,
              audioFilename: cached.audioFilename ?? undefined,
            });

            if (deps.incrementHitCount) {
              deps.incrementHitCount(cached.id).catch((err) => {
                console.error("incrementHitCount error:", err);
              });
            }
          }

          for (const topic of topicResults) {
            results.push({
              contentType: "podcast_topic",
              id: topic.id,
              title: topic.title,
              summary: topic.summary,
              score: topic.distance,
              audioFilename: topic.filename,
            });
          }
        }

        for (const article of articleResults) {
          results.push({
            contentType: "article",
            id: article.link,
            title: article.title,
            summary: article.snippet,
            link: article.link,
            publishedAt: article.publishedAt,
          });
        }

        return JSON.stringify({
          results,
          ...(embedding
            ? {}
            : { error: "Failed to generate query embedding." }),
        });
      } catch (err) {
        console.error("searchContent tool error:", err);
        return JSON.stringify({ error: "Content search failed." });
      }
    },
  });
}
