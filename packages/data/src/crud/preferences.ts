import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  userPreferences,
  type UserPreference,
} from "../schema/user_preferences";

export async function findPreferencesByUserId(
  userId: string
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
  catchUpDepth?: string
): Promise<UserPreference> {
  const values: Record<string, unknown> = { userId };
  if (timezone !== undefined) values.timezone = timezone;
  if (catchUpDepth !== undefined) values.catchUpDepth = catchUpDepth;

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
  >
): Promise<UserPreference> {
  const result = await db
    .update(userPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId))
    .returning();

  if (!result[0]) {
    throw new Error(`Preferences for user ${userId} not found`);
  }

  return result[0];
}

export async function updatePreferencesJson(
  userId: string,
  jsonUpdates: Record<string, unknown>
): Promise<UserPreference> {
  const result = await db
    .update(userPreferences)
    .set({
      preferences: sql`COALESCE(${
        userPreferences.preferences
      }, '{}'::jsonb) || ${JSON.stringify(jsonUpdates)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, userId))
    .returning();

  if (!result[0]) {
    throw new Error(`Preferences for user ${userId} not found`);
  }

  return result[0];
}
