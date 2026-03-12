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
    "onConflictDoUpdate",
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
  findUserByEmail,
  findUserById,
  upsertUserWithCode,
  updateUserValidation,
  clearVerificationCode,
  incrementFailedAttempts,
  updateUserName,
} = await import("./users");

describe("users CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
    mockUpdateResult = [];
  });

  test("findUserByEmail returns user when found", async () => {
    const user: any = { id: "1", email: "test@test.com", name: "Test" };
    mockSelectResult = [user];
    const result = await findUserByEmail("test@test.com");
    expect(result).toEqual(user);
  });

  test("findUserByEmail returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findUserByEmail("missing@test.com");
    expect(result).toBeNull();
  });

  test("findUserById returns user when found", async () => {
    const user: any = { id: "1", email: "test@test.com", name: "Test" };
    mockSelectResult = [user];
    const result = await findUserById("1");
    expect(result).toEqual(user);
  });

  test("findUserById returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findUserById("missing");
    expect(result).toBeNull();
  });

  test("updateUserValidation returns updated user", async () => {
    const user: any = { id: "1", email: "test@test.com", validated: true };
    mockUpdateResult = [user];
    const result = await updateUserValidation("test@test.com", true);
    expect(result).toEqual(user);
  });

  test("updateUserValidation throws when not found", async () => {
    mockUpdateResult = [];
    await expect(
      updateUserValidation("missing@test.com", true),
    ).rejects.toThrow("not found");
  });

  test("upsertUserWithCode returns user", async () => {
    const user: any = { id: "1", email: "test@test.com" };
    mockInsertResult = [user];
    const result = await upsertUserWithCode(
      "test@test.com",
      "hashed-code",
      new Date(),
    );
    expect(result).toEqual(user);
  });

  test("clearVerificationCode returns updated user", async () => {
    const user: any = { id: "1", email: "test@test.com" };
    mockUpdateResult = [user];
    const result = await clearVerificationCode("test@test.com");
    expect(result).toEqual(user);
  });

  test("clearVerificationCode throws when not found", async () => {
    mockUpdateResult = [];
    await expect(clearVerificationCode("missing@test.com")).rejects.toThrow(
      "not found",
    );
  });

  test("incrementFailedAttempts returns updated user", async () => {
    const user: any = { id: "1", email: "test@test.com", failedAttempts: 1 };
    mockUpdateResult = [user];
    const result = await incrementFailedAttempts("test@test.com");
    expect(result).toEqual(user);
  });

  test("incrementFailedAttempts throws when not found", async () => {
    mockUpdateResult = [];
    await expect(incrementFailedAttempts("missing@test.com")).rejects.toThrow(
      "not found",
    );
  });

  test("updateUserName returns updated user", async () => {
    const user: any = { id: "1", name: "New Name" };
    mockUpdateResult = [user];
    const result = await updateUserName("1", "New Name");
    expect(result).toEqual(user);
  });

  test("updateUserName throws when not found", async () => {
    mockUpdateResult = [];
    await expect(updateUserName("missing", "Name")).rejects.toThrow(
      "not found",
    );
  });
});
