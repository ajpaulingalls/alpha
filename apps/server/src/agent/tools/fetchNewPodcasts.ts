import { llm } from "@livekit/agents";
import { z } from "zod";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import type { AlphaSessionData } from "../types";
import { mapEpisodeSummary } from "./types";

export function createFetchNewPodcastsTool(deps: {
  findNewEpisodesForUser: (
    userId: string,
    since?: Date,
    limit?: number,
  ) => Promise<PodcastEpisode[]>;
}) {
  return llm.tool({
    description:
      "Fetch recently published podcast episodes the user has not yet listened to.",
    parameters: z.object({
      since: z
        .string()
        .datetime()
        .optional()
        .describe("ISO 8601 date — fetch episodes published after this time"),
    }),
    execute: async ({ since }, { ctx }) => {
      try {
        const userData = ctx.userData as AlphaSessionData;
        const sinceDate = since ? new Date(since) : undefined;
        const episodes = await deps.findNewEpisodesForUser(
          userData.userId,
          sinceDate,
          10,
        );

        return JSON.stringify({
          episodes: episodes.map(mapEpisodeSummary),
        });
      } catch (err) {
        console.error("fetchNewPodcasts tool error:", err);
        return JSON.stringify({ error: "Failed to fetch new podcasts." });
      }
    },
  });
}
