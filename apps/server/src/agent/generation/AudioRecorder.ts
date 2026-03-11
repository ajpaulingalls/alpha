import type OpenAI from "openai";
import fs from "node:fs/promises";
import path from "node:path";

const SAFE_PATH_SEGMENT = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export interface AudioRecorderDeps {
  openai: OpenAI;
}

export class AudioRecorder {
  private openai: OpenAI;

  constructor(deps: AudioRecorderDeps) {
    this.openai = deps.openai;
  }

  async generateAndSave(
    text: string,
    outputPath: string,
    voice = "alloy"
  ): Promise<void> {
    this.validatePath(outputPath);

    const speechResponse = await this.openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "pcm",
    });

    const pcmBuffer = Buffer.from(await speechResponse.arrayBuffer());
    const wavBuffer = this.buildWav(pcmBuffer);

    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(outputPath, wavBuffer, { mode: 0o644 });
  }

  private validatePath(outputPath: string): void {
    const segments = outputPath.split(path.sep).filter(Boolean);
    for (const segment of segments) {
      if (segment === ".." || segment === ".") {
        throw new Error(`Invalid path segment: ${segment}`);
      }
    }
    const filename = path.basename(outputPath);
    if (!SAFE_PATH_SEGMENT.test(filename)) {
      throw new Error(`Invalid filename: ${filename}`);
    }
  }

  private buildWav(pcmData: Buffer): Buffer {
    const header = Buffer.alloc(44);
    const dataSize = pcmData.length;
    const fileSize = dataSize + 36; // 44 - 8 = 36

    // RIFF header
    header.write("RIFF", 0);
    header.writeUInt32LE(fileSize, 4);
    header.write("WAVE", 8);

    // Format chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // PCM chunk size
    header.writeUInt16LE(1, 20); // PCM format
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(24000, 24); // 24kHz sample rate
    header.writeUInt32LE(48000, 28); // byte rate (24000 * 1 * 16/8)
    header.writeUInt16LE(2, 32); // block align (1 * 16/8)
    header.writeUInt16LE(16, 34); // 16-bit

    // Data chunk
    header.write("data", 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmData]);
  }
}
