/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "bun:test";
import { PlaybackAgent } from "./PlaybackAgent";
import { BrowseAgent } from "./BrowseAgent";
import { mockPlaybackDeps } from "./test-helpers";

describe("PlaybackAgent", () => {
  test("create() returns a PlaybackAgent instance", () => {
    const agent = PlaybackAgent.create(mockPlaybackDeps());
    expect(agent).toBeInstanceOf(PlaybackAgent);
  });

  test("create() has endPlayback tool", () => {
    const agent = PlaybackAgent.create(mockPlaybackDeps());
    const toolNames = Object.keys(agent.toolCtx);
    expect(toolNames).toContain("endPlayback");
    expect(toolNames).toHaveLength(1);
  });

  test("instructions contain episode title", () => {
    const agent = PlaybackAgent.create(
      mockPlaybackDeps({ episodeTitle: "Gaza Update" })
    );
    expect(agent.instructions).toContain("Gaza Update");
  });

  test("endPlayback tool returns llm.handoff with BrowseAgent", async () => {
    const agent = PlaybackAgent.create(mockPlaybackDeps());
    const tool = agent.toolCtx["endPlayback"];

    const result = await tool.execute({}, {
      ctx: { userData: { userId: "u1", sessionId: "s1" } },
      toolCallId: "t1",
    } as any);

    expect(result).toBeDefined();
    expect(result.agent).toBeInstanceOf(BrowseAgent);
    expect(result.returns).toContain("Test Episode");
  });
});
