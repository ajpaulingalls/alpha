import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const podcastEpisodes = pgTable(
  "podcast_episodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    showName: varchar("show_name", { length: 255 }),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    publishedAt: timestamp("published_at"),
    sourceUrl: varchar("source_url", { length: 500 }),
    audioFilename: varchar("audio_filename", { length: 255 }),
    duration: integer("duration"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("podcast_episodes_show_name_idx").on(table.showName),
    index("podcast_episodes_published_at_idx").on(table.publishedAt),
  ]
);

export type PodcastEpisode = typeof podcastEpisodes.$inferSelect;
export type NewPodcastEpisode = typeof podcastEpisodes.$inferInsert;
