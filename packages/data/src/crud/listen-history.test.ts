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
let mockUpdateResult: any[] = [];

const mockDb = {
  select: mock(() => createMockResult(mockSelectResult)),
  insert: mock(() => createMockResult(mockInsertResult)),
  update: mock(() => createMockResult(mockUpdateResult)),
};

mock.module("../client", () => ({ db: mockDb }));

const {
  recordListen,
  updateCompletedPercent,
  findRecentListens,
  hasUserHeard,
} = await import("./listen-history");

describe("listen-history CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
    mockUpdateResult = [];
  });

  test("recordListen returns created entry", async () => {
    const entry: any = {
      id: "lh1",
      sessionId: "s1",
      userId: "u1",
      contentType: "topic",
      contentId: "t1",
    };
    mockInsertResult = [entry];
    const result = await recordListen("s1", "u1", "topic", "t1");
    expect(result).toEqual(entry);
  });

  test("updateCompletedPercent returns updated entry", async () => {
    const entry: any = { id: "lh1", completedPercent: 75 };
    mockUpdateResult = [entry];
    const result = await updateCompletedPercent("lh1", 75);
    expect(result).toEqual(entry);
  });

  test("updateCompletedPercent throws when not found", async () => {
    mockUpdateResult = [];
    await expect(updateCompletedPercent("missing", 50)).rejects.toThrow(
      "not found",
    );
  });

  test("findRecentListens returns array of entries", async () => {
    const entries: any[] = [
      { id: "lh1", userId: "u1" },
      { id: "lh2", userId: "u1" },
    ];
    mockSelectResult = entries;
    const result = await findRecentListens("u1", new Date("2024-01-01"));
    expect(result).toEqual(entries);
  });

  test("findRecentListens returns empty array when none found", async () => {
    mockSelectResult = [];
    const result = await findRecentListens("u1", new Date("2024-01-01"));
    expect(result).toEqual([]);
  });

  test("hasUserHeard returns true when entry exists", async () => {
    mockSelectResult = [{ id: "lh1" }];
    const result = await hasUserHeard("u1", "topic", "t1");
    expect(result).toBe(true);
  });

  test("hasUserHeard returns false when no entry exists", async () => {
    mockSelectResult = [];
    const result = await hasUserHeard("u1", "topic", "t1");
    expect(result).toBe(false);
  });
});
