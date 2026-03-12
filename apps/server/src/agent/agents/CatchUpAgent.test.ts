/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, mock } from "bun:test";
import {
  CatchUpAgent,
  buildBriefingInstructions,
  type CatchUpAgentDeps,
} from "./CatchUpAgent";
import { BrowseAgent } from "./BrowseAgent";
import { mockCatchUpDeps } from "./test-helpers";

describe("buildBriefingInstructions", () => {
  test("hoursSince < 2 returns quick update language", () => {
    const result = buildBriefingInstructions(1, "standard");
    expect(result).toContain("quick update");
  });

  test("2 <= hoursSince < 24 returns standard briefing language", () => {
    const result = buildBriefingInstructions(12, "standard");
    expect(result).toContain("standard briefing");
  });

  test("hoursSince >= 24 returns full recap language", () => {
    const result = buildBriefingInstructions(48, "standard");
    expect(result).toContain("full recap");
  });

  test("depth = brief includes concise language", () => {
    const result = buildBriefingInstructions(12, "brief");
    expect(result).toContain("concise");
  });

  test("depth = detailed includes depth language", () => {
    const result = buildBriefingInstructions(12, "detailed");
    expect(result).toContain("in depth");
  });

  test("includes userName when provided", () => {
    const result = buildBriefingInstructions(12, "standard", "Alice");
    expect(result).toContain("Alice");
  });
});

describe("CatchUpAgent", () => {
  test("create() returns a CatchUpAgent instance", () => {
    const agent = CatchUpAgent.create(mockCatchUpDeps());
    expect(agent).toBeInstanceOf(CatchUpAgent);
  });

  test("create() has correct tool names", () => {
    const agent = CatchUpAgent.create(mockCatchUpDeps());
    const toolNames = Object.keys(agent.toolCtx);
    expect(toolNames).toContain("fetchTopStories");
    expect(toolNames).toContain("fetchWireHighlights");
    expect(toolNames).toContain("fetchNewPodcasts");
    expect(toolNames).toContain("completeBriefing");
    expect(toolNames).toContain("endSession");
  });
});

describe("completeBriefing tool", () => {
  let deps: CatchUpAgentDeps;

  beforeEach(() => {
    deps = mockCatchUpDeps();
  });

  test("calls markCatchUpDelivered with sessionId", async () => {
    const agent = CatchUpAgent.create(deps);
    const tool = agent.toolCtx["completeBriefing"];
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    await tool.execute({ episodeIds: [] }, { ctx, toolCallId: "t1" } as any);

    expect(deps.markCatchUpDelivered).toHaveBeenCalledWith("s1", "u1");
  });

  test("calls recordListen for each episodeId", async () => {
    const agent = CatchUpAgent.create(deps);
    const tool = agent.toolCtx["completeBriefing"];
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    await tool.execute(
      {
        episodeIds: [
          "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
          "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2",
        ],
      },
      { ctx, toolCallId: "t1" } as any
    );

    expect(deps.recordListen).toHaveBeenCalledTimes(2);
    expect(deps.recordListen).toHaveBeenCalledWith(
      "s1",
      "u1",
      "episode",
      "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1"
    );
    expect(deps.recordListen).toHaveBeenCalledWith(
      "s1",
      "u1",
      "episode",
      "e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2"
    );
  });

  test("handles empty episodeIds without calling recordListen", async () => {
    const agent = CatchUpAgent.create(deps);
    const tool = agent.toolCtx["completeBriefing"];
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    await tool.execute({ episodeIds: [] }, { ctx, toolCallId: "t1" } as any);

    expect(deps.recordListen).not.toHaveBeenCalled();
  });

  test("only records listens for valid episode IDs", async () => {
    const validId = "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1";
    const fakeId = "f0f0f0f0-f0f0-f0f0-f0f0-f0f0f0f0f0f0";
    deps.findExistingEpisodeIds = mock(() => Promise.resolve([validId]));

    const agent = CatchUpAgent.create(deps);
    const tool = agent.toolCtx["completeBriefing"];
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    await tool.execute({ episodeIds: [validId, fakeId] }, {
      ctx,
      toolCallId: "t1",
    } as any);

    expect(deps.findExistingEpisodeIds).toHaveBeenCalledWith([validId, fakeId]);
    expect(deps.recordListen).toHaveBeenCalledTimes(1);
    expect(deps.recordListen).toHaveBeenCalledWith(
      "s1",
      "u1",
      "episode",
      validId
    );
  });

  test("returns an llm.handoff result with BrowseAgent", async () => {
    const agent = CatchUpAgent.create(deps);
    const tool = agent.toolCtx["completeBriefing"];
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    const result = await tool.execute({ episodeIds: [] }, {
      ctx,
      toolCallId: "t1",
    } as any);

    expect(result).toBeDefined();
    expect(result.agent).toBeInstanceOf(BrowseAgent);
    expect(result.returns).toBeDefined();
  });
});
