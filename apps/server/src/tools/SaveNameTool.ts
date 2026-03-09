import type {
  ResponseFunctionCallArgumentsDoneEvent,
  ToolDefinition,
} from "openai-realtime-socket-client";
import type { IToolHandler } from "./ToolHandler";
import { z } from "zod";

// Define the schema for user creation parameters
const SaveNameParams = z.object({
  name: z.string().min(1, "Name is required"),
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
    console.log("SaveNameTool.executeCall", event);

    try {
      // Parse and validate the input using Zod
      const params = SaveNameParams.parse(JSON.parse(event.arguments));

      // Now we have type-safe access to the validated parameters
      console.log("Saving name:", params.name);
      this.savedName = params.name;

      return Promise.resolve();
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.issues);
      } else {
        console.error("Error saving name:", error);
      }
      return Promise.reject(error);
    }
  }
}
