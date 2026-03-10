import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import jwt from "jsonwebtoken";
import type { User } from "@alpha/data/schema/users";
import type { Session } from "@alpha/data/schema/sessions";
import {
  createAuthMiddleware,
  JWT_ISSUER,
  JWT_AUDIENCE,
  type AuthEnv,
} from "../middleware/auth";
import { logger } from "../utils/logger";
import { RateLimiter } from "../utils/rateLimit";

export { JWT_ISSUER, JWT_AUDIENCE };

export interface AuthDeps {
  findUserByEmail: (email: string) => Promise<User | null>;
  upsertUserWithCode: (
    email: string,
    code: string,
    timeout: Date
  ) => Promise<User>;
  updateUserValidation: (email: string, validated: boolean) => Promise<User>;
  clearVerificationCode: (email: string) => Promise<User>;
  incrementFailedAttempts: (email: string) => Promise<User>;
  createSession: (userId: string) => Promise<Session>;
  findSessionById: (id: string) => Promise<Session | null>;
}

const MAX_FAILED_ATTEMPTS = 5;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const sendCodeLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 per 15 min per IP
const verifyCodeLimiter = new RateLimiter(15 * 60 * 1000, 10); // 10 per 15 min per email

const SendCodeBody = z.object({
  email: z.string().email(),
});

const VerifyCodeBody = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

function hmacCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(code).digest("hex");
}

export function createAuthRoutes(deps: AuthDeps) {
  const app = new Hono<AuthEnv>();
  const authMiddleware = createAuthMiddleware(deps.findSessionById);

  app.post("/send-code", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const result = SendCodeBody.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const clientIp = c.req.header("x-forwarded-for") ?? "unknown";
    if (!sendCodeLimiter.isAllowed(clientIp)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const { email } = result.data;
    const code = randomInt(100000, 1000000).toString();
    const timeout = new Date(Date.now() + CODE_EXPIRY_MS);

    const secret = c.get("jwtSecret");
    const hashedCode = hmacCode(code, secret);

    await deps.upsertUserWithCode(email, hashedCode, timeout);

    logger.debug(`[AUTH] Verification code for ${email}: ${code}`);

    return c.json({ success: true });
  });

  app.post("/verify-code", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const result = VerifyCodeBody.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const { email, code } = result.data;

    if (!verifyCodeLimiter.isAllowed(email)) {
      return c.json({ error: "Too many attempts" }, 429);
    }

    const user = await deps.findUserByEmail(email);

    if (!user) {
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    if (!user.validationTimeout || new Date() > user.validationTimeout) {
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await deps.clearVerificationCode(email);
      return c.json(
        { error: "Too many failed attempts, request a new code" },
        401
      );
    }

    const secret = c.get("jwtSecret");
    const hashedInput = hmacCode(code, secret);
    const storedCode = user.verificationCode;

    if (
      !storedCode ||
      hashedInput.length !== storedCode.length ||
      !timingSafeEqual(Buffer.from(hashedInput), Buffer.from(storedCode))
    ) {
      await deps.incrementFailedAttempts(email);
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    const [, , session] = await Promise.all([
      deps.updateUserValidation(email, true),
      deps.clearVerificationCode(email),
      deps.createSession(user.id),
    ]);

    const token = jwt.sign({ userId: user.id, sessionId: session.id }, secret, {
      expiresIn: "30d",
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    const isNewUser = !user.name || user.name.trim() === "";

    return c.json({ token, isNewUser });
  });

  app.post("/livekit-token", authMiddleware, async (c) => {
    return c.json({ token: "<placeholder>", roomName: "<placeholder>" });
  });

  return app;
}
