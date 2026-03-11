import { llm } from "@livekit/agents";
import { z } from "zod";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import type {
  ListenHistory,
  ListenContentType,
} from "@alpha/data/schema/listen_history";
import type { CortexClient } from "@alpha/cortex";
import type { AlphaSessionData } from "../types";
import { PlaybackAgent, type PlaybackAgentDeps } from "../agents/PlaybackAgent";
import type { BrowseAgentDeps } from "../agents/BrowseAgent";

export interface PlayPodcastDeps {
  findEpisodeById: (id: string) => Promise<PodcastEpisode | null>;
  recordListen: (
    sessionId: string,
    userId: string,
    contentType: ListenContentType,
    contentId: string
  ) => Promise<ListenHistory>;
  findTopicsByEpisode: (episodeId: string) => Promise<PodcastTopic[]>;
  updateCompletedPercent: (
    id: string,
    percent: number
  ) => Promise<ListenHistory>;
  cortexClient: CortexClient;
  audioDir: string;
  browseDeps: BrowseAgentDeps;
}

export function createPlayPodcastTool(deps: PlayPodcastDeps) {
  return llm.tool({
    description:
      "Start playing a podcast episode. Looks up the episode, records the listen, " +
      "and hands off to the playback agent.",
    parameters: z.object({
      episodeId: z
        .string()
        .uuid()
        .describe("The UUID of the podcast episode to play"),
    }),
    execute: async ({ episodeId }, { ctx }) => {
      try {
        const episode = await deps.findEpisodeById(episodeId);
        if (!episode) {
          return JSON.stringify({
            error: "Episode not found.",
          });
        }

        const { sessionId, userId } = ctx.userData as AlphaSessionData;
        const listenRecord = await deps.recordListen(
          sessionId,
          userId,
          "episode",
          episodeId
        );

        const episodeTitle = (episode.title ?? "Untitled Episode")
          .replace(/[\n\r\t]/g, " ")
          .slice(0, 200);
        const playbackDeps: PlaybackAgentDeps = {
          episodeId,
          episodeTitle,
          listenHistoryId: listenRecord.id,
          findTopicsByEpisode: deps.findTopicsByEpisode,
          updateCompletedPercent: deps.updateCompletedPercent,
          cortexClient: deps.cortexClient,
          audioDir: deps.audioDir,
          browseDeps: deps.browseDeps,
        };

        return llm.handoff({
          agent: PlaybackAgent.create(playbackDeps),
          returns: `Now playing "${episodeTitle}".`,
        });
      } catch (err) {
        console.error("playPodcast tool error:", err);
        return JSON.stringify({ error: "Failed to start playback." });
      }
    },
  });
}
