/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, mock } from "bun:test";
import { createEndSessionTool, type EndSessionDeps } from "./sessionTools";

describe("endSession tool", () => {
  let deps: EndSessionDeps;

  beforeEach(() => {
    deps = {
      endDbSession: mock(() => Promise.resolve()),
      shutdownSession: mock(() => undefined),
    };
  });

  test("creates a tool with an execute function", () => {
    const tool = createEndSessionTool(deps);
    expect(tool).toBeDefined();
    expect(tool.execute).toBeInstanceOf(Function);
  });

  test("calls endDbSession with sessionId and userId from context", async () => {
    const tool = createEndSessionTool(deps);
    const ctx = {
      userData: { userId: "u1", sessionId: "s1", userName: "Alice" } as any,
    };

    await tool.execute({}, { ctx, toolCallId: "t1" } as any);

    expect(deps.endDbSession).toHaveBeenCalledWith("s1", "u1");
  });

  test("calls shutdownSession", async () => {
    const tool = createEndSessionTool(deps);
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    await tool.execute({}, { ctx, toolCallId: "t1" } as any);

    expect(deps.shutdownSession).toHaveBeenCalledTimes(1);
  });

  test("returns goodbye instruction on success", async () => {
    const tool = createEndSessionTool(deps);
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    const result = await tool.execute({}, { ctx, toolCallId: "t1" } as any);

    expect(result).toContain("goodbye");
  });

  test("returns error JSON when endDbSession fails", async () => {
    deps.endDbSession = mock(() =>
      Promise.reject(new Error("DB connection failed")),
    );

    const tool = createEndSessionTool(deps);
    const ctx = {
      userData: { userId: "u1", sessionId: "s1" } as any,
    };

    const result = await tool.execute({}, { ctx, toolCallId: "t1" } as any);

    const parsed = JSON.parse(result as string);
    expect(parsed.error).toBeDefined();
    expect(deps.shutdownSession).not.toHaveBeenCalled();
  });
});
