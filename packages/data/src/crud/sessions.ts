import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import { sessions, type Session } from "../schema/sessions";
import { updateOneOrThrow } from "./helpers";

export async function createSession(userId: string): Promise<Session> {
  const result = await db
    .insert(sessions)
    .values({ userId, startedAt: new Date() })
    .returning();
  return result[0];
}

export async function findSessionById(
  sessionId: string
): Promise<Session | null> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
  return result[0] || null;
}

export async function endSession(sessionId: string): Promise<Session> {
  return updateOneOrThrow(
    db
      .update(sessions)
      .set({ endedAt: new Date() })
      .where(eq(sessions.id, sessionId))
      .returning(),
    `Session ${sessionId} not found`
  );
}

export async function findLatestSession(
  userId: string
): Promise<Session | null> {
  const result = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.startedAt))
    .limit(1);
  return result[0] || null;
}

export async function markCatchUpDelivered(
  sessionId: string
): Promise<Session> {
  return updateOneOrThrow(
    db
      .update(sessions)
      .set({ catchUpDelivered: true })
      .where(eq(sessions.id, sessionId))
      .returning(),
    `Session ${sessionId} not found`
  );
}
