import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { sessions } from "./sessions";
import { users } from "./users";

export const listenHistory = pgTable(
  "listen_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => sessions.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    contentType: varchar("content_type", { length: 20 }).notNull(),
    contentId: uuid("content_id").notNull(),
    listenedAt: timestamp("listened_at").defaultNow().notNull(),
    completedPercent: integer("completed_percent").default(0).notNull(),
  },
  (table) => [
    index("listen_history_user_id_idx").on(table.userId),
    index("listen_history_session_id_idx").on(table.sessionId),
  ]
);

export type ListenContentType = "episode" | "topic";
export type ListenHistory = typeof listenHistory.$inferSelect;
export type NewListenHistory = typeof listenHistory.$inferInsert;
