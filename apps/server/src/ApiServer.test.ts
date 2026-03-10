import { describe, expect, test, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import jwt from "jsonwebtoken";
import type { User } from "@alpha/data/schema/users";
import type { Session } from "@alpha/data/schema/sessions";
import { ApiServer } from "./ApiServer";
import { JWT_ISSUER, JWT_AUDIENCE, type AuthDeps } from "./routes/auth";

const TEST_SECRET = "test-secret-that-is-at-least-32-chars-long";
const TEST_LK_CONFIG = {
  apiKey: "test-lk-key",
  apiSecret: "test-lk-secret-that-is-long-enough",
  url: "wss://test.livekit.cloud",
};

const mockFindUserByEmail = mock<(email: string) => Promise<User | null>>(() =>
  Promise.resolve(null)
);
const mockUpsertUserWithCode = mock<
  (email: string, code: string, timeout: Date) => Promise<User>
>(() => Promise.resolve({} as User));
const mockUpdateUserValidation = mock<
  (email: string, validated: boolean) => Promise<User>
>(() => Promise.resolve({} as User));
const mockClearVerificationCode = mock<(email: string) => Promise<User>>(() =>
  Promise.resolve({} as User)
);
const mockIncrementFailedAttempts = mock<(email: string) => Promise<User>>(() =>
  Promise.resolve({} as User)
);
const mockCreateSession = mock<(userId: string) => Promise<Session>>(() =>
  Promise.resolve({} as Session)
);
const mockFindSessionById = mock<(id: string) => Promise<Session | null>>(() =>
  Promise.resolve(null)
);

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-uuid-123",
    email: "test@example.com",
    name: "Test User",
    verificationCode:
      "a]fake-hmac-hash-that-is-exactly-sixty-four-characters-long-pad",
    validated: false,
    validationTimeout: new Date(Date.now() + 30 * 60 * 1000),
    failedAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeSession(overrides: Record<string, unknown> = {}): Session {
  return {
    id: "session-uuid",
    userId: "user-uuid-123",
    startedAt: new Date(),
    endedAt: null,
    catchUpDelivered: false,
    ...overrides,
  } as Session;
}

function mockDeps(): AuthDeps {
  return {
    findUserByEmail: mockFindUserByEmail,
    upsertUserWithCode: mockUpsertUserWithCode,
    updateUserValidation: mockUpdateUserValidation,
    clearVerificationCode: mockClearVerificationCode,
    incrementFailedAttempts: mockIncrementFailedAttempts,
    createSession: mockCreateSession,
    findSessionById: mockFindSessionById,
  };
}

function createTestApp() {
  const server = new ApiServer("test-key", "*", TEST_SECRET, TEST_LK_CONFIG);
  server.initServer(mockDeps());
  return server.getServer();
}

function postJson(
  app: ReturnType<typeof createTestApp>,
  path: string,
  body: unknown,
  headers?: Record<string, string>
) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function signTestToken(
  payload: Record<string, unknown>,
  options?: jwt.SignOptions
) {
  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: "30d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    ...options,
  });
}

describe("ApiServer", () => {
  beforeEach(() => {
    mockFindUserByEmail.mockReset();
    mockUpsertUserWithCode.mockReset();
    mockUpdateUserValidation.mockReset();
    mockClearVerificationCode.mockReset();
    mockIncrementFailedAttempts.mockReset();
    mockCreateSession.mockReset();
    mockFindSessionById.mockReset();

    mockFindUserByEmail.mockResolvedValue(null);
    mockUpsertUserWithCode.mockResolvedValue(makeUser());
    mockUpdateUserValidation.mockResolvedValue(makeUser());
    mockClearVerificationCode.mockResolvedValue(makeUser());
    mockIncrementFailedAttempts.mockResolvedValue(makeUser());
    mockCreateSession.mockResolvedValue(makeSession());
    mockFindSessionById.mockResolvedValue(makeSession());
  });

  test("constructor accepts 4 arguments", () => {
    const server = new ApiServer("test-key", "*", TEST_SECRET, TEST_LK_CONFIG);
    expect(server.getServer()).toBeInstanceOf(Hono);
  });

  test("GET /api/health returns { status: 'ok' }", async () => {
    const app = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });

  describe("POST /api/auth/send-code", () => {
    test("returns 400 for missing email", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/send-code", {});
      expect(res.status).toBe(400);
    });

    test("returns 400 for invalid email format", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/send-code", {
        email: "not-an-email",
      });
      expect(res.status).toBe(400);
    });

    test("upserts user with hashed code", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/send-code", {
        email: "new@example.com",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
      expect(mockUpsertUserWithCode).toHaveBeenCalledTimes(1);
      const args = mockUpsertUserWithCode.mock.calls[0];
      expect(args[0]).toBe("new@example.com");
      // Code should be HMAC-hashed (64 hex chars)
      expect(args[1]).toHaveLength(64);
      expect(args[2]).toBeInstanceOf(Date);
    });
  });

  describe("POST /api/auth/verify-code", () => {
    test("returns 400 for invalid email format", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "bad",
        code: "123456",
      });
      expect(res.status).toBe(400);
    });

    test("returns 400 for non-numeric code", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "abcdef",
      });
      expect(res.status).toBe(400);
    });

    test("returns 400 for wrong length code", async () => {
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "12345",
      });
      expect(res.status).toBe(400);
    });

    test("returns 401 when user not found", async () => {
      mockFindUserByEmail.mockResolvedValue(null);
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "nobody@example.com",
        code: "123456",
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 for expired code", async () => {
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ validationTimeout: new Date(Date.now() - 1000) })
      );
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 and increments failed attempts for wrong code", async () => {
      const { createHmac } = await import("node:crypto");
      const wrongHash = createHmac("sha256", TEST_SECRET)
        .update("654321")
        .digest("hex");
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ verificationCode: wrongHash })
      );
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(res.status).toBe(401);
      expect(mockIncrementFailedAttempts).toHaveBeenCalledWith(
        "test@example.com"
      );
    });

    test("returns 401 and clears code after max failed attempts", async () => {
      mockFindUserByEmail.mockResolvedValue(makeUser({ failedAttempts: 5 }));
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(res.status).toBe(401);
      expect(mockClearVerificationCode).toHaveBeenCalledWith(
        "test@example.com"
      );
    });

    test("returns 200 with isNewUser: false for user with name", async () => {
      const { createHmac } = await import("node:crypto");
      const hashedCode = createHmac("sha256", TEST_SECRET)
        .update("123456")
        .digest("hex");
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ name: "Alice", verificationCode: hashedCode })
      );
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isNewUser).toBe(false);
      expect(typeof body.token).toBe("string");
    });

    test("returns 200 with isNewUser: true for user without name", async () => {
      const { createHmac } = await import("node:crypto");
      const hashedCode = createHmac("sha256", TEST_SECRET)
        .update("123456")
        .digest("hex");
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ name: "", verificationCode: hashedCode })
      );
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.isNewUser).toBe(true);
    });

    test("creates session on success", async () => {
      const { createHmac } = await import("node:crypto");
      const hashedCode = createHmac("sha256", TEST_SECRET)
        .update("123456")
        .digest("hex");
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ verificationCode: hashedCode })
      );
      const app = createTestApp();
      await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      expect(mockCreateSession).toHaveBeenCalledWith("user-uuid-123");
    });

    test("returns JWT with userId, sessionId, iss, and aud", async () => {
      const { createHmac } = await import("node:crypto");
      const hashedCode = createHmac("sha256", TEST_SECRET)
        .update("123456")
        .digest("hex");
      mockFindUserByEmail.mockResolvedValue(
        makeUser({ verificationCode: hashedCode })
      );
      const app = createTestApp();
      const res = await postJson(app, "/api/auth/verify-code", {
        email: "test@example.com",
        code: "123456",
      });
      const body = await res.json();
      const decoded = jwt.verify(body.token, TEST_SECRET, {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as jwt.JwtPayload;
      expect(decoded["userId"]).toBe("user-uuid-123");
      expect(decoded["sessionId"]).toBe("session-uuid");
      expect(decoded["iss"]).toBe(JWT_ISSUER);
      expect(decoded["aud"]).toBe(JWT_AUDIENCE);
    });
  });

  describe("POST /api/auth/livekit-token", () => {
    test("returns 401 with no auth header", async () => {
      const app = createTestApp();
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 with malformed token", async () => {
      const app = createTestApp();
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: "Bearer invalid-token" },
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 for token without iss/aud claims", async () => {
      const app = createTestApp();
      const token = jwt.sign({ userId: "user-uuid-123" }, TEST_SECRET, {
        expiresIn: "30d",
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
    });

    test("returns 401 for token with missing sessionId", async () => {
      const app = createTestApp();
      const token = signTestToken({ userId: "user-uuid-123" });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid token payload");
    });

    test("returns 401 for token with non-string sessionId", async () => {
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: 12345,
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid token payload");
    });

    test("returns 401 for ended session", async () => {
      mockFindSessionById.mockResolvedValue(
        makeSession({ endedAt: new Date() })
      );
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(401);
    });

    test("returns 200 with real LiveKit token and room name", async () => {
      mockFindSessionById.mockResolvedValue(makeSession());
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(0);
      expect(body.roomName).toMatch(/^alpha-room-user-uuid-123-[a-f0-9-]+$/);
    });

    test("room name contains the userId", async () => {
      mockFindSessionById.mockResolvedValue(makeSession());
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      expect(body.roomName).toContain("user-uuid-123");
    });

    test("does not return 429 on first request", async () => {
      mockFindSessionById.mockResolvedValue(makeSession());
      const app = createTestApp();
      const token = signTestToken({
        userId: "rate-limit-test-user",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/auth/livekit-token", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).not.toBe(429);
    });
  });
});
