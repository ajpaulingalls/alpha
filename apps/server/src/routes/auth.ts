import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { AccessToken } from "livekit-server-sdk";
import { RoomAgentDispatch, RoomConfiguration } from "@livekit/protocol";
import { AGENT_NAME } from "../agent/constants";
import { isNewUser } from "../agent/types";
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
    timeout: Date,
  ) => Promise<User>;
  updateUserValidation: (email: string, validated: boolean) => Promise<User>;
  clearVerificationCode: (email: string) => Promise<User>;
  incrementFailedAttempts: (email: string) => Promise<User>;
  createSession: (userId: string) => Promise<Session>;
  findSessionById: (id: string) => Promise<Session | null>;
  endSession: (sessionId: string, userId: string) => Promise<Session>;
}

const MAX_FAILED_ATTEMPTS = 5;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const sendCodeLimiter = new RateLimiter(15 * 60 * 1000, 5); // 5 per 15 min per IP
const verifyCodeLimiter = new RateLimiter(15 * 60 * 1000, 10); // 10 per 15 min per email
const livekitTokenLimiter = new RateLimiter(15 * 60 * 1000, 10); // 10 per 15 min per user

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

export function createAuthRoutes(
  deps: AuthDeps,
  livekitConfig: Pick<
    import("../ApiServer").LiveKitConfig,
    "apiKey" | "apiSecret"
  >,
) {
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

    logger.debug(`[AUTH] Verification code sent for ${email}`);

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
        401,
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

    return c.json({ token, isNewUser: isNewUser(user) });
  });

  app.post("/livekit-token", authMiddleware, async (c) => {
    const userId = c.get("userId");
    if (!livekitTokenLimiter.isAllowed(userId)) {
      return c.json({ error: "Too many requests" }, 429);
    }
    const { apiKey, apiSecret } = livekitConfig;
    const roomName = `alpha-room-${userId}-${randomUUID()}`;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: "10m",
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const dispatch = new RoomAgentDispatch({ agentName: AGENT_NAME });
    at.roomConfig = new RoomConfiguration({ agents: [dispatch] });

    return c.json({ token: await at.toJwt(), roomName });
  });

  app.post("/logout", authMiddleware, async (c) => {
    const userId = c.get("userId");
    const sessionId = c.get("sessionId");
    await deps.endSession(sessionId, userId);
    return c.json({ success: true });
  });

  return app;
}
