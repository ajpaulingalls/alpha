/* eslint-disable @typescript-eslint/no-explicit-any */
import { mock } from "bun:test";
import type { CatchUpAgentDeps } from "./CatchUpAgent";

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
    ...overrides,
  };
}
