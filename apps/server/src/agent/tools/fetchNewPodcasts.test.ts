/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";
import { z } from "zod";
import { createFetchNewPodcastsTool } from "./fetchNewPodcasts";

const fetchNewPodcastsSchema = z.object({
  since: z.string().datetime().optional(),
});

const mockFindNew = mock(() =>
  Promise.resolve([
    {
      id: "e1",
      title: "Episode 1",
      showName: "The Take",
      description: "Desc",
      publishedAt: new Date("2025-01-01"),
      duration: 1800,
      sourceUrl: null,
      audioFilename: "ep1.wav",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
);

describe("fetchNewPodcasts tool", () => {
  beforeEach(() => {
    mockFindNew.mockClear();
  });

  test("schema accepts valid params without since", () => {
    const result = fetchNewPodcastsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("schema accepts valid params with since", () => {
    const result = fetchNewPodcastsSchema.safeParse({
      since: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("createFetchNewPodcastsTool returns a tool", () => {
    const tool = createFetchNewPodcastsTool({
      findNewEpisodesForUser: mockFindNew,
    });
    expect(tool).toBeDefined();
    expect(tool.description).toContain("podcast");
  });

  test("execute passes userId from context", async () => {
    const tool = createFetchNewPodcastsTool({
      findNewEpisodesForUser: mockFindNew,
    });
    const ctx = { userData: { userId: "user-42" } } as any;
    const result = await tool.execute({ since: undefined }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.episodes).toHaveLength(1);
    expect(parsed.episodes[0].id).toBe("e1");
    expect(mockFindNew).toHaveBeenCalledWith("user-42", undefined, 10);
  });

  test("execute passes since date when provided", async () => {
    const tool = createFetchNewPodcastsTool({
      findNewEpisodesForUser: mockFindNew,
    });
    const ctx = { userData: { userId: "user-42" } } as any;
    await tool.execute({ since: "2025-06-01T00:00:00Z" }, {
      ctx,
      toolCallId: "t1",
    } as any);
    expect(mockFindNew).toHaveBeenCalledWith(
      "user-42",
      new Date("2025-06-01T00:00:00Z"),
      10,
    );
  });
});
