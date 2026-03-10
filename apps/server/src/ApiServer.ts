import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthRoutes } from "./routes/auth";
import type { AuthEnv } from "./middleware/auth";

export class ApiServer {
  private readonly app: Hono<AuthEnv>;
  private readonly corsHosts: string;
  private readonly jwtSecret: string;

  constructor(_apiKey: string, corsHosts: string, jwtSecret: string) {
    this.app = new Hono<AuthEnv>();
    this.corsHosts = corsHosts;
    this.jwtSecret = jwtSecret;
  }

  getServer() {
    return this.app;
  }

  initServer() {
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
    this.app.route("/api/auth", createAuthRoutes());
    this.app.get("/api/health", (c) => {
      return c.json({ status: "ok" });
    });
    this.app.post("/api/echo", (c) => {
      return c.json(c.body);
    });
  }
}
