import type {
  ResponseFunctionCallArgumentsDoneEvent,
  ToolDefinition,
} from "openai-realtime-socket-client";
import type { IToolHandler } from "./ToolHandler";
import { z } from "zod";
import { logger } from "../utils/logger";

// Define the schema for user creation parameters
const SaveNameParams = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

// Type inference from the schema
type SaveNameParams = z.infer<typeof SaveNameParams>;

export class SaveNameTool implements IToolHandler {
  private savedName = "";

  getName(): string {
    return "save_name";
  }

  getSavedName(): string {
    return this.savedName;
  }

  getToolDefinition(): ToolDefinition {
    return {
      name: this.getName(),
      type: "function",
      description: "Save the user's name",
      parameters: z.toJSONSchema(SaveNameParams),
    };
  }

  executeCall(event: ResponseFunctionCallArgumentsDoneEvent): Promise<void> {
    logger.debug("SaveNameTool.executeCall", event);

    try {
      // Parse and validate the input using Zod
      const params = SaveNameParams.parse(JSON.parse(event.arguments));

      // Now we have type-safe access to the validated parameters
      logger.debug("Saving name:", params.name);
      this.savedName = params.name;

      return Promise.resolve();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error("Validation error:", error.issues);
      } else {
        logger.error("Error saving name:", error);
      }
      return Promise.reject(error);
    }
  }
}
