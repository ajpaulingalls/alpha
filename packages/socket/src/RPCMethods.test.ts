import { describe, expect, test } from "bun:test";
import {
  RPC_SHOW_TOPIC,
  RPC_SHOW_PODCAST,
  RPC_SHOW_PROGRESS,
  RPC_SHOW_MODE,
  RPC_SHOW_LOADING,
  RPC_SHOW_TRANSCRIPT,
} from "./RPCMethods";

const ALL_METHODS = [
  RPC_SHOW_TOPIC,
  RPC_SHOW_PODCAST,
  RPC_SHOW_PROGRESS,
  RPC_SHOW_MODE,
  RPC_SHOW_LOADING,
  RPC_SHOW_TRANSCRIPT,
];

describe("RPCMethods", () => {
  test("all method constants are non-empty strings", () => {
    for (const method of ALL_METHODS) {
      expect(typeof method).toBe("string");
      expect(method.length).toBeGreaterThan(0);
    }
  });

  test("all method constants use the client. prefix", () => {
    for (const method of ALL_METHODS) {
      expect(method.startsWith("client.")).toBe(true);
    }
  });

  test("all method constants are unique", () => {
    const unique = new Set(ALL_METHODS);
    expect(unique.size).toBe(ALL_METHODS.length);
  });
});
