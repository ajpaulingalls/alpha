/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { AudioRecorder } from "./AudioRecorder";

function makeMockOpenAI(pcmBytes: Buffer = Buffer.alloc(4800)) {
  return {
    audio: {
      speech: {
        create: mock(() =>
          Promise.resolve({
            arrayBuffer: () => Promise.resolve(pcmBytes.buffer),
          })
        ),
      },
    },
  } as any;
}

const TMP_DIR = path.join(import.meta.dir, "__test_audio_tmp__");

beforeEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true });
  }
});

afterEach(() => {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true });
  }
});

describe("AudioRecorder", () => {
  test("calls OpenAI TTS with correct parameters", async () => {
    const openai = makeMockOpenAI();
    const recorder = new AudioRecorder({ openai });

    const outPath = path.join(TMP_DIR, "test.wav");
    await recorder.generateAndSave("Hello world", outPath, "shimmer");

    expect(openai.audio.speech.create).toHaveBeenCalledWith({
      model: "gpt-4o-mini-tts",
      voice: "shimmer",
      input: "Hello world",
      response_format: "pcm",
    });
  });

  test("defaults to alloy voice", async () => {
    const openai = makeMockOpenAI();
    const recorder = new AudioRecorder({ openai });

    const outPath = path.join(TMP_DIR, "test.wav");
    await recorder.generateAndSave("Hello", outPath);

    expect(openai.audio.speech.create).toHaveBeenCalledWith(
      expect.objectContaining({ voice: "alloy" })
    );
  });

  test("writes valid WAV header", async () => {
    const pcmData = Buffer.alloc(9600); // 0.2 seconds at 24kHz 16-bit mono
    const openai = makeMockOpenAI(pcmData);
    const recorder = new AudioRecorder({ openai });

    const outPath = path.join(TMP_DIR, "output.wav");
    await recorder.generateAndSave("Test", outPath);

    const written = fs.readFileSync(outPath);

    // RIFF header
    expect(written.toString("ascii", 0, 4)).toBe("RIFF");
    expect(written.readUInt32LE(4)).toBe(pcmData.length + 36);
    expect(written.toString("ascii", 8, 12)).toBe("WAVE");

    // Format chunk
    expect(written.toString("ascii", 12, 16)).toBe("fmt ");
    expect(written.readUInt32LE(16)).toBe(16); // PCM chunk size
    expect(written.readUInt16LE(20)).toBe(1); // PCM format
    expect(written.readUInt16LE(22)).toBe(1); // mono
    expect(written.readUInt32LE(24)).toBe(24000); // sample rate
    expect(written.readUInt32LE(28)).toBe(48000); // byte rate
    expect(written.readUInt16LE(32)).toBe(2); // block align
    expect(written.readUInt16LE(34)).toBe(16); // bits per sample

    // Data chunk
    expect(written.toString("ascii", 36, 40)).toBe("data");
    expect(written.readUInt32LE(40)).toBe(pcmData.length);

    // Total size
    expect(written.length).toBe(44 + pcmData.length);
  });

  test("creates output directory if it does not exist", async () => {
    const openai = makeMockOpenAI();
    const recorder = new AudioRecorder({ openai });

    const outPath = path.join(TMP_DIR, "nested", "dir", "test.wav");
    await recorder.generateAndSave("Test", outPath);

    expect(fs.existsSync(outPath)).toBe(true);
  });

  test("rejects path traversal attempts", async () => {
    const openai = makeMockOpenAI();
    const recorder = new AudioRecorder({ openai });

    await expect(
      recorder.generateAndSave("Test", "/tmp/../etc/test.wav")
    ).rejects.toThrow("Invalid path segment");
  });

  test("rejects filenames with invalid characters", async () => {
    const openai = makeMockOpenAI();
    const recorder = new AudioRecorder({ openai });

    await expect(
      recorder.generateAndSave("Test", path.join(TMP_DIR, "bad file!.wav"))
    ).rejects.toThrow("Invalid filename");
  });
});
