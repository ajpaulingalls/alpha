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

  test("create() has all 5 tools", () => {
    const agent = PlaybackAgent.create(mockPlaybackDeps());
    const toolNames = Object.keys(agent.toolCtx).sort();
    expect(toolNames).toEqual([
      "endPlayback",
      "pausePlayback",
      "resumePlayback",
      "searchContext",
      "skipTopic",
    ]);
  });

  test("instructions contain episode title", () => {
    const agent = PlaybackAgent.create(
      mockPlaybackDeps({ episodeTitle: "Gaza Update" })
    );
    expect(agent.instructions).toContain("Gaza Update");
  });

  test("instructions contain playback mode keywords", () => {
    const agent = PlaybackAgent.create(mockPlaybackDeps());
    expect(agent.instructions).toContain("playback mode");
    expect(agent.instructions).toContain("pausePlayback");
    expect(agent.instructions).toContain("resumePlayback");
    expect(agent.instructions).toContain("skipTopic");
    expect(agent.instructions).toContain("endPlayback");
    expect(agent.instructions).toContain("searchContext");
  });

  test("sanitizes episode title in instructions", () => {
    const agent = PlaybackAgent.create(
      mockPlaybackDeps({ episodeTitle: "Bad\nTitle\twith\rchars" })
    );
    expect(agent.instructions).toContain("Bad Title with chars");
    expect(agent.instructions).not.toContain("Bad\nTitle");
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
