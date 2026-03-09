# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alpha is a monorepo for an AI-powered podcast platform. It generates podcasts from news articles, indexes existing podcasts for search, serves real-time voice interactions via WebSockets, and provides a React Native mobile client.

## Monorepo Structure

- **apps/server** — Real-time WebSocket server (Hono + Socket.io) with OpenAI Realtime Voice API integration for signup and podcast playback flows
- **apps/generator** — Workflow-based podcast generator using `@ts-flow/*` framework; fetches news, generates scripts with GPT, converts to audio with TTS
- **apps/importer** — Workflow-based podcast indexer using `@ts-flow/*`; fetches podcasts from Omny Studio, transcribes, splits into topics, embeds for RAG
- **apps/client** — React Native/Expo mobile app for real-time voice interaction and podcast playback
- **packages/ai** (`@alpha/ai`) — OpenAI TTS audio generation utilities (PCM 24kHz 16-bit mono)
- **packages/data** (`@alpha/data`) — Drizzle ORM database layer with PostgreSQL + pgvector; schemas for users and podcast_topics
- **packages/socket** (`@alpha/socket`) — Shared Socket.io event type definitions

## Build & Run Commands

**Package manager:** Bun (with workspaces)

```bash
# Install dependencies
bun install

# Run server in dev mode (watch) — from root
bun run dev

# Run individual apps
cd apps/server && bun run dev
cd apps/generator && bun run dev    # runs tsc first, then bun watch
cd apps/importer && bun run dev
cd apps/client && bun start         # expo start

# Database (from packages/data)
cd packages/data
bun run generate     # drizzle-kit generate migrations
bun run migrate      # apply migrations
bun run studio       # drizzle-kit studio UI
```

## Code Quality

```bash
# Lint (ESLint with typescript-eslint strict + stylistic)
bun run lint
bun run lint:fix

# Format (Prettier)
bun run format
bun run format:check

# Type check all workspaces
bun run typecheck

# Run tests (Bun test runner)
bun test

# Run all checks (lint + format:check + typecheck)
bun run check
```

Git hooks are managed by **lefthook** (`lefthook.yml`):

- **pre-commit**: runs ESLint and Prettier on staged files
- **pre-push**: runs typecheck and tests

## Architecture

### Workflow Engine (`@ts-flow/*`)

The generator and importer apps use a JSON-defined workflow system. Workflow definitions live in `src/*.json` files and declare a graph of nodes (triggers, query engines, transforms). Custom nodes extend `NodeBase` and implement `IQueryEngine`. The `@ts-flow/core` package bootstraps workflows by loading the JSON and wiring up node implementations.

### Server Real-time Voice Flow

The server uses Socket.io for client connections with JWT authentication. Handlers (`SignupHandler`, `PodcastHandler`) extend `CommunicationsHandler`, which manages an OpenAI Realtime API WebSocket session. Voice audio streams bidirectionally between the mobile client and OpenAI. Tools (Zod-validated, in `tools/`) are exposed as function calls to the Realtime API for structured data collection.

### Database

PostgreSQL with Drizzle ORM. The `@alpha/data` package exports via subpath exports:

- `@alpha/data/crud/users` — user CRUD operations
- `@alpha/data/schema/users` — user table schema
- `@alpha/data/schema/podcast_topics` — podcast topics with 1536-dim vector embeddings (HNSW index)
- `@alpha/data/client` — database client connection

### Audio Pipeline (Generator)

`PodGenEngine` generates podcast WAV files by: parsing a JSON script with narrator roles, generating TTS audio per line (OpenAI voices: onyx=Blair, shimmer=Betty), caching PCM segments, and combining with intro/transition music into a final WAV (24kHz 16-bit mono).

## Key Conventions

- TypeScript strict mode, ESNext target, bundler module resolution
- Bun as runtime and package manager (not Node/npm)
- Workspace packages referenced as `workspace:*` in dependencies
- Environment variables loaded from `.env` files per app (DATABASE_URL, OPENAI_API_KEY, JWT_SECRET, etc.)
- Prettier for formatting (default config)
- ESLint flat config (`eslint.config.mjs`) with typescript-eslint strict mode
- Lefthook git hooks enforce lint, format, typecheck, and tests
