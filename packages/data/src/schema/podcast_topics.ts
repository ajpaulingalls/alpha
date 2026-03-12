import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  vector,
  index,
} from "drizzle-orm/pg-core";
import { podcastEpisodes } from "./podcast_episodes";

export const podcastTopics = pgTable(
  "podcast_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    filename: varchar("filename", { length: 255 }).notNull(),
    episodeId: uuid("episode_id").references(() => podcastEpisodes.id),
    startTime: integer("start_time"),
    endTime: integer("end_time"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    index("podcast_topics_episode_id_idx").on(table.episodeId),
  ],
);

export type PodcastTopic = typeof podcastTopics.$inferSelect;
export type NewPodcastTopic = typeof podcastTopics.$inferInsert;
