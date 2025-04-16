export const DATABASE_URL =
  process.env["DATABASE_URL"] ||
  "postgres://postgres:postgres@localhost:5432/alpha";

export const dbConfig = {
  database: {
    url: DATABASE_URL,
  },
};
