/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { z } from "zod";
import { createSearchPodcastsTool } from "./searchPodcasts";

const searchPodcastsSchema = z.object({
  query: z.string().min(1).max(500),
  showName: z.string().max(255).optional(),
});

const mockFindEpisodesByShow = mock(() =>
  Promise.resolve([
    {
      id: "e1",
      title: "The Take #100",
      showName: "The Take",
      description: "Desc",
      publishedAt: new Date("2025-01-01"),
      duration: 1800,
      sourceUrl: null,
      audioFilename: "take100.wav",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
);

const mockSearchTopics = mock(() =>
  Promise.resolve([
    {
      id: "t1",
      title: "Topic 1",
      summary: "Summary of topic",
      episodeId: "e1",
      distance: 0.15,
      filename: "t1.wav",
      embedding: null,
      startTime: 0,
      endTime: 120,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
);

const mockEmbed = mock(() => Promise.resolve([[0.1, 0.2, 0.3]]));

function buildDeps() {
  return {
    cortexClient: { embed: mockEmbed } as any,
    findEpisodesByShow: mockFindEpisodesByShow,
    searchTopicsByEmbedding: mockSearchTopics,
  };
}

describe("searchPodcasts tool", () => {
  beforeEach(() => {
    mockFindEpisodesByShow.mockClear();
    mockSearchTopics.mockClear();
    mockEmbed.mockClear();
  });

  test("schema accepts query only", () => {
    const result = searchPodcastsSchema.safeParse({ query: "conflict" });
    expect(result.success).toBe(true);
  });

  test("schema accepts query with showName", () => {
    const result = searchPodcastsSchema.safeParse({
      query: "latest",
      showName: "The Take",
    });
    expect(result.success).toBe(true);
  });

  test("schema rejects empty query", () => {
    const result = searchPodcastsSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  test("createSearchPodcastsTool returns a tool", () => {
    const tool = createSearchPodcastsTool(buildDeps());
    expect(tool).toBeDefined();
    expect(tool.description).toContain("podcast");
  });

  test("execute searches both episodes and topics when showName given", async () => {
    const tool = createSearchPodcastsTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute(
      { query: "latest news", showName: "The Take" },
      { ctx, toolCallId: "t1" } as any,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.topics).toHaveLength(1);
    expect(mockFindEpisodesByShow).toHaveBeenCalledWith("The Take", 10);
    expect(mockSearchTopics).toHaveBeenCalled();
  });

  test("execute skips episode lookup when no showName", async () => {
    const tool = createSearchPodcastsTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute(
      { query: "conflict", showName: undefined },
      { ctx, toolCallId: "t1" } as any,
    );
    const parsed = JSON.parse(result as string);
    expect(parsed.episodes).toHaveLength(0);
    expect(parsed.topics).toHaveLength(1);
    expect(mockFindEpisodesByShow).not.toHaveBeenCalled();
  });

  test("execute handles embed failure gracefully", async () => {
    mockEmbed.mockImplementationOnce(() => Promise.resolve([]));
    const tool = createSearchPodcastsTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ query: "test", showName: undefined }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.error).toContain("embedding");
  });
});
