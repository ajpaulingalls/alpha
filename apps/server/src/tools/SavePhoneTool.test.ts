import { describe, expect, test } from "bun:test";
import type { ResponseFunctionCallArgumentsDoneEvent } from "openai-realtime-socket-client";
import { SavePhoneTool } from "./SavePhoneTool";

function makeEvent(args: string): ResponseFunctionCallArgumentsDoneEvent {
  return {
    event_id: "evt_1",
    call_id: "call_1",
    item_id: "item_1",
    output_index: 0,
    response_id: "resp_1",
    name: "save_phone",
    type: "response.function_call_arguments.done",
    arguments: args,
  };
}

describe("SavePhoneTool", () => {
  test("getName() returns 'save_phone'", () => {
    const tool = new SavePhoneTool();
    expect(tool.getName()).toBe("save_phone");
  });

  test("executeCall() with valid phone saves it", async () => {
    const tool = new SavePhoneTool();
    await tool.executeCall(makeEvent(JSON.stringify({ phone: "555-1234" })));
    expect(tool.getSavedPhone()).toBe("555-1234");
  });

  test("executeCall() rejects on empty phone", async () => {
    const tool = new SavePhoneTool();
    await expect(
      tool.executeCall(makeEvent(JSON.stringify({ phone: "" })))
    ).rejects.toThrow();
  });

  test("executeCall() rejects on invalid JSON", async () => {
    const tool = new SavePhoneTool();
    await expect(
      tool.executeCall(makeEvent("not valid json"))
    ).rejects.toThrow();
  });

  test("getToolDefinition() returns correct structure", () => {
    const tool = new SavePhoneTool();
    const def = tool.getToolDefinition();
    expect(def.name).toBe("save_phone");
    expect(def.type).toBe("function");
    expect(def.description).toBe("Save the user's phone number");
    expect(def.parameters).toBeDefined();
  });
});
