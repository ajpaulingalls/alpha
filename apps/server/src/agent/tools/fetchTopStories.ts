import { llm } from "@livekit/agents";
import { z } from "zod";
import type { ContentClient } from "@alpha/content";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import { mapEpisodeSummary } from "./types";

export function createFetchTopStoriesTool(deps: {
  contentClient: ContentClient;
  findRecentEpisodes: (
    since: Date,
    limit?: number
  ) => Promise<PodcastEpisode[]>;
}) {
  return llm.tool({
    description:
      "Fetch top stories: recent articles from Al Jazeera and pre-generated podcast episodes.",
    parameters: z.object({
      since: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 date — fetch stories published after this time"),
    }),
    execute: async ({ since }) => {
      try {
        const sinceDate = since ? new Date(since) : new Date(0);

        const [articles, episodes] = await Promise.all([
          deps.contentClient.getRecentArticles(10),
          deps.findRecentEpisodes(sinceDate, 5),
        ]);

        return JSON.stringify({
          articles: articles.map((a) => ({
            id: a.id,
            title: a.title,
            excerpt: a.excerpt,
            date: a.date,
            link: a.link,
            imageUrl: a.imageUrl,
            categories: a.categories,
          })),
          episodes: episodes.map(mapEpisodeSummary),
        });
      } catch (err) {
        console.error("fetchTopStories tool error:", err);
        return JSON.stringify({ error: "Failed to fetch top stories." });
      }
    },
  });
}
