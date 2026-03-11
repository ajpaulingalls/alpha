import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes, type AuthDeps } from "./routes/auth";
import type { AuthEnv } from "./middleware/auth";
import { securityHeaders } from "./middleware/securityHeaders";

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

export class ApiServer {
  private readonly app: Hono<AuthEnv>;
  private readonly corsHosts: string;
  private readonly jwtSecret: string;
  private readonly livekitConfig: LiveKitConfig;

  constructor(
    _apiKey: string,
    corsHosts: string,
    jwtSecret: string,
    livekitConfig: LiveKitConfig
  ) {
    this.app = new Hono<AuthEnv>();
    this.corsHosts = corsHosts;
    this.jwtSecret = jwtSecret;
    this.livekitConfig = livekitConfig;
  }

  getServer() {
    return this.app;
  }

  initServer(authDeps: AuthDeps) {
    this.app.use("/api/*", securityHeaders);
    this.app.use(
      "/api/*",
      cors({
        origin: this.corsHosts,
      })
    );
    this.app.use("/api/*", async (c, next) => {
      c.set("jwtSecret", this.jwtSecret);
      await next();
    });
    this.app.route("/api/auth", createAuthRoutes(authDeps, this.livekitConfig));
    this.app.get("/api/health", (c) => {
      return c.json({ status: "ok" });
    });
  }
}
