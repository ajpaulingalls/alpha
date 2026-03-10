import type {
  ResponseFunctionCallArgumentsDoneEvent,
  ToolDefinition,
} from "openai-realtime-socket-client";
import type { IToolHandler } from "./ToolHandler";
import { z } from "zod";
import { logger } from "../utils/logger";

// Define the schema for user creation parameters
const SavePhoneParams = z.object({
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(20, "Phone number is too long")
    .regex(
      /^[+]?[\d\s\-().]{7,20}$/,
      "Phone must contain only digits, spaces, hyphens, parentheses, or leading +"
    ),
});

// Type inference from the schema
type SavePhoneParams = z.infer<typeof SavePhoneParams>;

export class SavePhoneTool implements IToolHandler {
  private savedPhone = "";

  getName(): string {
    return "save_phone";
  }

  getSavedPhone(): string {
    return this.savedPhone;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: this.getName(),
      type: "function",
      description: "Save the user's phone number",
      parameters: z.toJSONSchema(SavePhoneParams),
    };
  }

  executeCall(event: ResponseFunctionCallArgumentsDoneEvent): Promise<void> {
    logger.debug("SavePhoneTool.executeCall", event);

    try {
      // Parse and validate the input using Zod
      const params = SavePhoneParams.parse(JSON.parse(event.arguments));

      this.savedPhone = params.phone;

      return Promise.resolve();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.issues);
      } else {
        logger.error("Error saving phone:", error);
      }
      return Promise.reject(error);
    }
  }
}
