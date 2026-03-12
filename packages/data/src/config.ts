const envUrl = process.env["DATABASE_URL"];
if (!envUrl) {
  throw new Error(
    'Environment variable "DATABASE_URL" is required.\n' +
      "Please set it in your .env file.",
  );
}

export const DATABASE_URL = envUrl;

export const dbConfig = {
  database: {
    url: DATABASE_URL,
  },
};
