import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  verificationCode: varchar("verification_code", { length: 64 }),
  validated: boolean("validated").default(false).notNull(),
  validationTimeout: timestamp("validation_timeout"),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
