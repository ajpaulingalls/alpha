import OpenAI from "openai";
import { generateAudioFromTextToFile } from "@alpha/ai/AudioGenerator";
import { parseArgs } from "util";
import path from "node:path";

const main = async () => {
  const { values } = parseArgs({
    args: Bun.argv,
    options: {
      filename: {
        type: "string",
      },
      text: {
        type: "string",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  if (!values.filename || !values.text) {
    console.error(
      'Usage: bun createAudioFromText.ts --filename output.wav --text "text to convert"',
    );
    process.exit(1);
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env["OPENAI_API_KEY"],
  });

  try {
    await generateAudioFromTextToFile(
      openai,
      values.text,
      path.join(process.cwd(), values.filename),
    );
    console.log(`Successfully created audio file: ${values.filename}`);
  } catch (error) {
    console.error("Error generating audio:", error);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
