import { eq, desc, gt, and, isNull } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import { db } from "../client";
import {
  podcastEpisodes,
  type PodcastEpisode,
  type NewPodcastEpisode,
} from "../schema/podcast_episodes";
import { listenHistory } from "../schema/listen_history";

export async function createEpisode(
  data: NewPodcastEpisode
): Promise<PodcastEpisode> {
  const result = await db.insert(podcastEpisodes).values(data).returning();
  return result[0];
}

export async function findEpisodesByShow(
  showName: string,
  limit = 20
): Promise<PodcastEpisode[]> {
  return db
    .select()
    .from(podcastEpisodes)
    .where(eq(podcastEpisodes.showName, showName))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(Math.min(limit, 100));
}

export async function findLatestEpisode(
  showName: string
): Promise<PodcastEpisode | null> {
  const result = await db
    .select()
    .from(podcastEpisodes)
    .where(eq(podcastEpisodes.showName, showName))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(1);
  return result[0] || null;
}

export async function findEpisodeById(
  id: string
): Promise<PodcastEpisode | null> {
  const result = await db
    .select()
    .from(podcastEpisodes)
    .where(eq(podcastEpisodes.id, id));
  return result[0] || null;
}

export async function findRecentEpisodes(
  since: Date,
  limit = 20
): Promise<PodcastEpisode[]> {
  return db
    .select()
    .from(podcastEpisodes)
    .where(gt(podcastEpisodes.publishedAt, since))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(Math.min(limit, 100));
}

export async function findNewEpisodesForUser(
  userId: string,
  since?: Date,
  limit = 20
): Promise<PodcastEpisode[]> {
  limit = Math.min(limit, 100);
  const conditions = [isNull(listenHistory.id)];
  if (since) {
    conditions.push(gt(podcastEpisodes.publishedAt, since));
  }

  return db
    .select({ ...getTableColumns(podcastEpisodes) })
    .from(podcastEpisodes)
    .leftJoin(
      listenHistory,
      and(
        eq(listenHistory.contentId, podcastEpisodes.id),
        eq(listenHistory.userId, userId),
        eq(listenHistory.contentType, "episode")
      )
    )
    .where(and(...conditions))
    .orderBy(desc(podcastEpisodes.publishedAt))
    .limit(limit);
}
