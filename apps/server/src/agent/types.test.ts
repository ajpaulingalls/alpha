import { describe, expect, test } from "bun:test";
import { isNewUser } from "./types";

describe("isNewUser", () => {
  test("returns true for null user", () => {
    expect(isNewUser(null)).toBe(true);
  });

  test("returns true for empty name", () => {
    expect(isNewUser({ name: "" })).toBe(true);
  });

  test("returns true for whitespace-only name", () => {
    expect(isNewUser({ name: "  " })).toBe(true);
  });

  test("returns false for user with name", () => {
    expect(isNewUser({ name: "Alice" })).toBe(false);
  });
});
