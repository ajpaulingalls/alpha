import { Socket } from "socket.io";
import { logger } from "../utils/logger";
import * as fs from "fs";
import * as path from "path";
import { EventEmitter } from "events";
import {
  RealtimeVoiceClient,
  type RealtimeItem,
  type ToolDefinition,
} from "openai-realtime-socket-client";
import type { ClientToServerEvents } from "@alpha/socket/SocketInterfaces";
import type { SocketData } from "../SocketServer";
import type { InterServerEvents } from "../SocketServer";
import type { ServerToClientEvents } from "@alpha/socket/SocketInterfaces";

export const HANDLER_COMPLETE = "handler_complete";

const MAX_AUDIO_CHUNK_BYTES = 256 * 1024; // 256KB max per chunk (base64)

export interface ICommunicationsHandler {
  init(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
    audioRootDir: string
  ): void;
  voiceStarted(): void;
  voiceStopped(): void;
  appendAudio(audio: string): void;
}

export abstract class CommunicationsHandler
  extends EventEmitter<{
    [HANDLER_COMPLETE]: [];
  }>
  implements ICommunicationsHandler
{
  protected socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  > | null = null;
  protected audioRootDir = "";
  protected client: RealtimeVoiceClient;

  constructor(apiKey: string, instructions: string, tools: ToolDefinition[]) {
    super();
    this.client = new RealtimeVoiceClient({
      apiKey: apiKey,
      realtimeUrl:
        process.env["REALTIME_VOICE_API_URL"] ||
        "wss://api.openai.com/v1/realtime",
      model: process.env["REALTIME_MODEL"] || "gpt-4o-realtime-preview",
      sessionConfig: {
        tools: tools,
        modalities: ["audio", "text"],
        instructions,
        voice: "alloy",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        temperature: 0.7,
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          silence_duration_ms: 600,
        },
        tool_choice: "auto",
        max_response_output_tokens: 4096,
      },
      autoReconnect: true,
      debug: process.env["NODE_ENV"] !== "production",
      filterDeltas: true,
    });
  }

  init(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
    audioRootDir: string
  ): void {
    this.socket = socket;
    this.audioRootDir = audioRootDir;

    this.socket?.on("appendAudio", (audio: string) => {
      if (audio.length > MAX_AUDIO_CHUNK_BYTES) {
        logger.warn(
          `Rejected oversized audio chunk (${audio.length} bytes) from ${socket.id}`
        );
        return;
      }
      this.appendAudio(audio);
    });

    this.socket?.on("voiceStarted", () => {
      this.voiceStarted();
    });

    this.socket?.on("voiceStopped", () => {
      this.voiceStopped();
    });

    this.socket?.on("disconnect", () => {
      this.client.disconnect();
      this.emitComplete();
    });
  }

  abstract voiceStarted(): void;
  abstract voiceStopped(): void;
  abstract appendAudio(audio: string): void;

  protected emitComplete(): void {
    this.emit(HANDLER_COMPLETE);
  }

  protected streamAudioToClient(audioPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const CHUNK_SIZE = 48000;
      const filePath = path.join(this.audioRootDir, audioPath);

      // Prevent path traversal
      const resolvedPath = path.resolve(filePath);
      const resolvedRoot = path.resolve(this.audioRootDir);
      if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
        reject(new Error("Invalid audio path"));
        return;
      }

      const streamItem: RealtimeItem = {
        id: `audio-${Date.now()}`,
        type: "message",
        content: [
          {
            type: "audio",
            audio: "", // This will be filled in with base64 audio in the stream handler
          },
        ],
      };

      try {
        if (!fs.existsSync(filePath)) {
          this.socket?.emit("error", "Requested audio not available");
          reject(new Error(`Audio file not found: ${audioPath}`));
          return;
        }

        const stream = fs.createReadStream(filePath, {
          highWaterMark: CHUNK_SIZE,
        });

        this.socket?.on("disconnect", () => {
          stream.destroy();
          reject(new Error("Socket disconnected during audio streaming"));
        });

        stream.on("data", (chunk) => {
          const base64Audio = chunk.toString("base64");
          this.socket?.emit("conversationUpdated", streamItem, {
            audio: base64Audio,
          });
        });

        stream.on("end", () => {
          logger.log(
            `Audio streaming completed for client: ${this.socket?.id}`
          );
          resolve();
        });

        stream.on("error", (error) => {
          logger.error(
            `Stream error for client ${this.socket?.id}: ${error.message}`
          );
          this.socket?.emit("error", "Audio streaming error");
          reject(error);
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          `Failed to start audio stream for client ${this.socket?.id}: ${errorMessage}`
        );
        this.socket?.emit("error", "Audio streaming error");
        reject(error);
      }
    });
  }
}
