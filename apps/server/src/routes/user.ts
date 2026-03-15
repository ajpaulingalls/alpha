import { Hono } from "hono";
import { z } from "zod";
import type { User } from "@alpha/data/schema/users";
import type {
  UserPreference,
  CatchUpDepth,
} from "@alpha/data/schema/user_preferences";
import type { Session } from "@alpha/data/schema/sessions";
import { createAuthMiddleware, type AuthEnv } from "../middleware/auth";
import { RateLimiter } from "../utils/rateLimit";

export interface UserDeps {
  findSessionById: (id: string) => Promise<Session | null>;
  findUserById: (id: string) => Promise<User | null>;
  findPreferencesByUserId: (userId: string) => Promise<UserPreference | null>;
  updatePreferences: (
    userId: string,
    updates: Partial<
      Pick<UserPreference, "timezone" | "catchUpDepth" | "preferences">
    >,
  ) => Promise<UserPreference>;
  createPreferences: (
    userId: string,
    timezone?: string,
    catchUpDepth?: string,
  ) => Promise<UserPreference>;
}

const UpdatePreferencesBody = z.object({
  timezone: z.string().optional(),
  catchUpDepth: z.enum(["brief", "standard", "detailed"]).optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

const prefsLimiter = new RateLimiter(15 * 60 * 1000, 30); // 30 per 15 min per user

export function createUserRoutes(deps: UserDeps) {
  const app = new Hono<AuthEnv>();
  const authMiddleware = createAuthMiddleware(deps.findSessionById);

  app.get("/preferences", authMiddleware, async (c) => {
    const userId = c.get("userId");
    if (!prefsLimiter.isAllowed(userId)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    const [user, prefs] = await Promise.all([
      deps.findUserById(userId),
      deps.findPreferencesByUserId(userId),
    ]);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    return c.json({
      user: { name: user.name, email: user.email },
      preferences: {
        timezone: prefs?.timezone ?? null,
        catchUpDepth: (prefs?.catchUpDepth ?? "standard") as CatchUpDepth,
        preferences: prefs?.preferences ?? {},
      },
    });
  });

  app.put("/preferences", authMiddleware, async (c) => {
    const putUserId = c.get("userId");
    if (!prefsLimiter.isAllowed(putUserId)) {
      return c.json({ error: "Too many requests" }, 429);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const result = UpdatePreferencesBody.safeParse(body);
    if (!result.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const userId = c.get("userId");
    const { timezone, catchUpDepth, preferences } = result.data;

    await deps.createPreferences(userId, timezone, catchUpDepth);

    const updates: Partial<
      Pick<UserPreference, "timezone" | "catchUpDepth" | "preferences">
    > = {};
    if (timezone !== undefined) updates.timezone = timezone;
    if (catchUpDepth !== undefined) updates.catchUpDepth = catchUpDepth;
    if (preferences !== undefined) updates.preferences = preferences;

    const updated = await deps.updatePreferences(userId, updates);

    return c.json({
      preferences: {
        timezone: updated.timezone,
        catchUpDepth: updated.catchUpDepth as CatchUpDepth,
        preferences: updated.preferences,
      },
    });
  });

  return app;
}
