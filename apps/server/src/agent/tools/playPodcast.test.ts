/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock } from "bun:test";
import { createPlayPodcastTool } from "./playPodcast";
import { PlaybackAgent } from "../agents/PlaybackAgent";
import { mockBrowseDeps } from "../agents/test-helpers";

function createDeps(overrides?: Record<string, any>) {
  return {
    findEpisodeById: mock(() =>
      Promise.resolve({
        id: "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
        title: "Gaza Ceasefire Update",
        showName: "Newshour",
        description: "Latest updates",
        publishedAt: new Date(),
        sourceUrl: "https://example.com",
        audioFilename: "episode.mp3",
        duration: 1800,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    recordListen: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1",
        listenedAt: new Date(),
        completedPercent: 0,
      })
    ),
    findTopicsByEpisode: mock(() => Promise.resolve([])),
    updateCompletedPercent: mock(() =>
      Promise.resolve({
        id: "lh1",
        sessionId: "s1",
        userId: "u1",
        contentType: "episode",
        contentId: "e1",
        listenedAt: new Date(),
        completedPercent: 50,
      })
    ),
    cortexClient: {
      rag: mock(() => Promise.resolve({ result: "", sources: [] })),
    } as any,
    audioDir: "/tmp/test-audio",
    browseDeps: mockBrowseDeps(),
    ...overrides,
  };
}

const EPISODE_ID = "e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1";

describe("playPodcast tool", () => {
  const ctx = {
    userData: { userId: "u1", sessionId: "s1" } as any,
  };

  test("returns error JSON when episode not found", async () => {
    const deps = createDeps({
      findEpisodeById: mock(() => Promise.resolve(null)),
    });
    const tool = createPlayPodcastTool(deps);

    const result = await tool.execute({ episodeId: EPISODE_ID }, {
      ctx,
      toolCallId: "t1",
    } as any);

    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result as string);
    expect(parsed.error).toBe("Episode not found.");
  });

  test("calls recordListen with correct args when episode exists", async () => {
    const deps = createDeps();
    const tool = createPlayPodcastTool(deps);

    await tool.execute({ episodeId: EPISODE_ID }, {
      ctx,
      toolCallId: "t1",
    } as any);

    expect(deps.recordListen).toHaveBeenCalledWith(
      "s1",
      "u1",
      "episode",
      EPISODE_ID
    );
  });

  test("returns llm.handoff with PlaybackAgent", async () => {
    const deps = createDeps();
    const tool = createPlayPodcastTool(deps);

    const result = await tool.execute({ episodeId: EPISODE_ID }, {
      ctx,
      toolCallId: "t1",
    } as any);

    expect(result).toBeDefined();
    expect(typeof result).not.toBe("string");
    const handoff = result as { agent: unknown; returns: string };
    expect(handoff.agent).toBeInstanceOf(PlaybackAgent);
  });

  test("handoff returns message includes episode title", async () => {
    const deps = createDeps();
    const tool = createPlayPodcastTool(deps);

    const result = await tool.execute({ episodeId: EPISODE_ID }, {
      ctx,
      toolCallId: "t1",
    } as any);

    const handoff = result as { agent: unknown; returns: string };
    expect(handoff.returns).toContain("Gaza Ceasefire Update");
  });

  test("passes listenHistoryId to PlaybackAgent", async () => {
    const deps = createDeps();
    const tool = createPlayPodcastTool(deps);

    const result = await tool.execute({ episodeId: EPISODE_ID }, {
      ctx,
      toolCallId: "t1",
    } as any);

    const handoff = result as unknown as {
      agent: PlaybackAgent;
      returns: string;
    };
    expect(handoff.agent).toBeInstanceOf(PlaybackAgent);
  });
});
