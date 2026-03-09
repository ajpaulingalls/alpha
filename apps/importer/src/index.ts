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
  
  dotenv.config();
  
  const paths: string[] = [];
  paths.push(
    path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "ai", "dist"),
  );
  paths.push(
    path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "api", "dist"),
  );
  paths.push(
    path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "db", "dist"),
  );
  paths.push(
    path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "ffmpeg", "dist"),
  );
  paths.push(
    path.join(process.cwd(), "..", "..", "node_modules", "@ts-flow", "transforms", "dist"),
  );
  
  void bootstrap(paths, (container: IContainer) => {
    const eventBus: EventBus = container.getInstance("EventBus") as EventBus;
    const webServer: WebServer = container.getInstance("WebServer") as WebServer;
    const app: Express | null = webServer.getApp();
    if (app) {
      app.use(express.static("public"));
      app.use(express.json());
  
      app.post(
        "/start",
        async (req: Request, res: Response) => {
          const { programId } = req.body;
          
          if (!programId) {
            res.status(400).json({ error: "Program ID is required" });
            return;
          }
  
          try {
            eventBus.sendEvent("loadProgram", { programId });
            res.status(200).json({ message: "Program processing started" });
          } catch (e) {
            console.log("error", e);
            res.status(500).json({ message: e });
          }
        },
      );
      container.createInstance(
        podIndexer.id,
        podIndexer.type,
        podIndexer.config as unknown as JSONObject,
      );
  
      webServer.startServer();
      console.log("started server");
    }
  });
  