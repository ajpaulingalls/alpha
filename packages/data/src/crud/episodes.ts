import { eq, desc } from "drizzle-orm";
import { db } from "../client";
import {
  podcastEpisodes,
  type PodcastEpisode,
  type NewPodcastEpisode,
} from "../schema/podcast_episodes";

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
    .limit(limit);
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
