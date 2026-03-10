import type {
  ResponseFunctionCallArgumentsDoneEvent,
  ToolDefinition,
} from "openai-realtime-socket-client";
import type { IToolHandler } from "./ToolHandler";
import { z } from "zod";

// Define the schema for code verification parameters
const CheckCodeParams = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be a 6-digit number"),
});

// Type inference from the schema
type CheckCodeParams = z.infer<typeof CheckCodeParams>;

export class CheckCodeTool implements IToolHandler {
  private storedCode = "";

  getName(): string {
    return "check_code";
  }

  getStoredCode(): string {
    return this.storedCode;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: this.getName(),
      type: "function",
      description:
        "Check if the verification code provided by the user is valid",
      parameters: z.toJSONSchema(CheckCodeParams),
    };
  }

  executeCall(event: ResponseFunctionCallArgumentsDoneEvent): Promise<void> {
    console.log("CheckCodeTool.executeCall", event);

    try {
      // Parse and validate the input using Zod
      const params = CheckCodeParams.parse(JSON.parse(event.arguments));

      // Store the code in the member variable
      this.storedCode = params.code;

      return Promise.resolve();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.issues);
      } else {
        console.error("Error storing code:", error);
      }
      return Promise.reject(error);
    }
  }
}
