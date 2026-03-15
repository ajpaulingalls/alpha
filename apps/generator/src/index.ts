import {
  bootstrap,
  type IContainer,
  type JSONObject,
  WebServer,
} from "@ts-flow/core";
import path from "path";
import generatePodcast from "./generate-podcast.json";
import type { Request, Response } from "express";

import "./nodes/PodGenEngine.ts";
import "@alpha/data/ts-flow/TopicInsertNode";

function resolveDistDir(pkg: string): string {
  const entry = require.resolve(pkg);
  return path.dirname(entry);
}

const paths: string[] = [
  resolveDistDir("@ts-flow/ai"),
  resolveDistDir("@ts-flow/cron"),
  resolveDistDir("@ts-flow/api"),
];

void bootstrap(paths, (container: IContainer) => {
  const webServer = container.getInstance("WebServer") as WebServer;
  webServer.addGetEndpoint("/instances", (req: Request, res: Response) => {
    res.send(
      container
        .getInstances()
        .map((instance) => instance.getId())
        .reduce((prev, cur) => prev + "\n" + cur),
    );
  });
  container.createInstance(
    generatePodcast.id,
    generatePodcast.type,
    generatePodcast.config as unknown as JSONObject,
  );

  webServer.startServer();
});
