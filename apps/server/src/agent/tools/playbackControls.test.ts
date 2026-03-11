/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock } from "bun:test";
import {
  createPausePlaybackTool,
  createResumePlaybackTool,
  createSkipTopicTool,
} from "./playbackControls";
import type { PlaybackState } from "../agents/PlaybackAgent";
import { mockPlaybackDeps } from "../agents/test-helpers";

function createState(overrides?: Partial<PlaybackState>): PlaybackState {
  return {
    topics: [
      {
        id: "t1",
        title: "Topic One",
        summary: "s",
        embedding: null,
        filename: "t1.wav",
        episodeId: "e1",
        startTime: 0,
        endTime: 60,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "t2",
        title: "Topic Two",
        summary: "s",
        embedding: null,
        filename: "t2.wav",
        episodeId: "e1",
        startTime: 60,
        endTime: 120,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "t3",
        title: "Topic Three",
        summary: "s",
        embedding: null,
        filename: "t3.wav",
        episodeId: "e1",
        startTime: 120,
        endTime: 180,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    currentTopicIndex: 0,
    paused: false,
    stopped: false,
    playing: false,
    lastSentPercent: 0,
    continuePlayback: null,
    ...overrides,
  };
}

const toolCtx = {
  ctx: { userData: { userId: "u1", sessionId: "s1" } },
  toolCallId: "t1",
} as any;

describe("pausePlayback tool", () => {
  test("sets state.paused to true", async () => {
    const state = createState();
    const tool = createPausePlaybackTool(state);

    await tool.execute({}, toolCtx);

    expect(state.paused).toBe(true);
  });

  test("returns paused status", async () => {
    const state = createState();
    const tool = createPausePlaybackTool(state);

    const result = await tool.execute({}, toolCtx);
    const parsed = JSON.parse(result as string);

    expect(parsed.status).toBe("paused");
  });
});

describe("resumePlayback tool", () => {
  test("sets state.paused to false", async () => {
    const state = createState({ paused: true });
    const tool = createResumePlaybackTool(state);

    await tool.execute({}, toolCtx);

    expect(state.paused).toBe(false);
  });

  test("calls continuePlayback callback", async () => {
    const cb = mock(() => undefined);
    const state = createState({ paused: true, continuePlayback: cb });
    const tool = createResumePlaybackTool(state);

    await tool.execute({}, toolCtx);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("returns resuming status", async () => {
    const state = createState({ paused: true });
    const tool = createResumePlaybackTool(state);

    const result = await tool.execute({}, toolCtx);
    const parsed = JSON.parse(result as string);

    expect(parsed.status).toBe("resuming");
  });
});

describe("skipTopic tool", () => {
  test("advances currentTopicIndex", async () => {
    const state = createState();
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    await tool.execute({}, toolCtx);

    expect(state.currentTopicIndex).toBe(1);
  });

  test("calls continuePlayback when topics remain", async () => {
    const cb = mock(() => undefined);
    const state = createState({ continuePlayback: cb });
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    await tool.execute({}, toolCtx);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test("returns next topic title", async () => {
    const state = createState();
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    const result = await tool.execute({}, toolCtx);
    const parsed = JSON.parse(result as string);

    expect(parsed.status).toBe("skipping");
    expect(parsed.topic).toBe("Topic Two");
  });

  test("returns finished when no more topics", async () => {
    const state = createState({ currentTopicIndex: 2 });
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    const result = await tool.execute({}, toolCtx);
    const parsed = JSON.parse(result as string);

    expect(parsed.status).toBe("finished");
    expect(state.stopped).toBe(true);
  });

  test("does not call continuePlayback when finished", async () => {
    const cb = mock(() => undefined);
    const state = createState({ currentTopicIndex: 2, continuePlayback: cb });
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    await tool.execute({}, toolCtx);

    expect(cb).not.toHaveBeenCalled();
  });

  test("fires updateCompletedPercent", async () => {
    const state = createState();
    const deps = mockPlaybackDeps();
    const tool = createSkipTopicTool(state, deps);

    await tool.execute({}, toolCtx);

    expect(deps.updateCompletedPercent).toHaveBeenCalled();
  });
});
