import OpenAI from "openai";
import fs from "node:fs";

export type OpenAIVoice =
  | "alloy"
  | "echo"
  | "fable"
  | "onyx"
  | "nova"
  | "shimmer";

/**
 * Generates a WAV audio file from text using OpenAI's text-to-speech API.
 * The generated audio will be in 24kHz 16-bit mono WAV format, which is compatible
 * with the system's audio processing requirements.
 *
 * @param openai - The OpenAI client instance
 * @param text - The text to convert to speech
 * @param outputFilePath - The path where the WAV file will be saved
 * @param voice - The voice to use for text-to-speech (defaults to "alloy")
 */
export async function generateAudioFromTextToFile(
  openai: OpenAI,
  text: string,
  outputFilePath: string,
  voice: OpenAIVoice = "alloy",
) {
  try {
    const audioResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      response_format: "pcm",
      speed: 1.0,
    });

    // Get the audio data as a buffer
    const buffer = Buffer.from(await audioResponse.arrayBuffer());

    // Write the buffer to the output file
    await fs.promises.writeFile(outputFilePath, buffer);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate audio: ${error.message}`);
    }
    throw error;
  }
}
