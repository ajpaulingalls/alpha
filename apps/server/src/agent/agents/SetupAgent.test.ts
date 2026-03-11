import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { SetupAgent } from "./SetupAgent";
import { mockCatchUpDeps } from "./test-helpers";

const nameSchema = z.object({
  name: z.string().trim().min(1).max(100).describe("The user's first name"),
});

describe("SetupAgent", () => {
  test("create() returns a SetupAgent instance", () => {
    const agent = SetupAgent.create(mockCatchUpDeps());
    expect(agent).toBeInstanceOf(SetupAgent);
  });
});

describe("SetupAgent recordName schema", () => {
  test("accepts valid name", () => {
    const result = nameSchema.safeParse({ name: "Alice" });
    expect(result.success).toBe(true);
  });

  test("rejects empty name", () => {
    const result = nameSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  test("rejects whitespace-only name", () => {
    const result = nameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  test("rejects name exceeding 100 characters", () => {
    const result = nameSchema.safeParse({ name: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  test("rejects missing name field", () => {
    const result = nameSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
