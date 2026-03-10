/**
 * Awaits an update/delete query that returns rows via `.returning()`,
 * throws if no row was affected, otherwise returns the first row.
 */
export async function updateOneOrThrow<T>(
  query: Promise<T[]>,
  errorMessage: string
): Promise<T> {
  const result = await query;
  if (!result[0]) {
    throw new Error(errorMessage);
  }
  return result[0];
}
