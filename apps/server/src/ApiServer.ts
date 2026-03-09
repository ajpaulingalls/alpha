import { Hono } from "hono";
import { cors } from "hono/cors";

export class ApiServer {
  private readonly app: Hono;
  private readonly corsHosts: string;

  constructor(_apiKey: string, corsHosts: string) {
    this.app = new Hono();
    this.corsHosts = corsHosts;
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
    this.app.get("/api/health", (c) => {
      return c.json({ status: "ok" });
    });
    this.app.post("/api/echo", (c) => {
      return c.json(c.body);
    });
  }
}
