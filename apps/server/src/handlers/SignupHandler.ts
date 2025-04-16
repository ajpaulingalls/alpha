import { CommunicationsHandler } from "./CommunicationsHandler";
import { Socket } from "socket.io";
import { SaveNameTool } from "../tools/SaveNameTool";
import { SavePhoneTool } from "../tools/SavePhoneTool";
import { CheckCodeTool } from "../tools/CheckCodeTool";
import {
  findUserByPhoneNumber,
  createUser,
  updateUserVerificationCode,
  updateUserValidation,
} from "@alpha/data/crud/users";
import { type User } from "@alpha/data/schema/users";
import jwt from "jsonwebtoken";


export default class SignupHandler extends CommunicationsHandler {
  private saveNameTool: SaveNameTool;
  private savePhoneTool: SavePhoneTool;
  private checkCodeTool: CheckCodeTool;
  private user: User | null = null;
  private completed: boolean = false;

  constructor(apiKey: string) {
    const saveNameTool = new SaveNameTool();
    const savePhoneTool = new SavePhoneTool();
    const checkCodeTool = new CheckCodeTool();
    super(
      apiKey,
      `You are a helpful assistant guiding users through the signup process.  
         Your job is to collect the user's name.  
         To do this, you will ask the user for their name in a friendly and engaging manner.
         You will then use the save_name tool to save the name.
         After that, you will ask for their phone number and use the save_phone tool.
         Finally, you will ask them for the verification code sent to their phone and use the check_code tool to verify it.`,
      [
        saveNameTool.getToolDefinition(),
        savePhoneTool.getToolDefinition(),
        checkCodeTool.getToolDefinition(),
      ],
    );
    this.saveNameTool = saveNameTool;
    this.savePhoneTool = savePhoneTool;
    this.checkCodeTool = checkCodeTool;
  }

  init(socket: Socket, audioRootDir: string): void {
    super.init(socket, audioRootDir);

    this.client.on("response.audio.delta", ({ item_id, delta }) => {
      const item = this.client.getItem(item_id);
      item && this.socket?.emit("conversationUpdated", item, { audio: delta });
    });

    // Set up event handlers for the client
    this.client.on("response.function_call_arguments.done", (event: any) => {
      console.log("Function call arguments done", event);
      if (event.name === this.saveNameTool.getName()) {
        this.saveNameTool
          .executeCall(event)
          .then(() => {
            // Notify the client that user was created successfully
            console.log("Name saved successfully");
            this.client.createResponse({
              instructions:
                "Now, please provide your phone number so we can send you a verification code.",
            });
          })
          .catch((error) => {
            console.error("Error executing save name tool:", error);
            this.socket?.emit(
              "error",
              error instanceof Error ? error.message : String(error),
            );
          });
      } else if (event.name === this.savePhoneTool.getName()) {
        this.savePhoneTool
          .executeCall(event)
          .then(async () => {
            console.log("Phone saved successfully");
            const phone = this.savePhoneTool.getSavedPhone();
            const existingUser = await findUserByPhoneNumber(phone);
            const existingCode = this.checkCodeTool.getStoredCode();

            // If we have both an existing user and a code, try to validate it
            if (existingUser && existingCode) {
              if (await this.validateCode()) {
                this.onComplete();
                return;
              }
            }

            // Generate new verification code
            const verificationCode = Math.floor(
              100000 + Math.random() * 900000,
            ).toString();
            const validationTimeout = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

            if (existingUser) {
              // Update existing user with new verification code
              this.user = await updateUserVerificationCode(
                phone,
                verificationCode,
                validationTimeout,
              );
              this.client.createResponse({
                instructions:
                  "Welcome back! We've sent you a new verification code. Check your text messages and then come back here and tell me the code.",
              });
            } else {
              // Create new user
              const name = this.saveNameTool.getSavedName();
              this.user = await createUser(
                name,
                phone,
                verificationCode,
                validationTimeout,
              );
              this.client.createResponse({
                instructions:
                  "OK, we sent you a verification code. Check your text messages and then come back here and tell me the code.",
              });
            }
          })
          .catch((error) => {
            console.error("Error executing save phone tool:", error);
            this.socket?.emit(
              "error",
              error instanceof Error ? error.message : String(error),
            );
          });
      } else if (event.name === this.checkCodeTool.getName()) {
        this.checkCodeTool
          .executeCall(event)
          .then(async () => {
            if (!this.user) {
              this.client.createResponse({
                instructions:
                  "Please provide your phone number first so we can match it with the verification code.",
              });
              return;
            }

            if (await this.validateCode()) {
              this.onComplete();
            }
          })
          .catch((error) => {
            console.error("Error verifying code:", error);
            this.client.createResponse({
              instructions:
                "Sorry, there was an error verifying your code. Please try again.",
            });
            this.socket?.emit(
              "error",
              error instanceof Error ? error.message : String(error),
            );
          });
      }
    });

    this.client.on("connected", async () => {
      this.socket?.emit("ready");
      try {
        await this.streamAudioToClient("welcome.wav");
      } catch (error) {
        console.error("Error playing welcome audio:", error);
      }
    });

    this.client.connect();
  }

  generateUserToken(user: User): string {
    return jwt.sign({ userId: user.id }, process.env["JWT_SECRET"]!, {
      expiresIn: "30d",
    });
  }

  async onComplete(): Promise<void> {
    this.completed = true;
    this.client.disconnect();
    this.socket?.emit("saveUserToken", this.generateUserToken(this.user!));
    try {
      await this.streamAudioToClient("signupComplete.wav");
    } catch (error) {
      console.error("Error playing welcome audio:", error);
    }
    this.emitComplete();
  }

  async validateCode(): Promise<boolean> {
    const currentTime = new Date();
    const providedCode = this.checkCodeTool.getStoredCode();

    if (currentTime > this.user!.validationTimeout!) {
      this.client.createResponse({
        instructions:
          "Sorry, the verification code has expired. Please request a new code.",
      });
      return false;
    }

    if (providedCode !== this.user!.verificationCode) {
      this.client.createResponse({
        instructions:
          "Sorry, that code is invalid. Please try again with the correct verification code.",
      });
      return false;
    }

    // Code is valid and not expired, update user validation status
    this.user = await updateUserValidation(this.user!.phoneNumber, true);

    console.log("Code verified successfully");
    return true;
  }

  voiceStarted(): void {
    // Start streaming audio to the OpenAI client
    this.client.appendInputAudio(""); // Start with empty buffer
  }

  voiceStopped(): void {
    // Stop streaming audio to the OpenAI client
    this.client.commitInputAudio();
  }

  appendAudio(audio: string): void {
    // Send audio data to the OpenAI client
    if (this.completed) {
      return;
    }
    this.client.appendInputAudio(audio);
  }
}
