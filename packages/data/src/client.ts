import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbConfig } from "./config";
import * as schema from "./schema/index.js";

// Create a PostgreSQL connection
const client = postgres(dbConfig.database.url);

// Create a Drizzle client instance
export const db = drizzle(client, { schema });

// Export the client for direct access if needed
export { client };
