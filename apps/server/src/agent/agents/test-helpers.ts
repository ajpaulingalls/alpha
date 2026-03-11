/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "bun:test";
import type { CatchUpAgentDeps } from "./CatchUpAgent";
import type { BrowseAgentDeps } from "./BrowseAgent";

export function mockBrowseDeps(
  overrides?: Partial<BrowseAgentDeps>
): BrowseAgentDeps {
  return {
    cortexClient: {
      embed: mock(() => Promise.resolve([[0.1, 0.2, 0.3]])),
      rag: mock(() => Promise.resolve({ result: "", sources: [] })),
    } as any,
    contentClient: {
      searchArticles: mock(() => Promise.resolve([])),
    } as any,
    searchCachedResponses: mock(() => Promise.resolve([])),
    searchTopicsByEmbedding: mock(() => Promise.resolve([])),
    generator: {
      generate: mock(() =>
        Promise.resolve({
          text: "Generated response.",
          cachingPromise: Promise.resolve(),
        })
      ),
    } as any,
    ...overrides,
  };
}

export function mockCatchUpDeps(
  overrides?: Partial<CatchUpAgentDeps>
): CatchUpAgentDeps {
  return {
    findPreviousSession: mock(() => Promise.resolve(null)),
    findPreferencesByUserId: mock(() => Promise.resolve(null)),
    markCatchUpDelivered: mock(() =>
      Promise.resolve({
        id: "s1",
        userId: "u1",
        startedAt: new Date(),
        endedAt: null,
        catchUpDelivered: true,
      })
    ),
    recordListen: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1",
        listenedAt: new Date(),
        completedPercent: 0,
      })
    ),
    contentClient: {
      getRecentArticles: mock(() => Promise.resolve([])),
    } as any,
    cortexClient: {
      rag: mock(() => Promise.resolve({ result: "", sources: [] })),
    } as any,
    findRecentEpisodes: mock(() => Promise.resolve([])),
    findNewEpisodesForUser: mock(() => Promise.resolve([])),
    findExistingEpisodeIds: mock((ids: string[]) => Promise.resolve(ids)),
    browseDeps: mockBrowseDeps(),
    ...overrides,
  };
}
