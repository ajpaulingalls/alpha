import { describe, expect, test } from "bun:test";
import { BrowseAgent } from "./BrowseAgent";
import { mockBrowseDeps } from "./test-helpers";

describe("BrowseAgent", () => {
  test("create() returns a BrowseAgent instance", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    expect(agent).toBeInstanceOf(BrowseAgent);
  });

  test("create() has correct tool names", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    const toolNames = Object.keys(agent.toolCtx);
    expect(toolNames).toContain("searchContent");
    expect(toolNames).toContain("searchPodcasts");
    expect(toolNames).toContain("generateResponse");
    expect(toolNames).toContain("playPodcast");
    expect(toolNames).toContain("endSession");
    expect(toolNames).toHaveLength(5);
  });

  test("system prompt contains content resolution guidance", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    const instructions = agent.instructions;
    expect(instructions).toContain("Content Resolution Priority");
  });

  test("system prompt contains topic drift handling", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    const instructions = agent.instructions;
    expect(instructions).toContain("Topic Drift Handling");
  });

  test("system prompt contains tone guidance", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    const instructions = agent.instructions;
    expect(instructions).toContain("Warm, confident, and conversational");
  });

  test("system prompt contains session ending guidance", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    const instructions = agent.instructions;
    expect(instructions).toContain("Ending the Session");
    expect(instructions).toContain("endSession");
  });
});
