import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { AlphaSessionData } from "../types";
import { BrowseAgent, type BrowseAgentDeps } from "./BrowseAgent";

export interface PlaybackAgentDeps {
  episodeId: string;
  episodeTitle: string;
  browseDeps: BrowseAgentDeps;
}

/** Truncate and strip control characters to prevent prompt injection via episode titles. */
function sanitizeTitle(raw: string): string {
  return raw.replace(/[\n\r\t]/g, " ").slice(0, 200);
}

export class PlaybackAgent extends voice.Agent<AlphaSessionData> {
  private episodeTitle: string;

  constructor(
    options: voice.AgentOptions<AlphaSessionData>,
    episodeTitle: string
  ) {
    super(options);
    this.episodeTitle = episodeTitle;
  }

  async onEnter() {
    this.session.generateReply({
      instructions: `Now playing "${this.episodeTitle}". Let the user know they can say "stop" to go back to browsing.`,
    });
  }

  static create(deps: PlaybackAgentDeps): PlaybackAgent {
    const title = sanitizeTitle(deps.episodeTitle);
    return new PlaybackAgent(
      {
        instructions:
          "You are Alpha, currently in playback mode. " +
          "The user is listening to this episode. If they say 'stop', 'go back', " +
          "or want to do something else, use the endPlayback tool to return to browsing.\n\n" +
          `Episode title: ${title}`,
        tools: {
          endPlayback: createEndPlaybackTool({ ...deps, episodeTitle: title }),
        },
      },
      title
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
