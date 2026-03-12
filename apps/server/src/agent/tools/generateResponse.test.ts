/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, spyOn } from "bun:test";
import { createGenerateResponseTool } from "./generateResponse";

function makeGenerator(text = "Generated response text.") {
  return {
    generate: mock(() =>
      Promise.resolve({
        text,
        cachingPromise: Promise.resolve(),
      }),
    ),
  } as any;
}

function makeCtx(userId = "u1") {
  return {
    userData: { userId, userName: "Test", sessionId: "s1" },
  };
}

describe("createGenerateResponseTool", () => {
  test("returns an llm.tool with description and parameters", () => {
    const tool = createGenerateResponseTool({ generator: makeGenerator() });
    expect(tool).toBeDefined();
  });

  test("calls generator.generate with correct arguments", async () => {
    const generator = makeGenerator();
    const tool = createGenerateResponseTool({ generator });

    const result = await tool.execute(
      { query: "What happened?", context: "Some context" },
      { ctx: makeCtx() } as any,
    );

    expect(generator.generate).toHaveBeenCalledWith(
      "What happened?",
      "Some context",
      "u1",
    );
    const parsed = JSON.parse(result);
    expect(parsed.generatedResponse).toBe("Generated response text.");
    expect(parsed.caching).toBe(true);
  });

  test("handles empty context default", async () => {
    const generator = makeGenerator();
    const tool = createGenerateResponseTool({ generator });

    await tool.execute({ query: "test query", context: "" }, {
      ctx: makeCtx(),
    } as any);

    expect(generator.generate).toHaveBeenCalledWith("test query", "", "u1");
  });

  test("returns error JSON when generator throws", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(
      () => undefined,
    );
    const generator = {
      generate: mock(() => Promise.reject(new Error("LLM unavailable"))),
    } as any;
    const tool = createGenerateResponseTool({ generator });

    const result = await tool.execute({ query: "test", context: "" }, {
      ctx: makeCtx(),
    } as any);

    const parsed = JSON.parse(result);
    expect(parsed.error).toBe("Failed to generate response.");
    consoleSpy.mockRestore();
  });

  test("does not await cachingPromise", async () => {
    let cachingResolved = false;
    const generator = {
      generate: mock(() =>
        Promise.resolve({
          text: "response",
          cachingPromise: new Promise<void>((resolve) => {
            setTimeout(() => {
              cachingResolved = true;
              resolve();
            }, 100);
          }),
        }),
      ),
    } as any;
    const tool = createGenerateResponseTool({ generator });

    await tool.execute({ query: "test", context: "" }, {
      ctx: makeCtx(),
    } as any);

    // Tool returns before caching completes
    expect(cachingResolved).toBe(false);
  });

  test("catches and logs caching promise errors", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(
      () => undefined,
    );
    const generator = {
      generate: mock(() =>
        Promise.resolve({
          text: "response",
          cachingPromise: Promise.reject(new Error("cache failed")),
        }),
      ),
    } as any;
    const tool = createGenerateResponseTool({ generator });

    const result = await tool.execute({ query: "test", context: "" }, {
      ctx: makeCtx(),
    } as any);

    // Tool still returns successfully
    const parsed = JSON.parse(result);
    expect(parsed.generatedResponse).toBe("response");

    // Wait a tick for the rejection handler
    await new Promise((r) => setTimeout(r, 10));
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
