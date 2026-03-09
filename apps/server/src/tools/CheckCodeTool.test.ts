import { describe, expect, test } from "bun:test";
import type { ResponseFunctionCallArgumentsDoneEvent } from "openai-realtime-socket-client";
import { CheckCodeTool } from "./CheckCodeTool";

function makeEvent(args: string): ResponseFunctionCallArgumentsDoneEvent {
  return {
    event_id: "evt_1",
    call_id: "call_1",
    item_id: "item_1",
    output_index: 0,
    response_id: "resp_1",
    name: "check_code",
    type: "response.function_call_arguments.done",
    arguments: args,
  };
}

describe("CheckCodeTool", () => {
  test("getName() returns 'check_code'", () => {
    const tool = new CheckCodeTool();
    expect(tool.getName()).toBe("check_code");
  });

  test("executeCall() with valid 6-digit code stores it", async () => {
    const tool = new CheckCodeTool();
    await tool.executeCall(makeEvent(JSON.stringify({ code: "123456" })));
    expect(tool.getStoredCode()).toBe("123456");
  });

  test("executeCall() rejects code that is too short", async () => {
    const tool = new CheckCodeTool();
    await expect(
      tool.executeCall(makeEvent(JSON.stringify({ code: "123" })))
    ).rejects.toThrow();
  });

  test("executeCall() rejects code that is too long", async () => {
    const tool = new CheckCodeTool();
    await expect(
      tool.executeCall(makeEvent(JSON.stringify({ code: "1234567" })))
    ).rejects.toThrow();
  });

  test("executeCall() rejects code with letters", async () => {
    const tool = new CheckCodeTool();
    await expect(
      tool.executeCall(makeEvent(JSON.stringify({ code: "12ab56" })))
    ).rejects.toThrow();
  });

  test("executeCall() rejects on invalid JSON", async () => {
    const tool = new CheckCodeTool();
    await expect(
      tool.executeCall(makeEvent("not valid json"))
    ).rejects.toThrow();
  });

  test("getToolDefinition() returns correct structure", () => {
    const tool = new CheckCodeTool();
    const def = tool.getToolDefinition();
    expect(def.name).toBe("check_code");
    expect(def.type).toBe("function");
    expect(def.parameters).toBeDefined();
  });
});
