import {
  bootstrap,
  EventBus,
  type IContainer,
  type JSONObject,
  WebServer,
} from "@ts-flow/core";
import express, { type Express, type Request, type Response } from "express";
import path from "path";
import podIndexer from "./index-podcast-topics.json";
import dotenv from "dotenv";

import "@alpha/data/ts-flow/TopicInsertNode";

dotenv.config();

const paths: string[] = [];
paths.push(
  path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "ai", "dist")
);
paths.push(
  path.join(
    process.cwd(),
    "..",
    "..",
    "node_modules",
    "@ts-flow",
    "api",
    "dist"
  )
);
paths.push(
  path.join(
    process.cwd(),
    "..",
    "..",
    "node_modules",
    "@ts-flow",
    "ffmpeg",
    "dist"
  )
);
paths.push(
  path.join(
    process.cwd(),
    "..",
    "..",
    "node_modules",
    "@ts-flow",
    "transforms",
    "dist"
  )
);

void bootstrap(paths, (container: IContainer) => {
  const eventBus: EventBus = container.getInstance("EventBus") as EventBus;
  const webServer: WebServer = container.getInstance("WebServer") as WebServer;
  const app: Express | null = webServer.getApp();
  if (app) {
    app.use(express.static("public"));
    app.use(express.json());

    app.post("/start", async (req: Request, res: Response) => {
      // Validate API key
      const apiKey = process.env["IMPORTER_API_KEY"];
      if (apiKey) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
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
      podIndexer.config as unknown as JSONObject
    );

    webServer.startServer();
    console.log("started server");
  }
});
