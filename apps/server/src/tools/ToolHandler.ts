import type { ResponseFunctionCallArgumentsDoneEvent, ToolDefinition } from "openai-realtime-socket-client";

export interface IToolHandler {
  getName(): string;
  getToolDefinition(): ToolDefinition;
  executeCall(event: ResponseFunctionCallArgumentsDoneEvent): Promise<void>;
}

