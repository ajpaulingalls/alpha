import { voice } from "@livekit/agents";
import type { CortexClient } from "@alpha/cortex";
import type { ContentClient } from "@alpha/content";
import type { CachedResponse } from "@alpha/data/schema/cached_responses";
import type { PodcastTopic } from "@alpha/data/schema/podcast_topics";
import type { AlphaSessionData } from "../types";
import type { StreamingGenerator } from "../generation/StreamingGenerator";
import { createSearchContentTool } from "../tools/searchContent";
import { createGenerateResponseTool } from "../tools/generateResponse";

export interface BrowseAgentDeps {
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
}

export class BrowseAgent extends voice.Agent<AlphaSessionData> {
  async onEnter() {
    this.session.generateReply({
      instructions:
        "Welcome the user to browse mode. Let them know they can ask about any topic, " +
        "search for podcasts, or explore the latest news. " +
        "Keep your tone friendly and conversational.",
    });
  }

  static create(deps: BrowseAgentDeps) {
    return new BrowseAgent({
      instructions:
        "You are Alpha, an AI-powered podcast assistant in browse mode. " +
        "Help the user explore content — they can ask about topics, search for podcasts, " +
        "or dive deeper into stories. Be conversational and helpful. " +
        "When a user asks a question, use the searchContent tool first. " +
        "If results are sufficient, summarize them conversationally. " +
        "If no good match is found, use the generateResponse tool to create an original answer. " +
        "Always prefer existing content over generation when available.",
      tools: {
        searchContent: createSearchContentTool({
          cortexClient: deps.cortexClient,
          contentClient: deps.contentClient,
          searchCachedResponses: deps.searchCachedResponses,
          searchTopicsByEmbedding: deps.searchTopicsByEmbedding,
        }),
        generateResponse: createGenerateResponseTool({
          generator: deps.generator,
        }),
      },
    });
  }
}
