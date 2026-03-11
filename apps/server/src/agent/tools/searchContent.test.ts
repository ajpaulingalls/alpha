/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { z } from "zod";
import { createSearchContentTool } from "./searchContent";

const searchContentSchema = z.object({
  query: z.string().min(1).max(500),
});

const mockSearchCachedResponses = mock(() =>
  Promise.resolve([
    {
      id: "cr1",
      contentType: "catch_up",
      responseText: "Cached response text",
      audioFilename: "cached.wav",
      sourceSummary: null,
      queryEmbedding: null,
      expiresAt: new Date("2026-01-01"),
      hitCount: 5,
      distance: 0.1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
);

const mockSearchTopics = mock(() =>
  Promise.resolve([
    {
      id: "t1",
      title: "Topic 1",
      summary: "Topic summary",
      filename: "topic.wav",
      episodeId: "e1",
      embedding: null,
      startTime: 0,
      endTime: 120,
      distance: 0.2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
);

const mockSearchArticles = mock(() =>
  Promise.resolve([
    {
      title: "Article Title",
      snippet: "Article snippet",
      link: "https://example.com/article",
      imageUrl: "https://example.com/img.jpg",
      publishedAt: "2025-01-01",
    },
  ])
);

const mockEmbed = mock(() => Promise.resolve([[0.1, 0.2, 0.3]]));

function buildDeps() {
  return {
    cortexClient: { embed: mockEmbed } as any,
    contentClient: { searchArticles: mockSearchArticles } as any,
    searchCachedResponses: mockSearchCachedResponses,
    searchTopicsByEmbedding: mockSearchTopics,
  };
}

describe("searchContent tool", () => {
  beforeEach(() => {
    mockSearchCachedResponses.mockClear();
    mockSearchTopics.mockClear();
    mockSearchArticles.mockClear();
    mockEmbed.mockClear();
  });

  test("schema accepts valid query", () => {
    const result = searchContentSchema.safeParse({ query: "Sudan conflict" });
    expect(result.success).toBe(true);
  });

  test("schema rejects empty query", () => {
    const result = searchContentSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  test("createSearchContentTool returns a tool", () => {
    const tool = createSearchContentTool(buildDeps());
    expect(tool).toBeDefined();
    expect(tool.description).toContain("content");
  });

  test("execute runs all searches in parallel", async () => {
    const tool = createSearchContentTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ query: "Sudan conflict" }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);

    expect(mockEmbed).toHaveBeenCalledWith("Sudan conflict");
    expect(mockSearchCachedResponses).toHaveBeenCalled();
    expect(mockSearchTopics).toHaveBeenCalled();
    expect(mockSearchArticles).toHaveBeenCalledWith("Sudan conflict");

    expect(parsed.results).toHaveLength(3);
    expect(parsed.results[0].contentType).toBe("cached_response");
    expect(parsed.results[1].contentType).toBe("podcast_topic");
    expect(parsed.results[2].contentType).toBe("article");
  });

  test("execute includes queryEmbedding in result", async () => {
    const tool = createSearchContentTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ query: "test" }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.queryEmbedding).toEqual([0.1, 0.2, 0.3]);
  });

  test("execute returns articles and error on embed failure", async () => {
    mockEmbed.mockImplementationOnce(() => Promise.resolve([]));
    const tool = createSearchContentTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ query: "test" }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.queryEmbedding).toEqual([]);
    expect(parsed.error).toContain("embedding");
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].contentType).toBe("article");
    expect(mockSearchCachedResponses).not.toHaveBeenCalled();
    expect(mockSearchTopics).not.toHaveBeenCalled();
  });

  test("results are priority-ordered: cached > topics > articles", async () => {
    const tool = createSearchContentTool(buildDeps());
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ query: "test" }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    const types = parsed.results.map((r: any) => r.contentType);
    expect(types).toEqual(["cached_response", "podcast_topic", "article"]);
  });
});
