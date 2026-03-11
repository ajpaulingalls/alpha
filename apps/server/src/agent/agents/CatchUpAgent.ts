import { llm, voice } from "@livekit/agents";
import { z } from "zod";
import type { ContentClient } from "@alpha/content";
import type { CortexClient } from "@alpha/cortex";
import type { Session } from "@alpha/data/schema/sessions";
import type { UserPreference } from "@alpha/data/schema/user_preferences";
import type {
  ListenHistory,
  ListenContentType,
} from "@alpha/data/schema/listen_history";
import type { CatchUpDepth } from "@alpha/data/schema/user_preferences";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import type { AlphaSessionData } from "../types";
import { createFetchTopStoriesTool } from "../tools/fetchTopStories";
import { createFetchWireHighlightsTool } from "../tools/fetchWireHighlights";
import { createFetchNewPodcastsTool } from "../tools/fetchNewPodcasts";
import { BrowseAgent } from "./BrowseAgent";

export interface CatchUpAgentDeps {
  findPreviousSession: (
    userId: string,
    currentSessionId: string
  ) => Promise<Session | null>;
  findPreferencesByUserId: (userId: string) => Promise<UserPreference | null>;
  markCatchUpDelivered: (sessionId: string, userId: string) => Promise<Session>;
  recordListen: (
    sessionId: string,
    userId: string,
    contentType: ListenContentType,
    contentId: string
  ) => Promise<ListenHistory>;
  contentClient: ContentClient;
  cortexClient: CortexClient;
  findRecentEpisodes: (
    since: Date,
    limit?: number
  ) => Promise<PodcastEpisode[]>;
  findNewEpisodesForUser: (
    userId: string,
    since?: Date,
    limit?: number
  ) => Promise<PodcastEpisode[]>;
  findExistingEpisodeIds: (ids: string[]) => Promise<string[]>;
}

export function buildBriefingInstructions(
  hoursSince: number,
  depth: CatchUpDepth,
  userName?: string
): string {
  const greeting = userName ? `The user's name is ${userName}.` : "";

  let scope: string;
  if (hoursSince < 2) {
    scope =
      "This is a quick update — the user was here recently. " +
      "Cover 2-3 top stories briefly. Skip wire highlights unless there's breaking news. " +
      "Only mention new podcasts if something notable dropped.";
  } else if (hoursSince < 24) {
    scope =
      "This is a standard briefing. " +
      "Cover the top stories, share wire highlights, and mention new podcast episodes.";
  } else {
    scope =
      "This is a full recap — the user has been away for over a day. " +
      "Provide comprehensive coverage with more detail per story. " +
      "Cover all major developments, wire highlights, and new podcasts.";
  }

  let verbosity: string;
  if (depth === "brief") {
    verbosity = "Keep it concise — headlines and one-liners, minimal detail.";
  } else if (depth === "detailed") {
    verbosity =
      "Go in depth — provide context, background, and analysis for each story.";
  } else {
    verbosity = "Use a balanced level of detail for each item.";
  }

  return (
    `${greeting} ` +
    `It has been approximately ${Math.round(
      hoursSince
    )} hours since the user's last session. ` +
    `${scope} ${verbosity} ` +
    "Use the available tools to gather content, then deliver the briefing conversationally. " +
    "When you're done with the briefing, call the completeBriefing tool with the episode IDs " +
    "of any podcasts you mentioned."
  );
}

export class CatchUpAgent extends voice.Agent<AlphaSessionData> {
  private deps: CatchUpAgentDeps;

  constructor(
    options: voice.AgentOptions<AlphaSessionData>,
    deps: CatchUpAgentDeps
  ) {
    super(options);
    this.deps = deps;
  }

  async onEnter() {
    const { userId, userName, sessionId } = this.session.userData;

    const [lastSession, preferences] = await Promise.all([
      this.deps.findPreviousSession(userId, sessionId),
      this.deps.findPreferencesByUserId(userId),
    ]);

    const MAX_LOOKBACK_HOURS = 48;
    const raw = lastSession?.endedAt
      ? (Date.now() - lastSession.endedAt.getTime()) / (1000 * 60 * 60)
      : MAX_LOOKBACK_HOURS;
    const hoursSince = Math.min(raw, MAX_LOOKBACK_HOURS);

    const depth = (preferences?.catchUpDepth ?? "standard") as CatchUpDepth;

    this.session.generateReply({
      instructions: buildBriefingInstructions(hoursSince, depth, userName),
    });
  }

  static create(deps: CatchUpAgentDeps) {
    return new CatchUpAgent(
      {
        instructions:
          "You are Alpha, an AI-powered news briefing host. " +
          "Deliver a personalized catch-up briefing based on how long the user has been away. " +
          "Use a warm, conversational tone — like a knowledgeable friend filling them in. " +
          "If the user interrupts with 'tell me more', expand on the current topic. " +
          "If they say 'next' or 'skip', move to the next item. " +
          "When the briefing is complete, call the completeBriefing tool.",
        tools: {
          fetchTopStories: createFetchTopStoriesTool({
            contentClient: deps.contentClient,
            findRecentEpisodes: deps.findRecentEpisodes,
          }),
          fetchWireHighlights: createFetchWireHighlightsTool({
            cortexClient: deps.cortexClient,
          }),
          fetchNewPodcasts: createFetchNewPodcastsTool({
            findNewEpisodesForUser: deps.findNewEpisodesForUser,
          }),
          completeBriefing: createCompleteBriefingTool(deps),
        },
      },
      deps
    );
  }
}

function createCompleteBriefingTool(deps: CatchUpAgentDeps) {
  return llm.tool({
    description:
      "Complete the catch-up briefing. Call this when you have finished delivering the briefing. " +
      "Pass the episode IDs of any podcast episodes you mentioned so we can track them.",
    parameters: z.object({
      episodeIds: z
        .array(z.string().uuid())
        .max(50)
        .default([])
        .describe("UUIDs of podcast episodes mentioned during the briefing"),
    }),
    execute: async ({ episodeIds }, { ctx }) => {
      try {
        const { sessionId, userId } = ctx.userData as AlphaSessionData;

        const validIds =
          episodeIds.length > 0
            ? await deps.findExistingEpisodeIds(episodeIds)
            : [];

        await Promise.all([
          deps.markCatchUpDelivered(sessionId, userId),
          ...validIds.map((id) =>
            deps.recordListen(sessionId, userId, "episode", id)
          ),
        ]);

        return llm.handoff({
          agent: BrowseAgent.create(),
          returns:
            "That's the latest. You're all caught up! " +
            "Feel free to ask about anything — I can search for podcasts, " +
            "dive deeper into a story, or explore any topic you're curious about.",
        });
      } catch (err) {
        console.error("completeBriefing tool error:", err);
        return JSON.stringify({
          error: "Failed to complete briefing. Please try again.",
        });
      }
    },
  });
}
