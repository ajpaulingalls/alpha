/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock } from "bun:test";
import { createSearchContextTool } from "./searchContext";

const toolCtx = {
  ctx: { userData: { userId: "u1", sessionId: "s1" } },
  toolCallId: "t1",
} as any;

describe("searchContext tool", () => {
  test("returns RAG result on success", async () => {
    const deps = {
      cortexClient: {
        rag: mock(() =>
          Promise.resolve({
            result: "The ceasefire was announced on Monday.",
            sources: [{ title: "Source 1" }],
          })
        ),
      } as any,
    };
    const tool = createSearchContextTool(deps);

    const result = await tool.execute(
      { query: "What happened with the ceasefire?" },
      toolCtx
    );

    const parsed = JSON.parse(result as string);
    expect(parsed.answer).toContain("ceasefire");
    expect(parsed.sources).toHaveLength(1);
  });

  test("returns fallback when no result found", async () => {
    const deps = {
      cortexClient: {
        rag: mock(() => Promise.resolve({ result: "", sources: [] })),
      } as any,
    };
    const tool = createSearchContextTool(deps);

    const result = await tool.execute({ query: "unknown topic" }, toolCtx);

    const parsed = JSON.parse(result as string);
    expect(parsed.answer).toContain("couldn't find");
  });

  test("returns error message on failure", async () => {
    const deps = {
      cortexClient: {
        rag: mock(() => Promise.reject(new Error("Network error"))),
      } as any,
    };
    const tool = createSearchContextTool(deps);

    const result = await tool.execute({ query: "test query" }, toolCtx);

    const parsed = JSON.parse(result as string);
    expect(parsed.answer).toContain("trouble looking that up");
  });
});
