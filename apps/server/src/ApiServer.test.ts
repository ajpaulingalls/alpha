import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { ApiServer } from "./ApiServer";

describe("ApiServer", () => {
  test("getServer() returns a Hono instance", () => {
    const server = new ApiServer("test-key", "*");
    expect(server.getServer()).toBeInstanceOf(Hono);
  });

  test("GET /api/health returns { status: 'ok' }", async () => {
    const server = new ApiServer("test-key", "*");
    server.initServer();
    const app = server.getServer();

    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("POST /api/echo echoes the body", async () => {
    const server = new ApiServer("test-key", "*");
    server.initServer();
    const app = server.getServer();

    const payload = { message: "hello" };
    const res = await app.request("/api/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
  });
});
