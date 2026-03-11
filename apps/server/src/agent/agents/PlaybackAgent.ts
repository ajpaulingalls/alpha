import { audioFramesFromFile, llm, voice } from "@livekit/agents";
import { z } from "zod";
import path from "node:path";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import type { ListenHistory } from "@alpha/data/schema/listen_history";
import type { CortexClient } from "@alpha/cortex";
import type { AlphaSessionData } from "../types";
import { BrowseAgent, type BrowseAgentDeps } from "./BrowseAgent";
import {
  createPausePlaybackTool,
  createResumePlaybackTool,
  createSkipTopicTool,
} from "../tools/playbackControls";
import { createSearchContextTool } from "../tools/searchContext";

export interface PlaybackAgentDeps {
  episodeId: string;
  episodeTitle: string;
  listenHistoryId: string;
  browseDeps: BrowseAgentDeps;
  findTopicsByEpisode: (episodeId: string) => Promise<PodcastTopic[]>;
  updateCompletedPercent: (
    id: string,
    percent: number
  ) => Promise<ListenHistory>;
  cortexClient: CortexClient;
  audioDir: string;
}

export interface PlaybackState {
  topics: PodcastTopic[];
  currentTopicIndex: number;
  paused: boolean;
  stopped: boolean;
  playing: boolean;
  lastSentPercent: number;
  continuePlayback: (() => void) | null;
}

export function calculatePlaybackPercent(
  currentIndex: number,
  totalCount: number
): number {
  return totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 100;
}

/** Truncate and strip control characters to prevent prompt injection via episode titles. */
function sanitizeTitle(raw: string): string {
  return raw.replace(/[\n\r\t]/g, " ").slice(0, 200);
}

function playbackInstructions(title: string): string {
  return (
    "You are Alpha, currently in podcast playback mode. " +
    `The user is listening to "${title}".\n\n` +
    "Available commands the user might say:\n" +
    '- "Pause" → use pausePlayback\n' +
    '- "Resume" / "Continue" → use resumePlayback\n' +
    '- "Skip" / "Next topic" → use skipTopic\n' +
    '- "Stop" / "Go back" → use endPlayback\n' +
    "- Any question about the content → use searchContext to answer, then offer to resume\n\n" +
    "After answering a question, always offer to resume playback.\n" +
    "Do not use tools unless the user gives a clear command or question."
  );
}

export class PlaybackAgent extends voice.Agent<AlphaSessionData> {
  private episodeTitle: string;
  private state: PlaybackState;
  private deps: PlaybackAgentDeps;

  constructor(
    options: voice.AgentOptions<AlphaSessionData>,
    episodeTitle: string,
    state: PlaybackState,
    deps: PlaybackAgentDeps
  ) {
    super(options);
    this.episodeTitle = episodeTitle;
    this.state = state;
    this.deps = deps;
  }

  async onEnter() {
    try {
      this.state.topics = await this.deps.findTopicsByEpisode(
        this.deps.episodeId
      );
    } catch (err) {
      console.error("Failed to load topics:", err);
      this.state.topics = [];
    }

    if (this.state.topics.length === 0) {
      this.session.generateReply({
        instructions:
          `This episode "${this.episodeTitle}" has no segmented topics available. ` +
          "Let the user know and offer to go back to browsing.",
      });
      return;
    }

    this.state.continuePlayback = () => {
      this.playFromCurrent();
    };

    this.session.generateReply({
      instructions:
        `Now playing "${this.episodeTitle}". ` +
        `First topic: "${sanitizeTitle(this.state.topics[0].title)}". ` +
        'Let the user know they can say "pause", "skip", or "stop".',
    });

    this.playFromCurrent();
  }

  private async playFromCurrent(): Promise<void> {
    if (this.state.playing) return;
    this.state.playing = true;

    try {
      while (
        this.state.currentTopicIndex < this.state.topics.length &&
        !this.state.stopped &&
        !this.state.paused
      ) {
        const topic = this.state.topics[this.state.currentTopicIndex];
        const audioPath = path.resolve(
          this.deps.audioDir,
          path.basename(topic.filename)
        );
        if (
          !audioPath.startsWith(path.resolve(this.deps.audioDir) + path.sep)
        ) {
          console.error(`Path traversal blocked: ${topic.filename}`);
          this.state.currentTopicIndex++;
          continue;
        }

        const safeTitle = sanitizeTitle(topic.title);
        const indexBeforePlayout = this.state.currentTopicIndex;
        const handle = this.session.say(safeTitle, {
          audio: audioFramesFromFile(audioPath, {
            sampleRate: 24000,
            numChannels: 1,
          }),
          allowInterruptions: true,
          addToChatCtx: false,
        });

        await handle.waitForPlayout();

        if (handle.interrupted) {
          return;
        }

        // Only advance if skipTopic didn't already advance the index
        if (this.state.currentTopicIndex === indexBeforePlayout) {
          this.state.currentTopicIndex++;
        }
        const percent = calculatePlaybackPercent(
          this.state.currentTopicIndex,
          this.state.topics.length
        );
        if (percent !== this.state.lastSentPercent) {
          this.state.lastSentPercent = percent;
          this.deps
            .updateCompletedPercent(this.deps.listenHistoryId, percent)
            .catch((err) => {
              console.error("updateCompletedPercent error:", err);
            });
        }
      }

      if (
        !this.state.stopped &&
        this.state.currentTopicIndex >= this.state.topics.length
      ) {
        this.state.stopped = true;
        this.session.generateReply({
          instructions:
            `Finished playing "${this.episodeTitle}". ` +
            "Ask the user if they want to explore something else.",
        });
      }
    } finally {
      this.state.playing = false;
    }
  }

  static create(deps: PlaybackAgentDeps): PlaybackAgent {
    const title = sanitizeTitle(deps.episodeTitle);
    const state: PlaybackState = {
      topics: [],
      currentTopicIndex: 0,
      paused: false,
      stopped: false,
      playing: false,
      lastSentPercent: 0,
      continuePlayback: null,
    };

    return new PlaybackAgent(
      {
        instructions: playbackInstructions(title),
        tools: {
          pausePlayback: createPausePlaybackTool(state),
          resumePlayback: createResumePlaybackTool(state),
          skipTopic: createSkipTopicTool(state, deps),
          searchContext: createSearchContextTool({
            cortexClient: deps.cortexClient,
          }),
          endPlayback: createEndPlaybackTool({ ...deps, episodeTitle: title }),
        },
      },
      title,
      state,
      deps
    );
  }
}

function createEndPlaybackTool(deps: PlaybackAgentDeps) {
  return llm.tool({
    description:
      "Stop the current episode playback and return to browse mode. " +
      "Call this when the user says 'stop', 'go back', or wants to do something else.",
    parameters: z.object({}),
    execute: async () => {
      return llm.handoff({
        agent: BrowseAgent.create(deps.browseDeps),
        returns: `Stopped playing "${deps.episodeTitle}". What would you like to explore next?`,
      });
    },
  });
}
