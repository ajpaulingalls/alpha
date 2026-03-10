import { eq, asc, sql } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { getTableColumns } from "drizzle-orm/utils";
import { db } from "../client";
import {
  podcastTopics,
  type PodcastTopic,
  type NewPodcastTopic,
} from "../schema/podcast_topics";

export async function createTopic(
  data: NewPodcastTopic
): Promise<PodcastTopic> {
  const result = await db.insert(podcastTopics).values(data).returning();
  return result[0];
}

export async function createTopics(
  data: NewPodcastTopic[]
): Promise<PodcastTopic[]> {
  return db.insert(podcastTopics).values(data).returning();
}

export async function findTopicsByEpisode(
  episodeId: string
): Promise<PodcastTopic[]> {
  return db
    .select()
    .from(podcastTopics)
    .where(eq(podcastTopics.episodeId, episodeId))
    .orderBy(asc(podcastTopics.startTime));
}

export async function findTopicById(id: string): Promise<PodcastTopic | null> {
  const result = await db
    .select()
    .from(podcastTopics)
    .where(eq(podcastTopics.id, id));
  return result[0] || null;
}

export async function searchTopicsByEmbedding(
  embedding: number[],
  limit = 10
): Promise<(PodcastTopic & { distance: number })[]> {
  const distance = sql<number>`${cosineDistance(
    podcastTopics.embedding,
    embedding
  )}`;
  return db
    .select({ ...getTableColumns(podcastTopics), distance })
    .from(podcastTopics)
    .orderBy(distance)
    .limit(limit);
}
