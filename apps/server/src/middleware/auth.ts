import { createMiddleware } from "hono/factory";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { findSessionById } from "@alpha/data/crud/sessions";
import { JWT_ISSUER, JWT_AUDIENCE } from "../routes/auth";

export interface AuthEnv {
  Variables: {
    jwtSecret: string;
    userId: string;
  };
}

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
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
    if (typeof sessionId === "string") {
      const session = await findSessionById(sessionId);
      if (!session || session.endedAt) {
        return c.json({ error: "Session expired" }, 401);
      }
    }

    c.set("userId", userId);
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  await next();
});
