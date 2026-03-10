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
  createSession,
  findSessionById,
  endSession,
  findLatestSession,
  markCatchUpDelivered,
} = await import("./sessions");

describe("sessions CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
    mockUpdateResult = [];
  });

  test("createSession returns created session", async () => {
    const session: any = { id: "s1", userId: "u1", startedAt: new Date() };
    mockInsertResult = [session];
    const result = await createSession("u1");
    expect(result).toEqual(session);
  });

  test("findSessionById returns session when found", async () => {
    const session: any = { id: "s1", userId: "u1", startedAt: new Date() };
    mockSelectResult = [session];
    const result = await findSessionById("s1");
    expect(result).toEqual(session);
  });

  test("findSessionById returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findSessionById("missing");
    expect(result).toBeNull();
  });

  test("endSession returns ended session", async () => {
    const session: any = { id: "s1", userId: "u1", endedAt: new Date() };
    mockUpdateResult = [session];
    const result = await endSession("s1");
    expect(result).toEqual(session);
  });

  test("endSession throws when not found", async () => {
    mockUpdateResult = [];
    await expect(endSession("missing")).rejects.toThrow("not found");
  });

  test("findLatestSession returns session when found", async () => {
    const session: any = { id: "s1", userId: "u1", startedAt: new Date() };
    mockSelectResult = [session];
    const result = await findLatestSession("u1");
    expect(result).toEqual(session);
  });

  test("findLatestSession returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findLatestSession("missing");
    expect(result).toBeNull();
  });

  test("markCatchUpDelivered returns updated session", async () => {
    const session: any = { id: "s1", catchUpDelivered: true };
    mockUpdateResult = [session];
    const result = await markCatchUpDelivered("s1");
    expect(result).toEqual(session);
  });

  test("markCatchUpDelivered throws when not found", async () => {
    mockUpdateResult = [];
    await expect(markCatchUpDelivered("missing")).rejects.toThrow("not found");
  });
});
