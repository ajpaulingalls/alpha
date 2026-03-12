import { describe, expect, test } from "bun:test";
import { ContentClient } from "./client.ts";
import {
  jsonResponse,
  fetchMock,
  fetchUrl,
  setupFetchMock,
} from "./test-helpers.ts";

// --- Helpers ---

function parseVariables(): Record<string, unknown> {
  const url = fetchUrl();
  const match = url.match(/variables=([^&]*)/) as RegExpMatchArray;
  return JSON.parse(decodeURIComponent(match[1])) as Record<string, unknown>;
}

setupFetchMock();

// --- Mock data ---

const MOCK_RAW_POST = {
  id: "123",
  title: "Test Article",
  excerpt: "A test excerpt",
  content: "<p>Full content here</p>",
  date: "2024-01-15T10:00:00Z",
  link: "https://www.aljazeera.com/news/2024/1/15/test-article",
  author: [{ name: "Jane Doe" }],
  featuredImage: { sourceUrl: "https://example.com/image.jpg" },
  categories: [{ name: "News" }],
  tags: [{ name: "World" }],
};

const EXPECTED_ARTICLE = {
  id: "123",
  title: "Test Article",
  excerpt: "A test excerpt",
  content: "<p>Full content here</p>",
  date: "2024-01-15T10:00:00Z",
  slug: "test-article",
  link: "https://www.aljazeera.com/news/2024/1/15/test-article",
  author: "Jane Doe",
  imageUrl: "https://example.com/image.jpg",
  categories: ["News"],
  tags: ["World"],
};

// --- Tests ---

describe("ContentClient", () => {
  describe("constructor", () => {
    test("accepts bare string URL and strips trailing slashes", () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql///");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      client.searchArticles("test");
      expect(fetchUrl()).toStartWith("https://www.aljazeera.com/graphql?");
    });

    test("accepts ContentClientConfig object", () => {
      const client = new ContentClient({
        graphqlUrl: "https://www.aljazeera.com/graphql/",
        timeoutMs: 5000,
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      client.searchArticles("test");
      expect(fetchUrl()).toStartWith("https://www.aljazeera.com/graphql?");
    });
  });

  describe("URL construction and headers", () => {
    test("uses GET method", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      await client.searchArticles("test");
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("GET");
    });

    test("includes wp-site, operationName, query, and extensions params", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      await client.searchArticles("test");
      const url = fetchUrl();
      expect(url).toContain("wp-site=aje");
      expect(url).toContain("operationName=SearchQuery");
      expect(url).toContain("query=");
      expect(url).toContain("extensions=%7B%7D");
    });

    test("encodes variables as JSON in query params", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { article: MOCK_RAW_POST } }),
      );
      await client.getArticle("test-slug");
      const vars = parseVariables();
      expect(vars.name).toBe("test-slug");
      expect(vars.postType).toBe("post");
    });

    test("includes wp-site and accept headers", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      await client.searchArticles("test");
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["wp-site"]).toBe("aje");
      expect(headers.accept).toBe("application/json");
    });
  });

  describe("searchArticles", () => {
    test("maps search results correctly", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            searchPosts: {
              items: [
                {
                  title: "Search Hit",
                  snippet: "A matching snippet",
                  link: "https://www.aljazeera.com/news/search-hit",
                  pagemap: {
                    cse_image: [{ src: "https://example.com/thumb.jpg" }],
                  },
                },
              ],
            },
          },
        }),
      );

      const results = await client.searchArticles("test query");
      expect(results).toEqual([
        {
          title: "Search Hit",
          snippet: "A matching snippet",
          link: "https://www.aljazeera.com/news/search-hit",
          imageUrl: "https://example.com/thumb.jpg",
          publishedAt: "",
        },
      ]);
    });

    test("handles missing pagemap gracefully", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            searchPosts: {
              items: [
                {
                  title: "No Image",
                  snippet: "No image here",
                  link: "https://www.aljazeera.com/news/no-image",
                },
              ],
            },
          },
        }),
      );

      const results = await client.searchArticles("test");
      expect(results[0].imageUrl).toBe("");
    });

    test("passes offset as start variable", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      await client.searchArticles("test", 20);
      expect(parseVariables().start).toBe(20);
    });

    test("omits start when offset is undefined", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { searchPosts: { items: [] } } }),
      );
      await client.searchArticles("test");
      expect(parseVariables().start).toBeUndefined();
    });
  });

  describe("getArticle", () => {
    test("maps article correctly", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { article: MOCK_RAW_POST } }),
      );

      const article = await client.getArticle("test-article");
      expect(article).toEqual(EXPECTED_ARTICLE);
    });

    test("returns null when article is not found", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { article: null } }),
      );

      const article = await client.getArticle("nonexistent");
      expect(article).toBeNull();
    });

    test("extracts slug from link", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            article: {
              ...MOCK_RAW_POST,
              link: "https://www.aljazeera.com/news/2024/1/15/some-slug/",
            },
          },
        }),
      );

      const article = await client.getArticle("some-slug");
      expect(article).not.toBeNull();
      expect((article as NonNullable<typeof article>).slug).toBe("some-slug");
    });

    test("uses ArchipelagoSingleArticleQuery operation name", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { article: MOCK_RAW_POST } }),
      );
      await client.getArticle("test");
      expect(fetchUrl()).toContain(
        "operationName=ArchipelagoSingleArticleQuery",
      );
    });

    test("handles missing featuredImage", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            article: { ...MOCK_RAW_POST, featuredImage: null },
          },
        }),
      );

      const article = await client.getArticle("test");
      expect(article).not.toBeNull();
      expect((article as NonNullable<typeof article>).imageUrl).toBe("");
    });

    test("handles empty author array", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            article: { ...MOCK_RAW_POST, author: [] },
          },
        }),
      );

      const article = await client.getArticle("test");
      expect(article).not.toBeNull();
      expect((article as NonNullable<typeof article>).author).toBe("");
    });
  });

  describe("getRecentArticles", () => {
    test("returns mapped articles", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      const { content: _, ...postWithoutContent } = MOCK_RAW_POST;
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { articles: [postWithoutContent] } }),
      );

      const articles = await client.getRecentArticles();
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Test Article");
    });

    test("defaults to quantity 10", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getRecentArticles();
      expect(parseVariables().quantity).toBe(10);
    });

    test("uses custom limit", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getRecentArticles(5);
      expect(parseVariables().quantity).toBe(5);
    });

    test("uses PostsQuery operation name with post type", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getRecentArticles();
      expect(fetchUrl()).toContain("operationName=PostsQuery");
      expect(parseVariables().postType).toBe("post");
    });
  });

  describe("getArticlesByCategory", () => {
    test("passes category and limit", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { articles: [MOCK_RAW_POST] } }),
      );
      const articles = await client.getArticlesByCategory("economy", 3);
      expect(articles).toHaveLength(1);

      expect(fetchUrl()).toContain("operationName=SectionPostsQuery");
      const vars = parseVariables();
      expect(vars.category).toBe("economy");
      expect(vars.quantity).toBe(3);
      expect(vars.categoryType).toBe("defined");
    });

    test("defaults to quantity 10", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getArticlesByCategory("news");
      expect(parseVariables().quantity).toBe(10);
    });
  });

  describe("getPodcastSeries", () => {
    test("maps series correctly", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            articles: [
              {
                id: "pod-1",
                title: "The Take",
                excerpt: "Daily podcast",
                featuredImage: {
                  sourceUrl: "https://example.com/take.jpg",
                },
              },
            ],
          },
        }),
      );

      const series = await client.getPodcastSeries();
      expect(series).toEqual([
        {
          id: "pod-1",
          title: "The Take",
          description: "Daily podcast",
          imageUrl: "https://example.com/take.jpg",
        },
      ]);
    });

    test("handles missing featuredImage", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            articles: [
              {
                id: "pod-1",
                title: "The Take",
                excerpt: "Daily podcast",
                featuredImage: null,
              },
            ],
          },
        }),
      );

      const series = await client.getPodcastSeries();
      expect(series[0].imageUrl).toBe("");
    });

    test("uses PodcastSeriesQuery operation name", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getPodcastSeries();
      expect(fetchUrl()).toContain("operationName=PodcastSeriesQuery");
    });

    test("defaults to quantity 50", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getPodcastSeries();
      expect(parseVariables().quantity).toBe(50);
    });

    test("uses custom limit", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getPodcastSeries(10);
      expect(parseVariables().quantity).toBe(10);
    });
  });

  describe("getEpisode", () => {
    test("maps episode correctly", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            articles: [
              {
                id: "ep-1",
                title: "Episode 42",
                excerpt: "Latest episode",
                date: "2024-01-20T08:00:00Z",
                audioPlaybackUrl: "https://example.com/ep42.mp3",
                audioDuration: "1800",
              },
            ],
          },
        }),
      );

      const episode = await client.getEpisode("the-take");
      expect(episode).toEqual({
        id: "ep-1",
        title: "Episode 42",
        description: "Latest episode",
        publishedAt: "2024-01-20T08:00:00Z",
        audioUrl: "https://example.com/ep42.mp3",
        duration: "1800",
      });
    });

    test("returns null for empty results", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));

      const episode = await client.getEpisode("nonexistent-series");
      expect(episode).toBeNull();
    });

    test("passes id as category variable", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: { articles: [] } }));
      await client.getEpisode("the-take");
      expect(fetchUrl()).toContain("operationName=EpisodeQuery");
      expect(parseVariables().category).toBe("the-take");
    });

    test("handles missing audio fields", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            articles: [
              {
                id: "ep-1",
                title: "Episode 42",
                excerpt: "No audio",
                date: "2024-01-20T08:00:00Z",
              },
            ],
          },
        }),
      );

      const episode = await client.getEpisode("the-take");
      expect(episode).not.toBeNull();
      const result = episode as NonNullable<typeof episode>;
      expect(result.audioUrl).toBe("");
      expect(result.duration).toBe("");
    });
  });

  describe("error handling", () => {
    test("throws on non-2xx HTTP status with response body", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        new Response("Something went wrong", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(client.searchArticles("test")).rejects.toThrow(
        "HTTP 500: Internal Server Error — Something went wrong",
      );
    });

    test("throws on GraphQL errors in response body", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: "Query not found" }],
        }),
      );

      await expect(client.searchArticles("test")).rejects.toThrow(
        "GraphQL error: Query not found",
      );
    });

    test("throws when no data returned", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: null }));

      await expect(client.searchArticles("test")).rejects.toThrow(
        'No data returned for query "SearchQuery"',
      );
    });

    test("throws on non-2xx for getArticle", async () => {
      const client = new ContentClient("https://www.aljazeera.com/graphql");
      fetchMock.mockResolvedValueOnce(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      await expect(client.getArticle("test")).rejects.toThrow("HTTP 401");
    });
  });
});
