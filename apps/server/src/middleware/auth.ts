import { createMiddleware } from "hono/factory";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Session } from "@alpha/data/schema/sessions";

export const JWT_ISSUER = "alpha-api";
export const JWT_AUDIENCE = "alpha-client";

export interface AuthEnv {
  Variables: {
    jwtSecret: string;
    userId: string;
    sessionId: string;
  };
}

export function createAuthMiddleware(
  findSessionById: (id: string) => Promise<Session | null>,
) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Missing Authorization header" }, 401);
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return c.json({ error: "Malformed Authorization header" }, 401);
    }

    const token = parts[1];

    try {
      const secret = c.get("jwtSecret");
      const decoded = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as JwtPayload;

      const userId = decoded["userId"];
      if (typeof userId !== "string") {
        return c.json({ error: "Invalid token payload" }, 401);
      }

      const sessionId = decoded["sessionId"];
      if (typeof sessionId !== "string") {
        return c.json({ error: "Invalid token payload" }, 401);
      }
      const session = await findSessionById(sessionId);
      if (!session || session.endedAt) {
        return c.json({ error: "Session expired" }, 401);
      }

      c.set("userId", userId);
      c.set("sessionId", sessionId);
    } catch {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    await next();
  });
}
