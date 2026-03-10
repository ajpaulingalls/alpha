import { eq, and, desc, gt } from "drizzle-orm";
import { db } from "../client";
import { listenHistory, type ListenHistory } from "../schema/listen_history";

export async function recordListen(
  sessionId: string,
  userId: string,
  contentType: string,
  contentId: string
): Promise<ListenHistory> {
  const result = await db
    .insert(listenHistory)
    .values({ sessionId, userId, contentType, contentId })
    .returning();
  return result[0];
}

export async function updateCompletedPercent(
  id: string,
  percent: number
): Promise<ListenHistory> {
  const result = await db
    .update(listenHistory)
    .set({ completedPercent: percent })
    .where(eq(listenHistory.id, id))
    .returning();

  if (!result[0]) {
    throw new Error(`Listen history entry ${id} not found`);
  }

  return result[0];
}

export async function findRecentListens(
  userId: string,
  since: Date
): Promise<ListenHistory[]> {
  return db
    .select()
    .from(listenHistory)
    .where(
      and(eq(listenHistory.userId, userId), gt(listenHistory.listenedAt, since))
    )
    .orderBy(desc(listenHistory.listenedAt));
}

export async function hasUserHeard(
  userId: string,
  contentType: string,
  contentId: string
): Promise<boolean> {
  const result = await db
    .select()
    .from(listenHistory)
    .where(
      and(
        eq(listenHistory.userId, userId),
        eq(listenHistory.contentType, contentType),
        eq(listenHistory.contentId, contentId)
      )
    )
    .limit(1);
  return result.length > 0;
}
