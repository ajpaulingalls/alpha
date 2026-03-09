import { describe, expect, test } from "bun:test";
import type { ResponseFunctionCallArgumentsDoneEvent } from "openai-realtime-socket-client";
import { SaveNameTool } from "./SaveNameTool";

function makeEvent(args: string): ResponseFunctionCallArgumentsDoneEvent {
  return {
    event_id: "evt_1",
    call_id: "call_1",
    item_id: "item_1",
    output_index: 0,
    response_id: "resp_1",
    name: "save_name",
    type: "response.function_call_arguments.done",
    arguments: args,
  };
}

describe("SaveNameTool", () => {
  test("getName() returns 'save_name'", () => {
    const tool = new SaveNameTool();
    expect(tool.getName()).toBe("save_name");
  });

  test("executeCall() with valid name saves it", async () => {
    const tool = new SaveNameTool();
    await tool.executeCall(makeEvent(JSON.stringify({ name: "Alice" })));
    expect(tool.getSavedName()).toBe("Alice");
  });

  test("executeCall() rejects on empty name", async () => {
    const tool = new SaveNameTool();
    await expect(
      tool.executeCall(makeEvent(JSON.stringify({ name: "" })))
    ).rejects.toThrow();
  });

  test("executeCall() rejects on invalid JSON", async () => {
    const tool = new SaveNameTool();
    await expect(
      tool.executeCall(makeEvent("not valid json"))
    ).rejects.toThrow();
  });

  test("getToolDefinition() returns correct structure", () => {
    const tool = new SaveNameTool();
    const def = tool.getToolDefinition();
    expect(def.name).toBe("save_name");
    expect(def.type).toBe("function");
    expect(def.description).toBe("Save the user's name");
    expect(def.parameters).toBeDefined();
  });
});
