import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { CortexClient } from "@alpha/cortex";
import type { ChatMessage } from "@alpha/cortex/types";
import type {
  NewCachedResponse,
  CachedResponse,
} from "@alpha/data/schema/cached_responses";

export interface AudioRecorderLike {
  generateAndSave(text: string, outputPath: string): Promise<void>;
}

export interface StreamingGeneratorDeps {
  cortexClient: CortexClient;
  audioRecorder: AudioRecorderLike;
  createCachedResponse: (data: NewCachedResponse) => Promise<CachedResponse>;
  embedQuery: (query: string) => Promise<number[] | null>;
  computeExpiry: (query: string, context: string) => Date;
  audioDir: string;
}

export interface GenerateResult {
  text: string;
  cachingPromise: Promise<void>;
}

const SYSTEM_PROMPT =
  "You are Alpha, an AI news assistant for Al Jazeera. " +
  "Generate a conversational spoken response to the user's question using the provided context. " +
  "Be concise, informative, and conversational — as if a knowledgeable friend is explaining the news. " +
  "Do not use markdown, bullet points, or any formatting. Write in natural speech only.";

export class StreamingGenerator {
  private deps: StreamingGeneratorDeps;

  constructor(deps: StreamingGeneratorDeps) {
    this.deps = deps;
  }

  async generate(
    query: string,
    ragContext: string,
    _userId: string
  ): Promise<GenerateResult> {
    const messages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: ragContext
          ? `Context:\n${ragContext}\n\nQuestion: ${query}`
          : query,
      },
    ];

    const text = await this.deps.cortexClient.chatCompletion(messages);

    const cachingPromise = this.cacheInBackground(query, ragContext, text);

    return { text, cachingPromise };
  }

  private async cacheInBackground(
    query: string,
    ragContext: string,
    text: string
  ): Promise<void> {
    try {
      const filename = `${crypto.randomUUID()}.wav`;
      const fullPath = path.join(this.deps.audioDir, filename);

      await fs.mkdir(this.deps.audioDir, { recursive: true });

      const [embedding] = await Promise.all([
        this.deps.embedQuery(query),
        this.deps.audioRecorder.generateAndSave(text, fullPath),
      ]);

      const expiresAt = this.deps.computeExpiry(query, ragContext);

      await this.deps.createCachedResponse({
        queryEmbedding: embedding,
        responseText: text,
        audioFilename: filename,
        sourceSummary: ragContext.slice(0, 500) || null,
        contentType: "answer",
        expiresAt,
      });
    } catch (err) {
      console.error("StreamingGenerator: background caching failed:", err);
    }
  }
}
