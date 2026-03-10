import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { users, type User, type NewUser } from "../schema/users";
import { updateOneOrThrow } from "./helpers";

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function createUser(
  name: string,
  email: string,
  verificationCode: string,
  validationTimeout: Date
): Promise<User> {
  const newUser: NewUser = {
    name,
    email,
    verificationCode,
    validationTimeout,
    validated: false,
  };

  const result = await db.insert(users).values(newUser).returning();
  return result[0];
}

export async function upsertUserWithCode(
  email: string,
  verificationCode: string,
  validationTimeout: Date
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

export async function updateUserVerificationCode(
  email: string,
  verificationCode: string,
  validationTimeout: Date
): Promise<User> {
  return updateOneOrThrow(
    db
      .update(users)
      .set({
        verificationCode,
        validationTimeout,
        validated: false,
        updatedAt: new Date(),
      })
      .where(eq(users.email, email))
      .returning(),
    `User with email ${email} not found`
  );
}

export async function updateUserValidation(
  email: string,
  validated: boolean
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
    `User with email ${email} not found`
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
    `User with email ${email} not found`
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
    `User with email ${email} not found`
  );
}

export async function updateUserName(
  userId: string,
  name: string
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
    `User with id ${userId} not found`
  );
}
