import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  vector,
  index,
} from "drizzle-orm/pg-core";

export const podcastTopics = pgTable(
  "podcast_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    summary: text("summary").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    filename: varchar("filename", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("embeddingIndex").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type PodcastTopic = typeof podcastTopics.$inferSelect;
export type NewPodcastTopic = typeof podcastTopics.$inferInsert;
