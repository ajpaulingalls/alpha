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
  findPreferencesByUserId,
  createPreferences,
  updatePreferences,
  updatePreferencesJson,
} = await import("./preferences");

describe("preferences CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
    mockUpdateResult = [];
  });

  test("findPreferencesByUserId returns preferences when found", async () => {
    const prefs: any = { id: "1", userId: "u1", timezone: "US/Eastern" };
    mockSelectResult = [prefs];
    const result = await findPreferencesByUserId("u1");
    expect(result).toEqual(prefs);
  });

  test("findPreferencesByUserId returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findPreferencesByUserId("missing");
    expect(result).toBeNull();
  });

  test("createPreferences returns created preferences", async () => {
    const prefs: any = { id: "1", userId: "u1" };
    mockInsertResult = [prefs];
    const result = await createPreferences("u1");
    expect(result).toEqual(prefs);
  });

  test("createPreferences accepts optional timezone and catchUpDepth", async () => {
    const prefs: any = {
      id: "1",
      userId: "u1",
      timezone: "US/Pacific",
      catchUpDepth: "deep",
    };
    mockInsertResult = [prefs];
    const result = await createPreferences("u1", "US/Pacific", "deep");
    expect(result).toEqual(prefs);
  });

  test("updatePreferences returns updated preferences", async () => {
    const prefs: any = { id: "1", userId: "u1", timezone: "US/Central" };
    mockUpdateResult = [prefs];
    const result = await updatePreferences("u1", { timezone: "US/Central" });
    expect(result).toEqual(prefs);
  });

  test("updatePreferences throws when not found", async () => {
    mockUpdateResult = [];
    await expect(
      updatePreferences("missing", { timezone: "US/Central" })
    ).rejects.toThrow("not found");
  });

  test("updatePreferencesJson returns updated preferences", async () => {
    const prefs: any = {
      id: "1",
      userId: "u1",
      preferences: { theme: "dark" },
    };
    mockUpdateResult = [prefs];
    const result = await updatePreferencesJson("u1", { theme: "dark" });
    expect(result).toEqual(prefs);
  });

  test("updatePreferencesJson throws when not found", async () => {
    mockUpdateResult = [];
    await expect(
      updatePreferencesJson("missing", { theme: "dark" })
    ).rejects.toThrow("not found");
  });
});
