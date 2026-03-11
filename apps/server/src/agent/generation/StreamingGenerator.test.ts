/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, spyOn } from "bun:test";
import {
  StreamingGenerator,
  type StreamingGeneratorDeps,
} from "./StreamingGenerator";

function makeDeps(
  overrides?: Partial<StreamingGeneratorDeps>
): StreamingGeneratorDeps {
  return {
    cortexClient: {
      chatCompletion: mock(() =>
        Promise.resolve("Here is the latest on the situation.")
      ),
    } as any,
    audioRecorder: {
      generateAndSave: mock(() => Promise.resolve()),
    },
    createCachedResponse: mock(() => Promise.resolve({ id: "cr1" } as any)),
    embedQuery: mock(() => Promise.resolve([0.1, 0.2, 0.3])),
    computeExpiry: mock(() => new Date(Date.now() + 6 * 3600_000)),
    audioDir: "/tmp/test-audio-cache",
    ...overrides,
  };
}

describe("StreamingGenerator", () => {
  test("calls cortexClient.chatCompletion with system + user messages", async () => {
    const deps = makeDeps();
    const gen = new StreamingGenerator(deps);

    await gen.generate("What happened in Gaza?", "Some context", "user1");

    expect(deps.cortexClient.chatCompletion).toHaveBeenCalledTimes(1);
    const args = (deps.cortexClient.chatCompletion as ReturnType<typeof mock>)
      .mock.calls[0];
    const messages = args[0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain("Some context");
    expect(messages[1].content).toContain("What happened in Gaza?");
  });

  test("returns generated text immediately", async () => {
    const deps = makeDeps();
    const gen = new StreamingGenerator(deps);

    const result = await gen.generate("query", "context", "user1");

    expect(result.text).toBe("Here is the latest on the situation.");
  });

  test("background caching calls TTS, embeddings, and DB insert", async () => {
    const deps = makeDeps();
    const gen = new StreamingGenerator(deps);

    const result = await gen.generate("query", "context", "user1");
    await result.cachingPromise;

    expect(deps.audioRecorder.generateAndSave).toHaveBeenCalledTimes(1);
    expect(deps.embedQuery).toHaveBeenCalledWith("query");
    expect(deps.createCachedResponse).toHaveBeenCalledTimes(1);

    const insertArg = (deps.createCachedResponse as ReturnType<typeof mock>)
      .mock.calls[0][0];
    expect(insertArg.responseText).toBe("Here is the latest on the situation.");
    expect(insertArg.contentType).toBe("answer");
    expect(insertArg.queryEmbedding).toEqual([0.1, 0.2, 0.3]);
    expect(insertArg.audioFilename).toMatch(/\.wav$/);
  });

  test("truncates sourceSummary to 500 chars", async () => {
    const deps = makeDeps();
    const gen = new StreamingGenerator(deps);
    const longContext = "a".repeat(1000);

    const result = await gen.generate("query", longContext, "user1");
    await result.cachingPromise;

    const insertArg = (deps.createCachedResponse as ReturnType<typeof mock>)
      .mock.calls[0][0];
    expect(insertArg.sourceSummary).toHaveLength(500);
  });

  test("background errors are caught and logged", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(
      () => undefined
    );
    const deps = makeDeps({
      audioRecorder: {
        generateAndSave: mock(() => Promise.reject(new Error("TTS failed"))),
      },
    });
    const gen = new StreamingGenerator(deps);

    const result = await gen.generate("query", "context", "user1");
    await result.cachingPromise;

    expect(consoleSpy).toHaveBeenCalled();
    const errorMsg = consoleSpy.mock.calls[0][0];
    expect(errorMsg).toContain("background caching failed");
    consoleSpy.mockRestore();
  });

  test("handles empty context", async () => {
    const deps = makeDeps();
    const gen = new StreamingGenerator(deps);

    const result = await gen.generate("what is happening?", "", "user1");
    await result.cachingPromise;

    const messages = (
      deps.cortexClient.chatCompletion as ReturnType<typeof mock>
    ).mock.calls[0][0];
    expect(messages[1].content).toBe("what is happening?");

    const insertArg = (deps.createCachedResponse as ReturnType<typeof mock>)
      .mock.calls[0][0];
    expect(insertArg.sourceSummary).toBeNull();
  });

  test("runs TTS and embeddings in parallel", async () => {
    const callOrder: string[] = [];
    const deps = makeDeps({
      audioRecorder: {
        generateAndSave: mock(async () => {
          callOrder.push("tts_start");
          await new Promise((r) => setTimeout(r, 10));
          callOrder.push("tts_end");
        }),
      },
      embedQuery: mock(async () => {
        callOrder.push("embed_start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("embed_end");
        return [0.1];
      }),
    });
    const gen = new StreamingGenerator(deps);

    const result = await gen.generate("q", "c", "u1");
    await result.cachingPromise;

    // Both should start before either finishes
    const ttsStart = callOrder.indexOf("tts_start");
    const embedStart = callOrder.indexOf("embed_start");
    const ttsEnd = callOrder.indexOf("tts_end");
    const embedEnd = callOrder.indexOf("embed_end");

    expect(ttsStart).toBeLessThan(ttsEnd);
    expect(embedStart).toBeLessThan(embedEnd);
    // Both start before either ends (parallel)
    expect(Math.max(ttsStart, embedStart)).toBeLessThan(
      Math.min(ttsEnd, embedEnd)
    );
  });
});
