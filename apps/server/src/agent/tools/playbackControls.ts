import { llm } from "@livekit/agents";
import { z } from "zod";
import {
  calculatePlaybackPercent,
  type PlaybackState,
  type PlaybackAgentDeps,
} from "../agents/PlaybackAgent";

export function createPausePlaybackTool(state: PlaybackState) {
  return llm.tool({
    description:
      "Pause the current podcast playback. " +
      "Call this when the user says 'pause' or wants to stop listening temporarily.",
    parameters: z.object({}),
    execute: async () => {
      state.paused = true;
      return JSON.stringify({
        status: "paused",
        message: "Playback paused. Say 'resume' to continue.",
      });
    },
  });
}

export function createResumePlaybackTool(state: PlaybackState) {
  return llm.tool({
    description:
      "Resume podcast playback from where it was paused or interrupted. " +
      "Call this when the user says 'resume', 'continue', or 'keep playing'.",
    parameters: z.object({}),
    execute: async () => {
      state.paused = false;
      state.continuePlayback?.();
      return JSON.stringify({
        status: "resuming",
        message: "Resuming playback.",
      });
    },
  });
}

export function createSkipTopicTool(
  state: PlaybackState,
  deps: PlaybackAgentDeps,
) {
  return llm.tool({
    description:
      "Skip to the next topic segment in the podcast. " +
      "Call this when the user says 'skip', 'next topic', or 'skip ahead'.",
    parameters: z.object({}),
    execute: async () => {
      state.currentTopicIndex++;

      const percent = calculatePlaybackPercent(
        state.currentTopicIndex,
        state.topics.length,
      );
      if (percent !== state.lastSentPercent) {
        state.lastSentPercent = percent;
        deps
          .updateCompletedPercent(deps.listenHistoryId, percent)
          .catch((err) => {
            console.error("updateCompletedPercent error:", err);
          });
      }

      if (state.currentTopicIndex >= state.topics.length) {
        state.stopped = true;
        return JSON.stringify({
          status: "finished",
          message: `No more topics in "${deps.episodeTitle}". Would you like to explore something else?`,
        });
      }

      const nextTitle = state.topics[state.currentTopicIndex].title;
      state.paused = false;
      state.continuePlayback?.();
      return JSON.stringify({
        status: "skipping",
        message: `Skipping to next topic.`,
        topic: nextTitle.replace(/[\n\r\t]/g, " ").slice(0, 200),
      });
    },
  });
}
