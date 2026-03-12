import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  userPreferences,
  type UserPreference,
} from "../schema/user_preferences";
import { updateOneOrThrow } from "./helpers";

export async function findPreferencesByUserId(
  userId: string,
): Promise<UserPreference | null> {
  const result = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));
  return result[0] || null;
}

export async function createPreferences(
  userId: string,
  timezone?: string,
  catchUpDepth?: string,
): Promise<UserPreference> {
  const values: Record<string, unknown> = { userId };
  if (timezone !== undefined) values["timezone"] = timezone;
  if (catchUpDepth !== undefined) values["catchUpDepth"] = catchUpDepth;

  const existing = await findPreferencesByUserId(userId);
  if (existing) return existing;

  const result = await db
    .insert(userPreferences)
    .values(values as typeof userPreferences.$inferInsert)
    .returning();
  return result[0];
}

export async function updatePreferences(
  userId: string,
  updates: Partial<
    Pick<UserPreference, "timezone" | "catchUpDepth" | "preferences">
  >,
): Promise<UserPreference> {
  return updateOneOrThrow(
    db
      .update(userPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userPreferences.userId, userId))
      .returning(),
    `Preferences for user ${userId} not found`,
  );
}

export async function updatePreferencesJson(
  userId: string,
  jsonUpdates: Record<string, unknown>,
): Promise<UserPreference> {
  return updateOneOrThrow(
    db
      .update(userPreferences)
      .set({
        preferences: sql`COALESCE(${
          userPreferences.preferences
        }, '{}'::jsonb) || ${JSON.stringify(jsonUpdates)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, userId))
      .returning(),
    `Preferences for user ${userId} not found`,
  );
}
