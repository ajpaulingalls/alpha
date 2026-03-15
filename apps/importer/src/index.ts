import { timingSafeEqual } from "node:crypto";
import {
  bootstrap,
  EventBus,
  type IContainer,
  type JSONObject,
  WebServer,
} from "@ts-flow/core";
import express, { type Request, type Response } from "express";
import path from "path";
import podIndexer from "./index-podcast-topics.json";
import dotenv from "dotenv";

import "@alpha/data/ts-flow/TopicInsertNode";

dotenv.config();

const IMPORTER_API_KEY = process.env["IMPORTER_API_KEY"];
if (!IMPORTER_API_KEY) {
  console.error(
    'Environment variable "IMPORTER_API_KEY" is required.\n' +
      "Please set it in your .env file.",
  );
  process.exit(1);
}

function resolveDistDir(pkg: string): string {
  const entry = require.resolve(pkg);
  return path.dirname(entry);
}

const paths: string[] = [
  resolveDistDir("@ts-flow/ai"),
  resolveDistDir("@ts-flow/api"),
  resolveDistDir("@ts-flow/ffmpeg"),
  resolveDistDir("@ts-flow/transforms"),
];

void bootstrap(paths, (container: IContainer) => {
  const eventBus: EventBus = container.getInstance("EventBus") as EventBus;
  const webServer: WebServer = container.getInstance("WebServer") as WebServer;
  const app = webServer.getApp();
  app.use(express.static("public"));
  app.use(express.json());

  app.post("/start", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${IMPORTER_API_KEY}`;
    if (
      !authHeader ||
      authHeader.length !== expectedToken.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedToken))
    ) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { programId } = req.body;

    if (!programId) {
      res.status(400).json({ error: "Program ID is required" });
      return;
    }

    // Validate programId format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(String(programId))) {
      res.status(400).json({ error: "Invalid program ID format" });
      return;
    }

    try {
      eventBus.sendEvent("loadProgram", { programId });
      res.status(200).json({ message: "Program processing started" });
    } catch {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  container.createInstance(
    podIndexer.id,
    podIndexer.type,
    podIndexer.config as unknown as JSONObject,
  );

  webServer.startServer();
  console.log("started server");
});
