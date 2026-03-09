import {
  ContainerNode,
  type IContainer,
  type IQueryEngine,
  type JSONObject,
  NodeBase,
} from "@ts-flow/core";
import fs from "fs";
import { WriteStream } from "fs";
import OpenAI from "openai";

@ContainerNode
export class PodGenEngine extends NodeBase implements IQueryEngine {
  private readonly outputEventName: string;
  private readonly outputProperty: string;
  private readonly openai: OpenAI;

  constructor(id: string, container: IContainer, config: JSONObject) {
    super(id, container, config);
    this.outputEventName = config["outputEventName"] as string;
    this.outputProperty = config["outputProperty"] as string;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  protected async addSilenceToFile(file: WriteStream): Promise<void> {
    const silence = Buffer.alloc(96000); // 2 seconds at 24kHz, 16-bit mono
    await new Promise<void>((resolve, _reject) => {
      if (!file.write(silence)) {
        file.once("drain", resolve);
      } else {
        resolve();
      }
    });
  }

  async execute(
    payload: JSONObject,
    completeCallback: (completeEventName: string, result: JSONObject) => void
  ): Promise<void> {
    const file = await this.createWavFile();
    if (Array.isArray(payload)) {
      // Add intro.wav at the beginning
      await this.appendWavData("./pods/music/intro.wav", file);
      await this.generatePodcastIntro(payload, file);
      await this.appendWavData("./pods/music/trans.wav", file);
      for (const item of payload) {
        await this.addSilenceToFile(file);

        // Check if we have cached data for this segment
        const slug = item.slug as string;
        const cachePath = `./pods/cache/${slug}/segment.pcm`;
        if (fs.existsSync(cachePath)) {
          console.log("\n\n\nUsing cached segment for:", item.title);
          const cachedData = fs.readFileSync(cachePath);
          await new Promise<void>((resolve, _reject) => {
            if (!file.write(cachedData)) {
              file.once("drain", resolve);
            } else {
              resolve();
            }
          });
        } else {
          console.log("\n\n\nGenerating podcast segment for:", item.title);
          await this.generatePodcastSegmentToWav(
            item.script as JSONObject,
            file,
            slug
          );
        }

        // Add transition WAV and silence between segments
        await this.appendWavData("./pods/music/trans.wav", file);

        item[this.outputProperty] = cachePath;
        console.log("Podcast segment generated for:", item.title);
      }
      file.close();

      // Add a small delay to ensure the file is properly closed before updating the header
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.updateWavFileHeader();
      payload[this.outputProperty] = "./pods/podcast.wav";
    } else {
      await this.generatePodcastSegmentToWav(
        payload.script as JSONObject,
        file,
        payload.slug as string
      );
      file.close();

      // Add a small delay to ensure the file is properly closed before updating the header
      await new Promise((resolve) => setTimeout(resolve, 100));
      await this.updateWavFileHeader();
    }

    completeCallback(this.outputEventName, payload);
  }

  protected async createWavFile(): Promise<WriteStream> {
    // Ensure the pods directory exists
    if (!fs.existsSync("./pods")) {
      fs.mkdirSync("./pods", { recursive: true });
    }

    const file = fs.createWriteStream("./pods/podcast.wav");

    // WAV file header for 24kHz 16-bit mono
    const header = Buffer.alloc(44);

    // RIFF header
    header.write("RIFF", 0); // Chunk ID
    header.writeUInt32LE(0, 4); // File size (will be updated later)
    header.write("WAVE", 8); // Format

    // Format chunk
    header.write("fmt ", 12); // Subchunk1ID
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
    header.writeUInt16LE(1, 22); // NumChannels (1 for mono)
    header.writeUInt32LE(24000, 24); // SampleRate (24kHz)
    header.writeUInt32LE(48000, 28); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
    header.writeUInt16LE(2, 32); // BlockAlign (NumChannels * BitsPerSample/8)
    header.writeUInt16LE(16, 34); // BitsPerSample (16-bit)

    // Data chunk header
    header.write("data", 36); // Subchunk2ID
    header.writeUInt32LE(0, 40); // Subchunk2Size (will be updated later)

    // Write the header to the file
    file.write(header);

    return file;
  }

  protected async generatePodcastIntro(
    articles: JSONObject[],
    file: WriteStream
  ) {
    const articleTitles = articles.map((article) => article.title).join(", ");

    const introScriptResponse = await this.openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert podcast writer for Al Jazeera's podcast, Under the Headlines. You are given a list of articles and you need to write an intro for a podcast episode that will discuss each of them.  There are two hosts, Blair and Betty.  The intro should start with a welcome and the name of the podcast, which is 'Under the Headlines', a brief intro of each host, Blair and Betty, and today's date, and the time. It should be relatively short, but still cover all the topics of the given article titles.  The intro should be engaging and interesting to the listener.",
        },
        {
          role: "user",
          content: `Today is ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })} and the time is ${new Date().toLocaleTimeString(
            "en-US"
          )}. Here are the article titles that will be discussed in the podcast, please write an intro for the podcast that will discuss each of them: ${articleTitles}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "podcastScript",
          description:
            "A Conversation between 2 podcasters introducing the podcast and the articles they're going to be discussing.  Each line is a single line of dialogue between the 2 podcasters. The name is the name of the podcaster speaking. The line is the line of dialogue that the podcaster is speaking. The instructions are the instructions for the podcasters to follow while speaking.",
          strict: true,
          schema: {
            type: "object",
            properties: {
              script: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                    },
                    line: {
                      type: "string",
                    },
                    instructions: {
                      type: "string",
                    },
                  },
                  required: ["name", "line", "instructions"],
                  additionalProperties: false,
                },
              },
            },
            required: ["script"],
            additionalProperties: false,
          },
        },
      },
    });

    const introScript = JSON.parse(
      introScriptResponse.choices[0].message.content as string
    );
    console.log("\n\n\nGenerating Intro for podcast");
    await this.generatePodcastSegmentToWav(introScript, file);
  }

  protected async generatePodcastSegmentToWav(
    script: JSONObject,
    file: WriteStream,
    slug?: string
  ) {
    const lines = script.script as JSONObject[];
    let allPcmData = Buffer.alloc(0);

    for (const line of lines) {
      const voice = line.name === "Blair" ? "onyx" : "shimmer";
      const text = line.line as string;
      const instructions = line.instructions as string;

      console.log(`${line.name}: ${text}`);

      try {
        const speechResponse = await this.openai.audio.speech.create({
          model: "gpt-4o-mini-tts",
          voice: voice,
          input: text,
          response_format: "pcm",
          instructions: instructions,
        });

        // Convert the response to a buffer
        const buffer = Buffer.from(await speechResponse.arrayBuffer());

        // Add to our accumulated PCM data
        allPcmData = Buffer.concat([allPcmData, buffer]);

        // Add silence between lines
        const silence = Buffer.alloc(12000); // 0.5 seconds at 24kHz, 16-bit mono
        allPcmData = Buffer.concat([allPcmData, silence]);
      } catch (error) {
        console.error(`Error generating speech for line: ${text}`, error);
        throw error;
      }
    }

    // If we have a slug, save the PCM data to cache
    if (slug) {
      const cacheDir = `./pods/cache/${slug}`;
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      fs.writeFileSync(`${cacheDir}/segment.pcm`, allPcmData);
    }

    // Write the accumulated PCM data to the output file
    await new Promise<void>((resolve, _reject) => {
      if (!file.write(allPcmData)) {
        file.once("drain", resolve);
      } else {
        resolve();
      }
    });
  }

  protected async updateWavFileHeader() {
    const filePath = "./pods/podcast.wav";

    // Get the file stats to determine its size
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    // Data size is fileSize minus header size (44 bytes)
    const dataSize = fileSize - 44;

    // Read the existing file
    const fd = fs.openSync(filePath, "r+");

    // Update the RIFF chunk size (file size - 8 bytes)
    const riffSizeBuffer = Buffer.alloc(4);
    riffSizeBuffer.writeUInt32LE(fileSize - 8, 0);
    fs.writeSync(fd, riffSizeBuffer, 0, 4, 4);

    // Update the data chunk size
    const dataSizeBuffer = Buffer.alloc(4);
    dataSizeBuffer.writeUInt32LE(dataSize, 0);
    fs.writeSync(fd, dataSizeBuffer, 0, 4, 40);

    // Close the file
    fs.closeSync(fd);

    console.log(
      `WAV header updated: file size ${fileSize} bytes, data size ${dataSize} bytes`
    );
  }

  protected async appendWavData(
    inputWavPath: string,
    outputStream: WriteStream
  ): Promise<void> {
    // Open the input file
    const inputFd = fs.openSync(inputWavPath, "r");

    try {
      // Skip the WAV header (44 bytes)
      const headerBuffer = Buffer.alloc(44);
      fs.readSync(inputFd, headerBuffer, 0, 44, 0);

      // Read the rest of the file in chunks
      const chunkSize = 1024 * 1024; // 1MB chunks
      const buffer = Buffer.alloc(chunkSize);

      let bytesRead: number;
      while (
        (bytesRead = fs.readSync(inputFd, buffer, 0, chunkSize, null)) > 0
      ) {
        await new Promise<void>((resolve, _reject) => {
          if (!outputStream.write(buffer.slice(0, bytesRead))) {
            outputStream.once("drain", resolve);
          } else {
            resolve();
          }
        });
      }
    } finally {
      // Always close the input file
      fs.closeSync(inputFd);
    }
  }
}
