import { eq, and, gt, lt, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { getTableColumns } from "drizzle-orm/utils";
import { db } from "../client";
import {
  cachedResponses,
  type CachedResponse,
  type NewCachedResponse,
} from "../schema/cached_responses";

export async function createCachedResponse(
  data: NewCachedResponse
): Promise<CachedResponse> {
  const result = await db.insert(cachedResponses).values(data).returning();
  return result[0];
}

export async function searchCachedResponses(
  queryEmbedding: number[],
  similarityThreshold: number,
  limit = 5
): Promise<(CachedResponse & { distance: number })[]> {
  const distance = sql<number>`${cosineDistance(
    cachedResponses.queryEmbedding,
    queryEmbedding
  )}`;
  return db
    .select({ ...getTableColumns(cachedResponses), distance })
    .from(cachedResponses)
    .where(
      and(
        gt(cachedResponses.expiresAt, new Date()),
        sql`${distance} < ${similarityThreshold}`
      )
    )
    .orderBy(distance)
    .limit(limit);
}

export async function incrementHitCount(id: string): Promise<CachedResponse> {
  const result = await db
    .update(cachedResponses)
    .set({
      hitCount: sql`${cachedResponses.hitCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(cachedResponses.id, id))
    .returning();

  if (!result[0]) {
    throw new Error(`Cached response ${id} not found`);
  }

  return result[0];
}

export async function deleteExpired(): Promise<number> {
  const result = await db
    .delete(cachedResponses)
    .where(lt(cachedResponses.expiresAt, new Date()))
    .returning();
  return result.length;
}
