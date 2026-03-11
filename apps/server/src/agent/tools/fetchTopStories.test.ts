/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { z } from "zod";
import { createFetchTopStoriesTool } from "./fetchTopStories";

const fetchTopStoriesSchema = z.object({
  since: z.string().datetime().optional(),
});

const mockGetRecentArticles = mock(() =>
  Promise.resolve([
    {
      id: "a1",
      title: "Article 1",
      excerpt: "Excerpt",
      content: "Content",
      date: "2025-01-01",
      slug: "article-1",
      link: "https://example.com/article-1",
      author: "Author",
      imageUrl: "https://example.com/img.jpg",
      categories: ["World"],
      tags: ["news"],
    },
  ])
);

const mockFindRecentEpisodes = mock(() =>
  Promise.resolve([
    {
      id: "e1",
      title: "Episode 1",
      showName: "Alpha Daily",
      description: "Desc",
      publishedAt: new Date("2025-01-01"),
      duration: 600,
      sourceUrl: null,
      audioFilename: "ep1.wav",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ])
);

describe("fetchTopStories tool", () => {
  beforeEach(() => {
    mockGetRecentArticles.mockClear();
    mockFindRecentEpisodes.mockClear();
  });

  test("schema accepts valid params", () => {
    const result = fetchTopStoriesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("schema accepts since param", () => {
    const result = fetchTopStoriesSchema.safeParse({
      since: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("createFetchTopStoriesTool returns a tool", () => {
    const tool = createFetchTopStoriesTool({
      contentClient: { getRecentArticles: mockGetRecentArticles } as any,
      findRecentEpisodes: mockFindRecentEpisodes,
    });
    expect(tool).toBeDefined();
    expect(tool.description).toContain("stories");
  });

  test("execute fetches articles and episodes in parallel", async () => {
    const tool = createFetchTopStoriesTool({
      contentClient: { getRecentArticles: mockGetRecentArticles } as any,
      findRecentEpisodes: mockFindRecentEpisodes,
    });
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ since: undefined }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.articles).toHaveLength(1);
    expect(parsed.articles[0].title).toBe("Article 1");
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.episodes[0].title).toBe("Episode 1");
    expect(mockGetRecentArticles).toHaveBeenCalledWith(10);
    expect(mockFindRecentEpisodes).toHaveBeenCalled();
  });
});
