import { eq } from "drizzle-orm";
import { db } from "../client";
import { users, type User, type NewUser } from "../schema/users";

export async function findUserByPhoneNumber(
  phoneNumber: string
): Promise<User | null> {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber));
  return result[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id));
  return result[0] || null;
}

export async function createUser(
  name: string,
  phoneNumber: string,
  verificationCode: string,
  validationTimeout: Date
): Promise<User> {
  const newUser: NewUser = {
    name,
    phoneNumber,
    verificationCode,
    validationTimeout,
    validated: false,
  };

  const result = await db.insert(users).values(newUser).returning();
  return result[0];
}

export async function updateUserVerificationCode(
  phoneNumber: string,
  verificationCode: string,
  validationTimeout: Date
): Promise<User> {
  const result = await db
    .update(users)
    .set({
      verificationCode,
      validationTimeout,
      validated: false,
      updatedAt: new Date(),
    })
    .where(eq(users.phoneNumber, phoneNumber))
    .returning();

  if (!result[0]) {
    throw new Error(`User with phone number ${phoneNumber} not found`);
  }

  return result[0];
}

export async function updateUserValidation(
  phoneNumber: string,
  validated: boolean
): Promise<User> {
  const result = await db
    .update(users)
    .set({
      validated,
      updatedAt: new Date(),
    })
    .where(eq(users.phoneNumber, phoneNumber))
    .returning();

  if (!result[0]) {
    throw new Error(`User with phone number ${phoneNumber} not found`);
  }

  return result[0];
}
