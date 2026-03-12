import { describe, expect, test } from "bun:test";
import { OmnyClient } from "./omny-client.ts";
import {
  jsonResponse,
  fetchMock,
  fetchUrl,
  fetchInit,
  setupFetchMock,
} from "./test-helpers.ts";

setupFetchMock();

// --- Mock data ---

const MOCK_RAW_PROGRAM = {
  Id: "prog-1",
  Name: "The Take",
  Slug: "the-take",
  Description: "A daily podcast",
  DescriptionHtml: "<p>A daily podcast</p>",
  ArtworkUrl: "https://example.com/artwork.jpg",
  Author: "Al Jazeera",
  Categories: ["News", "Politics"],
};

const EXPECTED_PROGRAM = {
  id: "prog-1",
  name: "The Take",
  slug: "the-take",
  description: "A daily podcast",
  artworkUrl: "https://example.com/artwork.jpg",
  author: "Al Jazeera",
  categories: ["News", "Politics"],
};

const MOCK_RAW_CLIP = {
  Id: "clip-1",
  Title: "Episode 42",
  Slug: "episode-42",
  Description: "About something important",
  Summary: "Short summary",
  ImageUrl: "https://example.com/ep42.jpg",
  AudioUrl: "https://example.com/ep42.mp3",
  DurationSeconds: 1800.5,
  PublishedUtc: "2024-01-20T08:00:00Z",
  ProgramId: "prog-1",
  ProgramSlug: "the-take",
  EpisodeType: "Full",
  Season: 2,
  Episode: 42,
  ShareUrl: "https://omny.fm/shows/the-take/episode-42",
  Tags: ["world", "politics"],
};

const EXPECTED_CLIP = {
  id: "clip-1",
  title: "Episode 42",
  slug: "episode-42",
  description: "About something important",
  summary: "Short summary",
  imageUrl: "https://example.com/ep42.jpg",
  audioUrl: "https://example.com/ep42.mp3",
  durationSeconds: 1800.5,
  publishedUtc: "2024-01-20T08:00:00Z",
  programId: "prog-1",
  programSlug: "the-take",
  episodeType: "Full",
  season: 2,
  episode: 42,
  shareUrl: "https://omny.fm/shows/the-take/episode-42",
  tags: ["world", "politics"],
};

// --- Tests ---

describe("OmnyClient", () => {
  describe("constructor", () => {
    test("accepts bare string orgId", () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      client.getPrograms();
      expect(fetchUrl()).toStartWith("https://api.omny.fm/orgs/org-123/");
    });

    test("accepts config object", () => {
      const client = new OmnyClient({
        orgId: "org-123",
        baseUrl: "https://custom.api.com/",
        timeoutMs: 5000,
      });
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      client.getPrograms();
      expect(fetchUrl()).toStartWith("https://custom.api.com/orgs/org-123/");
    });

    test("strips trailing slashes from baseUrl", () => {
      const client = new OmnyClient({
        orgId: "org-123",
        baseUrl: "https://custom.api.com///",
      });
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      client.getPrograms();
      expect(fetchUrl()).toStartWith("https://custom.api.com/orgs/");
    });

    test("defaults to https://api.omny.fm when no baseUrl provided", () => {
      const client = new OmnyClient({ orgId: "org-123" });
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      client.getPrograms();
      expect(fetchUrl()).toStartWith("https://api.omny.fm/");
    });
  });

  describe("headers", () => {
    test("includes accept header", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      await client.getPrograms();
      const headers = fetchInit().headers as Record<string, string>;
      expect(headers.accept).toBe("application/json");
    });

    test("does not include authorization header", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      await client.getPrograms();
      const headers = fetchInit().headers as Record<string, string>;
      expect(headers.authorization).toBeUndefined();
    });

    test("uses GET method", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      await client.getPrograms();
      expect(fetchInit().method).toBe("GET");
    });
  });

  describe("getPrograms", () => {
    test("fetches correct URL with orgId", async () => {
      const client = new OmnyClient("org-abc");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      await client.getPrograms();
      expect(fetchUrl()).toBe("https://api.omny.fm/orgs/org-abc/programs");
    });

    test("maps PascalCase to camelCase", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Programs: [MOCK_RAW_PROGRAM] }),
      );
      const programs = await client.getPrograms();
      expect(programs).toEqual([EXPECTED_PROGRAM]);
    });

    test("returns empty array for no programs", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse({ Programs: [] }));
      const programs = await client.getPrograms();
      expect(programs).toEqual([]);
    });
  });

  describe("getClips", () => {
    test("fetches correct slug-based URL", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      await client.getClips("the-take");
      expect(fetchUrl()).toBe(
        "https://api.omny.fm/programs/the-take/clips?pageSize=10",
      );
    });

    test("defaults pageSize to 10", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      await client.getClips("the-take");
      expect(fetchUrl()).toContain("pageSize=10");
    });

    test("uses custom pageSize", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      await client.getClips("the-take", { pageSize: 25 });
      expect(fetchUrl()).toContain("pageSize=25");
    });

    test("passes cursor as query parameter", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      await client.getClips("the-take", { cursor: "abc123" });
      expect(fetchUrl()).toContain("cursor=abc123");
    });

    test("maps PascalCase to camelCase", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          Clips: [MOCK_RAW_CLIP],
          Cursor: "next-page",
          TotalCount: 42,
        }),
      );
      const result = await client.getClips("the-take");
      expect(result).toEqual({
        clips: [EXPECTED_CLIP],
        cursor: "next-page",
        totalCount: 42,
      });
    });

    test("returns empty clips with null cursor", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      const result = await client.getClips("the-take");
      expect(result).toEqual({
        clips: [],
        cursor: null,
        totalCount: 0,
      });
    });
  });

  describe("getClip", () => {
    test("fetches correct URL with programSlug and clipSlug", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse(MOCK_RAW_CLIP));
      await client.getClip("the-take", "episode-42");
      expect(fetchUrl()).toBe(
        "https://api.omny.fm/programs/the-take/clips/episode-42",
      );
    });

    test("maps PascalCase to camelCase", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(jsonResponse(MOCK_RAW_CLIP));
      const clip = await client.getClip("the-take", "episode-42");
      expect(clip).toEqual(EXPECTED_CLIP);
    });

    test("handles nullable fields", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          ...MOCK_RAW_CLIP,
          Summary: null,
          ImageUrl: null,
          Season: null,
          Episode: null,
          ShareUrl: null,
          Tags: null,
        }),
      );
      const clip = await client.getClip("the-take", "episode-42");
      expect(clip.summary).toBeNull();
      expect(clip.imageUrl).toBeNull();
      expect(clip.season).toBeNull();
      expect(clip.episode).toBeNull();
      expect(clip.shareUrl).toBeNull();
      expect(clip.tags).toBeNull();
    });
  });

  describe("input validation", () => {
    test("rejects orgId with path traversal", () => {
      expect(() => new OmnyClient("../admin")).toThrow("Invalid orgId");
    });

    test("rejects orgId with query injection", () => {
      expect(() => new OmnyClient("org?x=1")).toThrow("Invalid orgId");
    });

    test("rejects empty orgId", () => {
      expect(() => new OmnyClient("")).toThrow("Invalid orgId");
    });

    test("rejects programSlug with path traversal", async () => {
      const client = new OmnyClient("org-123");
      await expect(client.getClips("../../../admin")).rejects.toThrow(
        "Invalid programSlug",
      );
    });

    test("rejects clipSlug with path traversal", async () => {
      const client = new OmnyClient("org-123");
      await expect(
        client.getClip("the-take", "../../../admin"),
      ).rejects.toThrow("Invalid clipSlug");
    });

    test("allows valid slugs with hyphens and underscores", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ Clips: [], Cursor: null, TotalCount: 0 }),
      );
      await client.getClips("my-podcast_v2");
      expect(fetchUrl()).toContain("/programs/my-podcast_v2/clips");
    });
  });

  describe("error handling", () => {
    test("throws on non-2xx HTTP status with response body", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        }),
      );
      await expect(client.getPrograms()).rejects.toThrow(
        "HTTP 404: Not Found — Not Found",
      );
    });

    test("throws on server error", async () => {
      const client = new OmnyClient("org-123");
      fetchMock.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );
      await expect(client.getPrograms()).rejects.toThrow("HTTP 500");
    });

    test("truncates long error bodies to 1024 characters", async () => {
      const client = new OmnyClient("org-123");
      const longBody = "x".repeat(2000);
      fetchMock.mockResolvedValueOnce(
        new Response(longBody, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );
      try {
        await client.getPrograms();
        expect.unreachable("should have thrown");
      } catch (err) {
        const message = (err as Error).message;
        expect(message).toContain("HTTP 500");
        const bodyPart = message.split(" — ")[1];
        expect(bodyPart.length).toBe(1024);
      }
    });
  });
});
