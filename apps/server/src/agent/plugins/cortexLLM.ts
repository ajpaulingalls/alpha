import * as openai from "@livekit/agents-plugin-openai";

export const FAST_MODEL = "oai-gpturbo";
export const STANDARD_MODEL = "oai-gpt4o";

export function createCortexLLM(cortexApiUrl: string, model: string) {
  return new openai.LLM({
    model,
    baseURL: `${cortexApiUrl}/v1`,
    // Required by the OpenAI SDK constructor, but Cortex uses network-level auth
    apiKey: "unused",
  });
}
