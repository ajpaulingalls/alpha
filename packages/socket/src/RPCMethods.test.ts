import { describe, expect, test } from "bun:test";
import {
  RPC_SHOW_TOPIC,
  RPC_SHOW_PODCAST,
  RPC_SHOW_PROGRESS,
  RPC_SHOW_MODE,
  RPC_SHOW_LOADING,
  RPC_SHOW_TRANSCRIPT,
  RPC_TOGGLE_PLAYBACK,
  RPC_SKIP_FORWARD,
} from "./RPCMethods";

const CLIENT_METHODS = [
  RPC_SHOW_TOPIC,
  RPC_SHOW_PODCAST,
  RPC_SHOW_PROGRESS,
  RPC_SHOW_MODE,
  RPC_SHOW_LOADING,
  RPC_SHOW_TRANSCRIPT,
];

const AGENT_METHODS = [RPC_TOGGLE_PLAYBACK, RPC_SKIP_FORWARD];

const ALL_METHODS = [...CLIENT_METHODS, ...AGENT_METHODS];

describe("RPCMethods", () => {
  test("all method constants are non-empty strings", () => {
    for (const method of ALL_METHODS) {
      expect(typeof method).toBe("string");
      expect(method.length).toBeGreaterThan(0);
    }
  });

  test("client methods use the client. prefix", () => {
    for (const method of CLIENT_METHODS) {
      expect(method.startsWith("client.")).toBe(true);
    }
  });

  test("agent methods use the agent. prefix", () => {
    for (const method of AGENT_METHODS) {
      expect(method.startsWith("agent.")).toBe(true);
    }
  });

  test("all method constants are unique", () => {
    const unique = new Set(ALL_METHODS);
    expect(unique.size).toBe(ALL_METHODS.length);
  });
});
