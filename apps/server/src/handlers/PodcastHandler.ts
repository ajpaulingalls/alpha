import { CommunicationsHandler } from "./CommunicationsHandler";
import type { ToolDefinition } from "openai-realtime-socket-client";
import type { Socket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@alpha/socket/SocketInterfaces";
import type { InterServerEvents } from "../SocketServer";
import type { SocketData } from "../SocketServer";

export class PodcastHandler extends CommunicationsHandler {
  constructor(apiKey: string) {
    const instructions =
      "You are a podcast host. Welcome the listener and engage in conversation.";
    const tools: ToolDefinition[] = [];
    super(apiKey, instructions, tools);
  }

  async init(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
    audioRootDir: string,
  ): Promise<void> {
    super.init(socket, audioRootDir);

    this.client.on("response.audio.delta", ({ item_id, delta }) => {
      const item = this.client.getItem(item_id);
      if (item) {
        this.socket?.emit("conversationUpdated", item, { audio: delta });
      }
    });

    this.client.on("connected", async () => {
      this.socket?.emit("ready");
      try {
        await this.streamAudioToClient("startup.wav");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await this.streamAudioToClient("podcast.wav");
      } catch (error) {
        console.error("Error playing welcome audio:", error);
      }
    });

    this.client.connect();
  }

  voiceStarted(): void {
    // No specific action needed when voice starts
    this.client.appendInputAudio(""); // Start with empty buffer
  }

  voiceStopped(): void {
    // No specific action needed when voice stops
    this.client.commitInputAudio();
  }

  appendAudio(audio: string): void {
    this.client.appendInputAudio(audio);
  }
}
