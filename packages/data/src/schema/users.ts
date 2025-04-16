import { pgTable, uuid, varchar, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  verificationCode: varchar('verification_code', { length: 6 }),
  validated: boolean('validated').default(false).notNull(),
  validationTimeout: timestamp('validation_timeout'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert; 