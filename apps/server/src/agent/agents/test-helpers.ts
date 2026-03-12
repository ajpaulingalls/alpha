/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "bun:test";
import type { CatchUpAgentDeps } from "./CatchUpAgent";
import type { BrowseAgentDeps } from "./BrowseAgent";
import type { PlaybackAgentDeps } from "./PlaybackAgent";

export function mockBrowseDeps(
  overrides?: Partial<BrowseAgentDeps>,
): BrowseAgentDeps {
  return {
    notifyClient: mock(() => undefined),
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
        }),
      ),
    } as any,
    findEpisodesByShow: mock(() => Promise.resolve([])),
    findEpisodeById: mock(() => Promise.resolve(null)),
    recordListen: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1",
        listenedAt: new Date(),
        completedPercent: 0,
      }),
    ),
    incrementHitCount: mock(() =>
      Promise.resolve({
        id: "cr1",
        queryEmbedding: null,
        responseText: null,
        audioFilename: null,
        sourceSummary: null,
        contentType: null,
        expiresAt: null,
        hitCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ),
    findTopicsByEpisode: mock(() => Promise.resolve([])),
    updateCompletedPercent: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1",
        listenedAt: new Date(),
        completedPercent: 50,
      }),
    ),
    audioDir: "/tmp/test-audio",
    endDbSession: mock((_sid: string, _uid: string) => Promise.resolve()),
    shutdownSession: mock(() => undefined),
    ...overrides,
  };
}

export function mockPlaybackDeps(
  overrides?: Partial<PlaybackAgentDeps>,
): PlaybackAgentDeps {
  return {
    notifyClient: mock(() => undefined),
    episodeId: "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
    episodeTitle: "Test Episode",
    listenHistoryId: "lh1",
    browseDeps: mockBrowseDeps(),
    findTopicsByEpisode: mock(() => Promise.resolve([])),
    updateCompletedPercent: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1",
        listenedAt: new Date(),
        completedPercent: 50,
      }),
    ),
    cortexClient: {
      rag: mock(() => Promise.resolve({ result: "", sources: [] })),
    } as any,
    audioDir: "/tmp/test-audio",
    ...overrides,
  };
}

export function mockCatchUpDeps(
  overrides?: Partial<CatchUpAgentDeps>,
): CatchUpAgentDeps {
  return {
    notifyClient: mock(() => undefined),
    findPreviousSession: mock(() => Promise.resolve(null)),
    findPreferencesByUserId: mock(() => Promise.resolve(null)),
    markCatchUpDelivered: mock(() =>
      Promise.resolve({
        id: "s1",
        userId: "u1",
        startedAt: new Date(),
        endedAt: null,
        catchUpDelivered: true,
      }),
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
      }),
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
