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
let mockDeleteResult: any[] = [];

const mockDb = {
  select: mock(() => createMockResult(mockSelectResult)),
  insert: mock(() => createMockResult(mockInsertResult)),
  update: mock(() => createMockResult(mockUpdateResult)),
  delete: mock(() => createMockResult(mockDeleteResult)),
};

mock.module("../client", () => ({ db: mockDb }));

const {
  createCachedResponse,
  searchCachedResponses,
  incrementHitCount,
  deleteExpired,
} = await import("./cached-responses");

describe("cached-responses CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
    mockUpdateResult = [];
    mockDeleteResult = [];
  });

  test("createCachedResponse returns created response", async () => {
    const response: any = { id: "cr1", responseText: "Hello", hitCount: 0 };
    mockInsertResult = [response];
    const result = await createCachedResponse({ responseText: "Hello" });
    expect(result).toEqual(response);
  });

  test("searchCachedResponses accepts embedding and returns results", async () => {
    const responses: any[] = [
      { id: "cr1", responseText: "Hello", distance: 0.05 },
    ];
    mockSelectResult = responses;
    const embedding = new Array(1536).fill(0.1);
    const result = await searchCachedResponses(embedding, 0.3, 5);
    expect(result).toEqual(responses);
  });

  test("searchCachedResponses returns empty array when no matches", async () => {
    mockSelectResult = [];
    const embedding = new Array(1536).fill(0.1);
    const result = await searchCachedResponses(embedding, 0.3);
    expect(result).toEqual([]);
  });

  test("incrementHitCount returns updated response", async () => {
    const response: any = { id: "cr1", hitCount: 1 };
    mockUpdateResult = [response];
    const result = await incrementHitCount("cr1");
    expect(result).toEqual(response);
  });

  test("incrementHitCount throws when not found", async () => {
    mockUpdateResult = [];
    await expect(incrementHitCount("missing")).rejects.toThrow("not found");
  });

  test("deleteExpired returns count of deleted rows", async () => {
    mockDeleteResult = [{ id: "cr1" }, { id: "cr2" }];
    const result = await deleteExpired();
    expect(result).toBe(2);
  });

  test("deleteExpired returns 0 when nothing expired", async () => {
    mockDeleteResult = [];
    const result = await deleteExpired();
    expect(result).toBe(0);
  });
});
