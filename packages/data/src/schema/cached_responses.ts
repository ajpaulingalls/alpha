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

export const cachedResponses = pgTable(
  "cached_responses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queryEmbedding: vector("query_embedding", { dimensions: 1536 }),
    responseText: text("response_text"),
    audioFilename: varchar("audio_filename", { length: 255 }),
    sourceSummary: text("source_summary"),
    contentType: varchar("content_type", { length: 20 }),
    expiresAt: timestamp("expires_at"),
    hitCount: integer("hit_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("cachedResponseEmbeddingIndex").using(
      "hnsw",
      table.queryEmbedding.op("vector_cosine_ops")
    ),
    index("cached_responses_expires_at_idx").on(table.expiresAt),
  ]
);

export type CachedResponse = typeof cachedResponses.$inferSelect;
export type NewCachedResponse = typeof cachedResponses.$inferInsert;
