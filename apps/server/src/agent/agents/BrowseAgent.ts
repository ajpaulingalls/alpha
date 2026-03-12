import { voice } from "@livekit/agents";
import type { CortexClient } from "@alpha/cortex";
import type { ContentClient } from "@alpha/content";
import type { CachedResponse } from "@alpha/data/schema/cached_responses";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import type { PodcastEpisode } from "@alpha/data/schema/podcast_episodes";
import type {
  ListenHistory,
  ListenContentType,
} from "@alpha/data/schema/listen_history";
import type { AlphaSessionData } from "../types";
import type { StreamingGenerator } from "../generation/StreamingGenerator";
import { createSearchContentTool } from "../tools/searchContent";
import { createSearchPodcastsTool } from "../tools/searchPodcasts";
import { createGenerateResponseTool } from "../tools/generateResponse";
import { createPlayPodcastTool } from "../tools/playPodcast";
import {
  createEndSessionTool,
  type EndSessionDeps,
} from "../tools/sessionTools";

export interface BrowseAgentDeps extends EndSessionDeps {
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
  generator: StreamingGenerator;
  findEpisodesByShow: (
    showName: string,
    limit?: number
  ) => Promise<PodcastEpisode[]>;
  findEpisodeById: (id: string) => Promise<PodcastEpisode | null>;
  recordListen: (
    sessionId: string,
    userId: string,
    contentType: ListenContentType,
    contentId: string
  ) => Promise<ListenHistory>;
  incrementHitCount: (id: string) => Promise<CachedResponse>;
  findTopicsByEpisode: (episodeId: string) => Promise<PodcastTopic[]>;
  updateCompletedPercent: (
    id: string,
    percent: number
  ) => Promise<ListenHistory>;
  audioDir: string;
}

const BROWSE_INSTRUCTIONS =
  "You are Alpha, a knowledgeable and personable Al Jazeera news and podcast host. " +
  "You help users explore news topics, discover podcasts, and get answers to their questions. " +
  "\n\n" +
  "## Content Resolution Priority\n" +
  "When a user asks about a topic, resolve it in this order:\n" +
  "1. **Direct podcast request** — If the user asks to play a specific podcast, use playPodcast.\n" +
  "2. **Cache hit** — Use searchContent first. If a cached response matches well, use it directly.\n" +
  "3. **Existing clip** — If searchContent finds a relevant podcast topic, summarize it.\n" +
  "4. **Generate** — Only use generateResponse as a last resort when no existing content fits.\n" +
  "\n\n" +
  "## Tool Usage\n" +
  "- **searchContent**: Always try this first for any topic question. Returns cached responses, podcast topics, and articles.\n" +
  "- **searchPodcasts**: Use when the user asks about a specific show or wants to browse episodes.\n" +
  "- **generateResponse**: Use only when searchContent returns no relevant results. Pass the query and any partial context.\n" +
  "- **playPodcast**: Use when the user selects an episode to listen to. Requires the episode ID.\n" +
  "\n\n" +
  "## Topic Drift Handling\n" +
  "- **On-topic** (news, current events, Al Jazeera content): Engage fully.\n" +
  "- **Brief tangent** (related but off-beat): Answer briefly, then steer back to news content.\n" +
  "- **Empathetic redirect** (personal questions, off-topic): Acknowledge warmly, then suggest a related news angle.\n" +
  "- **Sustained drift** (repeated off-topic): Gently remind the user you're a news assistant and suggest topics.\n" +
  "\n\n" +
  "## Ending the Session\n" +
  "If the user says 'I'm done', 'stop', 'goodbye', or otherwise wants to leave, " +
  "call the endSession tool before saying your final goodbye.\n\n" +
  "## Tone\n" +
  "Warm, confident, and conversational — like a knowledgeable friend who happens to be a journalist. " +
  "Never fall into a generic knowledge assistant mode. Always ground responses in real content.";

export class BrowseAgent extends voice.Agent<AlphaSessionData> {
  static create(deps: BrowseAgentDeps): BrowseAgent {
    return new BrowseAgent({
      instructions: BROWSE_INSTRUCTIONS,
      tools: {
        searchContent: createSearchContentTool({
          cortexClient: deps.cortexClient,
          contentClient: deps.contentClient,
          searchCachedResponses: deps.searchCachedResponses,
          searchTopicsByEmbedding: deps.searchTopicsByEmbedding,
          incrementHitCount: deps.incrementHitCount,
        }),
        searchPodcasts: createSearchPodcastsTool({
          cortexClient: deps.cortexClient,
          findEpisodesByShow: deps.findEpisodesByShow,
          searchTopicsByEmbedding: deps.searchTopicsByEmbedding,
        }),
        generateResponse: createGenerateResponseTool({
          generator: deps.generator,
        }),
        playPodcast: createPlayPodcastTool({
          findEpisodeById: deps.findEpisodeById,
          recordListen: deps.recordListen,
          findTopicsByEpisode: deps.findTopicsByEpisode,
          updateCompletedPercent: deps.updateCompletedPercent,
          cortexClient: deps.cortexClient,
          audioDir: deps.audioDir,
          browseDeps: deps,
        }),
        endSession: createEndSessionTool({
          endDbSession: deps.endDbSession,
          shutdownSession: deps.shutdownSession,
        }),
      },
    });
  }
}
