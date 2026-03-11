import { describe, expect, test } from "bun:test";
import { LLM } from "@livekit/agents-plugin-openai";
import { createCortexLLM, FAST_MODEL, STANDARD_MODEL } from "./cortexLLM";

describe("createCortexLLM", () => {
  test("returns an openai.LLM instance", () => {
    const result = createCortexLLM("http://cortex.local", STANDARD_MODEL);
    expect(result).toBeInstanceOf(LLM);
  });

  test("uses the provided model", () => {
    const result = createCortexLLM("http://cortex.local", FAST_MODEL);
    expect(result.model).toBe(FAST_MODEL);
  });

  test("accepts a custom model string", () => {
    const result = createCortexLLM("http://cortex.local", "custom-model");
    expect(result.model).toBe("custom-model");
  });
});

describe("model presets", () => {
  test("FAST_MODEL is oai-gpturbo", () => {
    expect(FAST_MODEL).toBe("oai-gpturbo");
  });

  test("STANDARD_MODEL is oai-gpt4o", () => {
    expect(STANDARD_MODEL).toBe("oai-gpt4o");
  });
});
