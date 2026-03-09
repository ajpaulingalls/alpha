import type { Hono } from "hono";
import { Server, Socket } from "socket.io";
import { serve } from "@hono/node-server";
import type { Server as HTTPServer } from "node:http";
import { logger } from "./utils/logger";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@alpha/socket/SocketInterfaces";
import SignupHandler from "./handlers/SignupHandler";
import type { ICommunicationsHandler } from "./handlers/CommunicationsHandler";
import { HANDLER_COMPLETE } from "./handlers/CommunicationsHandler";
import { PodcastHandler } from "./handlers/PodcastHandler";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { findUserById } from "@alpha/data/crud/users";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  userName: string;
  language: string;
  currentHandler: ICommunicationsHandler;
}

export class SocketServer {
  private readonly apiKey: string;
  private readonly corsHosts: string;
  private readonly audioRootDir: string;
  private io: Server | null;
  private httpServer: HTTPServer | null;

  constructor(apiKey: string, corsHosts: string, audioRootDir: string) {
    this.apiKey = apiKey;
    this.corsHosts = corsHosts;
    this.audioRootDir = audioRootDir;
    this.io = null;
    this.httpServer = null;
  }

  listen(app: Hono, port: number) {
    this.httpServer = serve({
      fetch: app.fetch,
      port,
    }) as HTTPServer;
    this.io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >(this.httpServer, {
      cors: {
        origin: this.corsHosts,
      },
    });
    this.io.on("connection", this.connectionHandler.bind(this));
    logger.log(`Listening on ws://localhost:${port}`);
  }

  private async connectionHandler(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >
  ) {
    logger.log(`Client connected: ${socket.id}`);

    const userToken = socket.handshake.query["token"] as string;
    if (userToken) {
      console.log("User token found");
      const decoded = jwt.verify(userToken, process.env["JWT_SECRET"]!);
      socket.data.userId = (decoded as JwtPayload)["userId"];
      const user = await findUserById(socket.data.userId);
      if (user) {
        console.log("User found");
        socket.data.userName = user.name;
        const newHandler = new PodcastHandler(this.apiKey);
        newHandler.init(socket, this.audioRootDir);
        socket.data.currentHandler = newHandler;
        return;
      }
    }

    const handler = new SignupHandler(this.apiKey);
    handler.init(socket, this.audioRootDir);
    socket.data.currentHandler = handler;

    // Listen for handler complete event
    handler.on(HANDLER_COMPLETE, () => {
      logger.log(`Handler completed for client: ${socket.id}`);
      if (socket.connected) {
        const newHandler = new PodcastHandler(this.apiKey);
        newHandler.init(socket, this.audioRootDir);
        socket.data.currentHandler = newHandler;
      }
    });
  }
}
