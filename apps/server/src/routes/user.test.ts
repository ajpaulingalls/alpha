import { describe, expect, test, mock, beforeEach } from "bun:test";
import jwt from "jsonwebtoken";
import type { User } from "@alpha/data/schema/users";
import type { UserPreference } from "@alpha/data/schema/user_preferences";
import type { Session } from "@alpha/data/schema/sessions";
import { ApiServer } from "../ApiServer";
import { JWT_ISSUER, JWT_AUDIENCE, type AuthDeps } from "./auth";
import type { UserDeps } from "./user";

const TEST_SECRET = "test-secret-that-is-at-least-32-chars-long";
const TEST_LK_CONFIG = {
  apiKey: "test-lk-key",
  apiSecret: "test-lk-secret-that-is-long-enough",
  url: "wss://test.livekit.cloud",
};

function makeUser(overrides: Record<string, unknown> = {}): User {
  return {
    id: "user-uuid-123",
    email: "test@example.com",
    name: "Test User",
    verificationCode: null,
    validated: true,
    validationTimeout: null,
    failedAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
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

function makePrefs(overrides: Record<string, unknown> = {}): UserPreference {
  return {
    id: "pref-uuid",
    userId: "user-uuid-123",
    timezone: "America/New_York",
    catchUpDepth: "standard",
    preferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserPreference;
}

function signTestToken(payload: Record<string, unknown>) {
  return jwt.sign(payload, TEST_SECRET, {
    expiresIn: "30d",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

const mockFindSessionById = mock<(id: string) => Promise<Session | null>>(() =>
  Promise.resolve(makeSession()),
);
const mockFindUserById = mock<(id: string) => Promise<User | null>>(() =>
  Promise.resolve(makeUser()),
);
const mockFindPreferencesByUserId = mock<
  (userId: string) => Promise<UserPreference | null>
>(() => Promise.resolve(makePrefs()));
const mockUpdatePreferences = mock<
  (
    userId: string,
    updates: Partial<
      Pick<UserPreference, "timezone" | "catchUpDepth" | "preferences">
    >,
  ) => Promise<UserPreference>
>(() => Promise.resolve(makePrefs()));
const mockCreatePreferences = mock<
  (
    userId: string,
    timezone?: string,
    catchUpDepth?: string,
  ) => Promise<UserPreference>
>(() => Promise.resolve(makePrefs()));

function createTestApp() {
  const authDeps: AuthDeps = {
    findUserByEmail: mock(() => Promise.resolve(null)),
    upsertUserWithCode: mock(() => Promise.resolve({} as User)),
    updateUserValidation: mock(() => Promise.resolve({} as User)),
    clearVerificationCode: mock(() => Promise.resolve({} as User)),
    incrementFailedAttempts: mock(() => Promise.resolve({} as User)),
    createSession: mock(() => Promise.resolve({} as Session)),
    findSessionById: mockFindSessionById,
    endSession: mock(() => Promise.resolve({} as Session)),
  };
  const userDeps: UserDeps = {
    findSessionById: mockFindSessionById,
    findUserById: mockFindUserById,
    findPreferencesByUserId: mockFindPreferencesByUserId,
    updatePreferences: mockUpdatePreferences,
    createPreferences: mockCreatePreferences,
  };
  const server = new ApiServer("test-key", "*", TEST_SECRET, TEST_LK_CONFIG);
  server.initServer(authDeps, userDeps);
  return server.getServer();
}

describe("User routes", () => {
  beforeEach(() => {
    mockFindSessionById.mockReset();
    mockFindUserById.mockReset();
    mockFindPreferencesByUserId.mockReset();
    mockUpdatePreferences.mockReset();
    mockCreatePreferences.mockReset();

    mockFindSessionById.mockResolvedValue(makeSession());
    mockFindUserById.mockResolvedValue(makeUser());
    mockFindPreferencesByUserId.mockResolvedValue(makePrefs());
    mockUpdatePreferences.mockResolvedValue(makePrefs());
    mockCreatePreferences.mockResolvedValue(makePrefs());
  });

  describe("GET /api/user/preferences", () => {
    test("returns 401 without auth", async () => {
      const app = createTestApp();
      const res = await app.request("/api/user/preferences");
      expect(res.status).toBe(401);
    });

    test("returns user info and preferences", async () => {
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.user).toEqual({
        name: "Test User",
        email: "test@example.com",
      });
      expect(body.preferences.timezone).toBe("America/New_York");
      expect(body.preferences.catchUpDepth).toBe("standard");
      expect(body.preferences.preferences).toEqual({});
    });

    test("returns defaults when no prefs row exists", async () => {
      mockFindPreferencesByUserId.mockResolvedValue(null);
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences.timezone).toBeNull();
      expect(body.preferences.catchUpDepth).toBe("standard");
      expect(body.preferences.preferences).toEqual({});
    });
  });

  describe("PUT /api/user/preferences", () => {
    test("returns 401 without auth", async () => {
      const app = createTestApp();
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catchUpDepth: "brief" }),
      });
      expect(res.status).toBe(401);
    });

    test("validates catchUpDepth enum", async () => {
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ catchUpDepth: "invalid" }),
      });
      expect(res.status).toBe(400);
    });

    test("updates catchUpDepth", async () => {
      const updated = makePrefs({ catchUpDepth: "brief" });
      mockUpdatePreferences.mockResolvedValue(updated);
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ catchUpDepth: "brief" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences.catchUpDepth).toBe("brief");
      expect(mockCreatePreferences).toHaveBeenCalledWith(
        "user-uuid-123",
        undefined,
        "brief",
      );
    });

    test("updates timezone", async () => {
      const updated = makePrefs({ timezone: "Europe/London" });
      mockUpdatePreferences.mockResolvedValue(updated);
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ timezone: "Europe/London" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences.timezone).toBe("Europe/London");
    });

    test("creates prefs if none exist", async () => {
      mockCreatePreferences.mockResolvedValue(makePrefs());
      const app = createTestApp();
      const token = signTestToken({
        userId: "user-uuid-123",
        sessionId: "session-uuid",
      });
      const res = await app.request("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ catchUpDepth: "detailed" }),
      });
      expect(res.status).toBe(200);
      expect(mockCreatePreferences).toHaveBeenCalledTimes(1);
    });
  });
});
