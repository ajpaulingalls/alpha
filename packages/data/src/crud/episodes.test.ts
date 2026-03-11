/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";

function createMockResult(data: any[]) {
  const chain: Record<string, any> = {};
  const methods = [
    "from",
    "where",
    "orderBy",
    "limit",
    "set",
    "values",
    "returning",
    "leftJoin",
  ];
  for (const m of methods) {
    chain[m] = mock(() => {
      if (m === "returning") return Promise.resolve(data);
      return chain;
    });
  }
  chain.then = (resolve: (v: any) => any) =>
    Promise.resolve(data).then(resolve);
  return chain;
}

let mockSelectResult: any[] = [];
let mockInsertResult: any[] = [];

const mockDb = {
  select: mock(() => createMockResult(mockSelectResult)),
  insert: mock(() => createMockResult(mockInsertResult)),
};

mock.module("../client", () => ({ db: mockDb }));

const {
  createEpisode,
  findEpisodesByShow,
  findLatestEpisode,
  findEpisodeById,
  findExistingEpisodeIds,
  findRecentEpisodes,
  findNewEpisodesForUser,
} = await import("./episodes");

describe("episodes CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
  });

  test("createEpisode returns created episode", async () => {
    const episode: any = { id: "e1", showName: "Test Show", title: "Ep 1" };
    mockInsertResult = [episode];
    const result = await createEpisode({
      showName: "Test Show",
      title: "Ep 1",
    });
    expect(result).toEqual(episode);
  });

  test("findEpisodesByShow returns array of episodes", async () => {
    const episodes: any[] = [
      { id: "e1", showName: "Test Show" },
      { id: "e2", showName: "Test Show" },
    ];
    mockSelectResult = episodes;
    const result = await findEpisodesByShow("Test Show");
    expect(result).toEqual(episodes);
  });

  test("findEpisodesByShow returns empty array when none found", async () => {
    mockSelectResult = [];
    const result = await findEpisodesByShow("Missing Show");
    expect(result).toEqual([]);
  });

  test("findLatestEpisode returns episode when found", async () => {
    const episode: any = { id: "e1", showName: "Test Show" };
    mockSelectResult = [episode];
    const result = await findLatestEpisode("Test Show");
    expect(result).toEqual(episode);
  });

  test("findLatestEpisode returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findLatestEpisode("Missing Show");
    expect(result).toBeNull();
  });

  test("findEpisodeById returns episode when found", async () => {
    const episode: any = { id: "e1", title: "Ep 1" };
    mockSelectResult = [episode];
    const result = await findEpisodeById("e1");
    expect(result).toEqual(episode);
  });

  test("findEpisodeById returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findEpisodeById("missing");
    expect(result).toBeNull();
  });

  test("findExistingEpisodeIds returns IDs that exist", async () => {
    mockSelectResult = [{ id: "e1" }, { id: "e3" }];
    const result = await findExistingEpisodeIds(["e1", "e2", "e3"]);
    expect(result).toEqual(["e1", "e3"]);
  });

  test("findExistingEpisodeIds returns empty array for empty input", async () => {
    const result = await findExistingEpisodeIds([]);
    expect(result).toEqual([]);
  });

  test("findRecentEpisodes returns episodes after given date", async () => {
    const episodes: any[] = [
      { id: "e1", publishedAt: new Date("2025-01-02") },
      { id: "e2", publishedAt: new Date("2025-01-03") },
    ];
    mockSelectResult = episodes;
    const result = await findRecentEpisodes(new Date("2025-01-01"));
    expect(result).toEqual(episodes);
  });

  test("findRecentEpisodes returns empty array when none found", async () => {
    mockSelectResult = [];
    const result = await findRecentEpisodes(new Date("2025-01-01"));
    expect(result).toEqual([]);
  });

  test("findNewEpisodesForUser returns unheard episodes", async () => {
    const episodes: any[] = [
      { id: "e1", title: "New Episode" },
      { id: "e2", title: "Another New Episode" },
    ];
    mockSelectResult = episodes;
    const result = await findNewEpisodesForUser("user-123");
    expect(result).toEqual(episodes);
  });

  test("findNewEpisodesForUser returns empty array when all heard", async () => {
    mockSelectResult = [];
    const result = await findNewEpisodesForUser("user-123");
    expect(result).toEqual([]);
  });

  test("findNewEpisodesForUser accepts optional since date", async () => {
    mockSelectResult = [];
    const result = await findNewEpisodesForUser(
      "user-123",
      new Date("2025-01-01")
    );
    expect(result).toEqual([]);
  });
});
