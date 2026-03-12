import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { users, type User } from "../schema/users";
import { updateOneOrThrow } from "./helpers";

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function upsertUserWithCode(
  email: string,
  verificationCode: string,
  validationTimeout: Date,
): Promise<User> {
  const result = await db
    .insert(users)
    .values({
      name: "",
      email,
      verificationCode,
      validationTimeout,
      validated: false,
      failedAttempts: 0,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        verificationCode,
        validationTimeout,
        failedAttempts: 0,
        updatedAt: new Date(),
      },
    })
    .returning();
  return result[0];
}

export async function updateUserValidation(
  email: string,
  validated: boolean,
): Promise<User> {
  return updateOneOrThrow(
    db
      .update(users)
      .set({
        validated,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning(),
    "User not found for validation update",
  );
}

export async function clearVerificationCode(email: string): Promise<User> {
  return updateOneOrThrow(
    db
      .update(users)
      .set({
        verificationCode: null,
        validationTimeout: null,
        failedAttempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning(),
    "User not found for verification code clear",
  );
}

export async function incrementFailedAttempts(email: string): Promise<User> {
  return updateOneOrThrow(
    db
      .update(users)
      .set({
        failedAttempts: sql`${users.failedAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning(),
    "User not found for failed attempts increment",
  );
}

export async function updateUserName(
  userId: string,
  name: string,
): Promise<User> {
  return updateOneOrThrow(
    db
      .update(users)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning(),
    `User with id ${userId} not found`,
  );
}
