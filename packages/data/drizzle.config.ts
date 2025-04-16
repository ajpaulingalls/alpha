import { defineConfig } from 'drizzle-kit';
import { DATABASE_URL } from './src/config';

export default defineConfig({
  schema: './src/schema/*',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL
  },
}); 