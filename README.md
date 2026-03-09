# Alpha

An AI-powered podcast platform that automatically generates podcasts from news articles, indexes existing podcasts for semantic search, and delivers them through a real-time voice interface on mobile.

## How It Works

1. **Generator** scrapes news articles (Al Jazeera), summarizes them with GPT, writes a two-host podcast script, and converts it to audio using OpenAI TTS voices.
2. **Importer** fetches podcasts from Omny Studio, transcribes them, splits into topics, and indexes embeddings in PostgreSQL (pgvector) for RAG-based search.
3. **Server** handles real-time voice interactions — users connect via the mobile app, authenticate through a voice-guided signup flow (powered by OpenAI Realtime API), and can then listen to and discuss podcasts.
4. **Client** is a React Native/Expo mobile app that streams audio bidirectionally with the server over Socket.io.

## Prerequisites

- [Bun](https://bun.sh) v1.1.38+
- PostgreSQL with the [pgvector](https://github.com/pgvector/pgvector) extension
- OpenAI API key

## Getting Started

```bash
# Install dependencies
bun install

# Set up environment variables (each app has its own .env)
cp apps/server/.env.example apps/server/.env   # edit with your keys

# Run database migrations
cd packages/data
bun run migrate

# Start the server (from repo root)
bun run dev
```

## Project Structure

```
apps/
  server/       Hono HTTP + Socket.io WebSocket server
  generator/    Podcast generation workflows (@ts-flow)
  importer/     Podcast indexing workflows (@ts-flow)
  client/       React Native/Expo mobile app

packages/
  ai/           OpenAI TTS audio generation utilities (@alpha/ai)
  data/         Drizzle ORM database layer + schemas (@alpha/data)
  socket/       Shared Socket.io type definitions (@alpha/socket)
```

## Running Each App

```bash
# Server (real-time voice + API) — also available via `bun run dev` from root
cd apps/server && bun run dev

# Podcast generator (compiles TypeScript first)
cd apps/generator && bun run dev

# Podcast importer
cd apps/importer && bun run dev

# Mobile client
cd apps/client && bun start
```

## Database

Uses Drizzle ORM with PostgreSQL. Migrations and tooling live in `packages/data/`.

```bash
cd packages/data
bun run generate   # generate migrations from schema changes
bun run migrate    # apply pending migrations
bun run studio     # open Drizzle Studio UI
```

## Environment Variables

| Variable                     | Used By                     | Description                          |
| ---------------------------- | --------------------------- | ------------------------------------ |
| `OPENAI_API_KEY`             | server, generator, importer | OpenAI API access                    |
| `DATABASE_URL`               | server, data                | PostgreSQL connection string         |
| `POSTGRES_CONNECTION_STRING` | generator, importer         | PostgreSQL connection (for @ts-flow) |
| `JWT_SECRET`                 | server                      | Secret for signing auth tokens       |
| `PORT`                       | server                      | HTTP server port (default: 8081)     |
| `CORS_HOSTS`                 | server                      | Allowed CORS origins (JSON array)    |
| `OMNY_STUDIO_API_KEY`        | importer                    | Omny Studio podcast API access       |

## Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript (strict mode)
- **Server:** Hono, Socket.io, OpenAI Realtime API
- **Mobile:** React Native, Expo
- **Database:** PostgreSQL, Drizzle ORM, pgvector
- **AI:** OpenAI GPT-4o-mini, text-embedding-3-small, TTS (onyx/shimmer voices)
- **Workflows:** @ts-flow framework (JSON-defined node graphs)
