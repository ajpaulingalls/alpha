/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock } from "bun:test";
import { z } from "zod";
import { createFetchWireHighlightsTool } from "./fetchWireHighlights";

const fetchWireHighlightsSchema = z.object({
  since: z.string().datetime().optional(),
});

const mockRag = mock(() =>
  Promise.resolve({
    result: "Wire highlight summary.",
    sources: [
      { title: "Source 1", content: "Content 1", url: "https://example.com" },
    ],
  }),
);

describe("fetchWireHighlights tool", () => {
  test("schema accepts valid params without since", () => {
    const result = fetchWireHighlightsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("schema accepts valid params with since", () => {
    const result = fetchWireHighlightsSchema.safeParse({
      since: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  test("schema rejects invalid datetime", () => {
    const result = fetchWireHighlightsSchema.safeParse({
      since: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  test("createFetchWireHighlightsTool returns a tool", () => {
    const tool = createFetchWireHighlightsTool({
      cortexClient: { rag: mockRag } as any,
    });
    expect(tool).toBeDefined();
    expect(tool.description).toContain("wire");
  });

  test("execute calls cortex rag and returns highlights", async () => {
    const tool = createFetchWireHighlightsTool({
      cortexClient: { rag: mockRag } as any,
    });
    const ctx = { userData: { userId: "u1" } } as any;
    const result = await tool.execute({ since: undefined }, {
      ctx,
      toolCallId: "t1",
    } as any);
    const parsed = JSON.parse(result as string);
    expect(parsed.highlights).toBe("Wire highlight summary.");
    expect(parsed.sources).toHaveLength(1);
    expect(mockRag).toHaveBeenCalled();
  });
});
