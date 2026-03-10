import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import jwt from "jsonwebtoken";
import {
  findUserByEmail,
  upsertUserWithCode,
  updateUserValidation,
  clearVerificationCode,
  incrementFailedAttempts,
} from "@alpha/data/crud/users";
import { createSession } from "@alpha/data/crud/sessions";
import { authMiddleware, type AuthEnv } from "../middleware/auth";
import { logger } from "../utils/logger";
import { RateLimiter } from "../utils/rateLimit";

export const JWT_ISSUER = "alpha-api";
export const JWT_AUDIENCE = "alpha-client";

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

export function createAuthRoutes() {
  const app = new Hono<AuthEnv>();

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

    await upsertUserWithCode(email, hashedCode, timeout);

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

    const user = await findUserByEmail(email);

    if (!user) {
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    if (!user.validationTimeout || new Date() > user.validationTimeout) {
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    if (user.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await clearVerificationCode(email);
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
      await incrementFailedAttempts(email);
      return c.json({ error: "Invalid or expired code" }, 401);
    }

    const [, , session] = await Promise.all([
      updateUserValidation(email, true),
      clearVerificationCode(email),
      createSession(user.id),
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
