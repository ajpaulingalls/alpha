# Development Milestones

Each milestone is a self-contained unit of work designed to be completed in a single Claude Code session. They build on each other — complete them in order.

Reference the [Project Overview](./PROJECT_OVERVIEW.md) for full context on the target architecture.

---

## Phase 1: Data Foundation

### M1 — Migrate Users to Email Auth + Add New Schemas

**What:** Replace phone-based auth with email. Add all new tables defined in the data model.

**Prerequisites:** None

**Key files to read first:**

- `packages/data/src/schema/users.ts` — current user schema (phone-based)
- `packages/data/src/schema/podcast_topics.ts` — current podcast topics schema
- `packages/data/src/schema/index.ts` — schema barrel export
- `packages/data/drizzle.config.ts` — Drizzle Kit config
- `docs/PROJECT_OVERVIEW.md` § "Data Model" — full target schema definitions

**Deliverables:**

1. Update `packages/data/src/schema/users.ts`:
   - Rename `phoneNumber` column to `email` (varchar 255, unique, not null)
   - Keep all other columns as-is (verificationCode, validated, validationTimeout, etc.)

2. Update `packages/data/src/schema/podcast_topics.ts`:
   - Add `episodeId` column (UUID, nullable, FK → podcast_episodes)
   - Add `startTime` column (integer, nullable — seconds)
   - Add `endTime` column (integer, nullable — seconds)

3. Create `packages/data/src/schema/user_preferences.ts`:
   - id (UUID PK), userId (UUID FK → users, unique), timezone (varchar 50, nullable), catchUpDepth (varchar 20, default 'standard'), preferences (JSONB, default {}), timestamps

4. Create `packages/data/src/schema/sessions.ts`:
   - id (UUID PK), userId (UUID FK → users), startedAt (timestamp, not null), endedAt (timestamp, nullable), catchUpDelivered (boolean, default false)

5. Create `packages/data/src/schema/listen_history.ts`:
   - id (UUID PK), sessionId (UUID FK → sessions), userId (UUID FK → users), contentType (varchar 20, not null — 'podcast_topic' | 'cached_response' | 'episode'), contentId (UUID, not null), listenedAt (timestamp, default now), completedPercent (integer, default 0)

6. Create `packages/data/src/schema/podcast_episodes.ts`:
   - id (UUID PK), showName (varchar 255), title (varchar 255), description (text), publishedAt (timestamp), sourceUrl (varchar 500, nullable), audioFilename (varchar 255), duration (integer — seconds), timestamps

7. Create `packages/data/src/schema/cached_responses.ts`:
   - id (UUID PK), queryEmbedding (vector 1536, HNSW index with cosine ops), responseText (text), audioFilename (varchar 255), sourceSummary (text, nullable), contentType (varchar 20 — 'catch_up' | 'answer' | 'deep_dive'), expiresAt (timestamp), hitCount (integer, default 0), timestamps

8. Update `packages/data/src/schema/index.ts` to export all schemas.

9. Run `cd packages/data && bun run generate` to produce a migration.

10. Update `packages/data/package.json` to add subpath exports for new schemas.

**Acceptance criteria:**

- `bun run generate` succeeds and produces a new migration file
- `bun run typecheck` passes
- `bun run lint` passes
- All new schema files export both select and insert types (e.g., `User`/`NewUser`, `Session`/`NewSession`)

**Notes:**

- Use the existing schemas as patterns for column definitions, timestamps, and type exports
- For JSONB, use Drizzle's `jsonb()` column type
- The HNSW vector index on cached_responses.queryEmbedding should match the pattern in podcast_topics.ts
- Don't run the migration (`bun run migrate`) — we'll do that after CRUD is ready
- The `catchUpDepth` uses a varchar rather than a Drizzle enum to avoid a migration for adding new values later

---

### M2 — CRUD Operations for All Tables

**What:** Create CRUD modules for every table. The existing users CRUD needs updating for email, and all new tables need CRUD from scratch.

**Prerequisites:** M1

**Key files to read first:**

- `packages/data/src/crud/users.ts` — existing CRUD pattern (the template for all others)
- `packages/data/src/client.ts` — database client import
- All schema files from M1
- `docs/PROJECT_OVERVIEW.md` § "Data Model" — understand what queries each table needs

**Deliverables:**

1. Update `packages/data/src/crud/users.ts`:
   - Rename `findUserByPhoneNumber` → `findUserByEmail` (query by email instead of phoneNumber)
   - Update `createUser` to accept email instead of phoneNumber
   - Update `updateUserVerificationCode` to use email instead of phoneNumber
   - Update `updateUserValidation` to use email instead of phoneNumber
   - Keep `findUserById` as-is

2. Create `packages/data/src/crud/preferences.ts`:
   - `findPreferencesByUserId(userId)` — returns user preferences or null
   - `createPreferences(userId, timezone?, catchUpDepth?)` — insert with defaults
   - `updatePreferences(userId, updates)` — partial update (timezone, catchUpDepth, preferences JSONB)
   - `updatePreferencesJson(userId, jsonUpdates)` — merge into the JSONB preferences column

3. Create `packages/data/src/crud/sessions.ts`:
   - `createSession(userId)` — insert with startedAt = now
   - `endSession(sessionId)` — set endedAt = now
   - `findLatestSession(userId)` — most recent session by startedAt
   - `markCatchUpDelivered(sessionId)` — set catchUpDelivered = true

4. Create `packages/data/src/crud/listen-history.ts`:
   - `recordListen(sessionId, userId, contentType, contentId)` — insert with listenedAt = now
   - `updateCompletedPercent(id, percent)` — update completion
   - `findRecentListens(userId, since: Date)` — all listens after a given date, ordered by listenedAt desc
   - `hasUserHeard(userId, contentType, contentId)` — boolean check

5. Create `packages/data/src/crud/episodes.ts`:
   - `createEpisode(data: NewPodcastEpisode)` — insert
   - `findEpisodesByShow(showName, limit?)` — ordered by publishedAt desc
   - `findLatestEpisode(showName)` — most recent by publishedAt
   - `findEpisodeById(id)` — by PK

6. Create `packages/data/src/crud/topics.ts`:
   - `createTopic(data: NewPodcastTopic)` — insert
   - `createTopics(data: NewPodcastTopic[])` — bulk insert
   - `findTopicsByEpisode(episodeId)` — ordered by startTime
   - `findTopicById(id)` — by PK
   - `searchTopicsByEmbedding(embedding: number[], limit?: number)` — vector similarity search using cosine distance, returns topics ordered by similarity

7. Create `packages/data/src/crud/cached-responses.ts`:
   - `createCachedResponse(data: NewCachedResponse)` — insert
   - `searchCachedResponses(queryEmbedding: number[], similarityThreshold: number, limit?: number)` — vector search, filter by expiresAt > now
   - `incrementHitCount(id)` — bump hitCount by 1
   - `deleteExpired()` — remove rows where expiresAt < now

8. Update `packages/data/package.json` to add subpath exports for all new CRUD modules.

9. Write tests for each CRUD module: `packages/data/src/crud/*.test.ts`
   - Test the function signatures and basic behavior using mocks or a test database
   - At minimum, test that functions exist and have correct return types
   - For vector search functions, test the SQL construction if possible

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- All CRUD modules export the functions listed above
- Subpath exports work: `import { findUserByEmail } from "@alpha/data/crud/users"` resolves

**Notes:**

- Follow the exact pattern from the existing `users.ts` CRUD: import `db` from `../client`, import schema, use Drizzle query builder
- For vector similarity search, use Drizzle's `sql` template tag with pgvector's `<=>` (cosine distance) operator. See the existing HNSW index in podcast_topics for the pattern.
- The JSONB merge in `updatePreferencesJson` can use PostgreSQL's `jsonb_concat` or Drizzle's `sql` tag

---

### M3 — Consolidate Generator & Importer Database Access

**What:** Create a custom `@ts-flow` node that wraps `@alpha/data` CRUD operations, then update generator and importer workflows to use it instead of raw `PGInsertQueryEngine`.

**Prerequisites:** M2

**Key files to read first:**

- `apps/generator/src/generate-podcast.json` — generator workflow, see the last node "Insert Data" using `PGInsertQueryEngine`
- `apps/importer/src/index-podcast-topics.json` — importer workflow, see the last node "Insert Data" using `PGInsertQueryEngine`
- `apps/generator/src/nodes/PodGenEngine.ts` — example of a custom `@ts-flow` node (implements `IQueryEngine`, uses `@ContainerNode` decorator)
- `apps/generator/src/index.ts` — how the workflow bootstraps and discovers custom nodes (via compiled `dist/` paths, not an explicit map)
- `packages/data/src/crud/topics.ts` — the CRUD module this node will call (from M2)
- `packages/data/src/crud/episodes.ts` — for episode creation (from M2)

**Deliverables:**

1. Create `packages/data/src/ts-flow/TopicInsertNode.ts`:
   - Implements `IQueryEngine` from `@ts-flow/core`
   - Uses `@ContainerNode` decorator for DI registration
   - `execute(payload, completeCallback)`:
     - Extracts `title` (or `topic` — see note below), `summary`, `filename`, `embedding` from payload
     - Calls `createTopic()` from `@alpha/data/crud/topics`
     - Calls `completeCallback` with the inserted record
   - Handles both single-item and array payloads (the generator sends arrays)
   - **Field name mapping:** The generator uses `title` as the payload field, but the importer uses `topic` (from GPT's topic extraction output). The node must accept either field name and map both to the `title` column. Check the `sqlValuesTemplate` arrays in both workflow JSONs to confirm.

2. Update `packages/data/package.json`:
   - Add subpath export: `"./ts-flow/TopicInsertNode"`
   - Add `@ts-flow/core` as a peer dependency

3. Update `apps/generator/src/index.ts`:
   - Ensure `TopicInsertNode` from `@alpha/data/ts-flow/TopicInsertNode` is importable and its `@ContainerNode` decorator registers it with the `@ts-flow` DI container. Study how `PodGenEngine` is discovered — it's picked up via compiled JS in the `dist/` directory, not an explicit map. The new node may need to be in a path that `@ts-flow/core` scans on bootstrap, or registered via whatever mechanism the generator uses.

4. Update `apps/generator/src/generate-podcast.json`:
   - Change the "Insert Data" node's `engineType` from `PGInsertQueryEngine` to `TopicInsertNode`
   - Remove the `connectionString` and raw SQL from `engineConfig`
   - Keep the field mapping in `engineConfig` so the node knows which payload fields to extract

5. Update `apps/importer/src/index.ts`:
   - Same as step 3 — ensure `TopicInsertNode` is discoverable

6. Update `apps/importer/src/index-podcast-topics.json`:
   - Same as step 4 — swap `PGInsertQueryEngine` for `TopicInsertNode`

7. Remove `POSTGRES_CONNECTION_STRING` from the generator and importer `.env.example` files (if they exist). These apps now use `DATABASE_URL` via `@alpha/data/client`.

8. Add `@alpha/data` as a dependency in both `apps/generator/package.json` and `apps/importer/package.json`.

**Acceptance criteria:**

- `bun run typecheck` passes across all workspaces
- `bun run lint` passes
- Generator and importer no longer reference `PGInsertQueryEngine` or `POSTGRES_CONNECTION_STRING` in their workflow JSONs
- The custom node follows the same pattern as `PodGenEngine.ts`

**Notes:**

- Study `PodGenEngine.ts` carefully — it shows exactly how to implement `IQueryEngine` and use `@ContainerNode`
- The `execute` method receives a `JSONObject` payload and a `completeCallback(eventName, payload)` function
- The node must call `completeCallback` when done so the workflow engine can continue
- The existing `PGInsertQueryEngine` maps `sqlValuesTemplate` array entries to payload fields. Your node should read the same payload fields but use the Drizzle CRUD instead of raw SQL
- **Node discovery:** `@ts-flow/core` discovers nodes by scanning compiled JS directories. `PodGenEngine` works because `dist/` is added to the bootstrap paths. The new `TopicInsertNode` needs to be compiled to a location that the workflow engine scans. Study `apps/generator/src/index.ts` to see how `bootstrap()` is called and what paths it scans. There is **no** explicit `extensions` map — registration happens via the `@ContainerNode` decorator when the compiled JS is loaded.
- The importer workflow uses `topic` as the field name for the title (from GPT output), while the generator uses `title`. The node must handle both field names.

---

## Phase 2: Service Clients

### M4 — Cortex Client Package

**What:** Create a typed client library for calling AJ Cortex pathways from the agent server. This is how the agent will access LLMs, RAG, wire data, and journalism tools.

**Prerequisites:** None (can be done in parallel with Phase 1)

**Key files to read first:**

- `~/src/aj/aj-cortex/README.md` — full Cortex documentation including API surface, pathways, models
- `~/src/aj/aj-cortex/pathways/rag.js` — example of a complex pathway with RAG
- `~/src/aj/aj-cortex/pathways/summary.js` — example of a simple pathway
- `~/src/aj/aj-cortex/pathways/chat_labeeb.js` — chat pathway
- `~/src/aj/aj-cortex/pathways/headline.js` — content generation pathway
- `~/src/aj/aj-cortex/config/default.json` — model definitions and entity configs (large file — focus on `entityConstants` and `modelConfig` sections)
- `~/src/aj/aj-cortex/SUPPORTED_MODELS.md` — available models

**Deliverables:**

1. Create `packages/cortex/` as a new workspace package:
   - `packages/cortex/package.json` — name: `@alpha/cortex`, dependencies: none (pure fetch-based)
   - `packages/cortex/tsconfig.json` — extend root tsconfig pattern
   - `packages/cortex/src/client.ts` — main client class

2. `packages/cortex/src/client.ts` — `CortexClient` class:

   ```typescript
   class CortexClient {
     constructor(baseUrl: string);

     // Call any pathway by name via REST
     callPathway(
       name: string,
       params: Record<string, unknown>,
     ): Promise<string>;

     // Stream a pathway response (for LLM → TTS streaming)
     streamPathway(
       name: string,
       params: Record<string, unknown>,
     ): AsyncIterable<string>;

     // Call the OpenAI-compatible chat endpoint (for use as LiveKit LLM plugin)
     chatCompletion(messages: ChatMessage[], model?: string): Promise<string>;

     // Stream chat completion
     streamChatCompletion(
       messages: ChatMessage[],
       model?: string,
     ): AsyncIterable<string>;

     // Convenience methods for common pathways:
     summarize(text: string): Promise<string>;
     search(query: string, indexName?: string): Promise<SearchResult[]>;
     embed(text: string): Promise<number[]>;
     rag(query: string, options?: RagOptions): Promise<RagResult>;
   }
   ```

3. `packages/cortex/src/types.ts` — TypeScript types:
   - `ChatMessage` — `{ role: 'system' | 'user' | 'assistant', content: string }`
   - `SearchResult` — `{ title: string, content: string, url?: string, score?: number }`
   - `RagOptions` — `{ indexName?: string, searchBing?: boolean, maxSources?: number }`
   - `RagResult` — `{ result: string, sources: SearchResult[] }`
   - `PathwayResponse` — `{ result: string, debug?: unknown, warnings?: string[], errors?: string[] }`

4. `packages/cortex/src/index.ts` — barrel export

5. Update root `package.json` — workspaces already includes `packages/*`, so this is auto-discovered.

6. Update `packages/cortex/package.json` with subpath exports:
   - `".": "./src/index.ts"`
   - `"./client": "./src/client.ts"`
   - `"./types": "./src/types.ts"`

7. Write tests: `packages/cortex/src/client.test.ts`
   - Test URL construction for pathway calls
   - Test request body formatting
   - Mock fetch responses and verify parsing
   - Test streaming response handling

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- `import { CortexClient } from "@alpha/cortex"` resolves

**Notes:**

- Cortex REST API: `POST {baseUrl}/rest/{pathwayName}` with JSON body matching pathway `inputParameters`. Returns `{ resultText: string }`.
- Cortex OpenAI-compatible API: `POST {baseUrl}/v1/chat/completions` with standard OpenAI chat format. This is important because LiveKit's LLM plugin can use any OpenAI-compatible endpoint.
- For streaming, Cortex supports SSE (Server-Sent Events) via the same endpoints with `stream: true` parameter.
- The `CORTEX_API_URL` env var will hold the base URL.
- Don't try to handle authentication headers for now — Cortex runs on the internal network. Can add auth later.
- This is a pure HTTP client — no WebSocket needed.

---

### M5 — AJ GraphQL Content Client

**What:** Create a typed client for fetching content from Al Jazeera's GraphQL API. Used by the agent server to search articles, fetch content for RAG context, and discover podcasts.

**Prerequisites:** None (can be done in parallel with Phase 1)

**Key files to read first:**

- `~/src/aj/ucms/frontend/src/global/graphql/searchQuery.graphql` — article search (Google CSE format)
- `~/src/aj/ucms/frontend/src/global/graphql/singleArticleQuery.graphql` — full article fetch
- `~/src/aj/ucms/frontend/src/global/graphql/postsQuery.graphql` — list articles by type
- `~/src/aj/ucms/frontend/src/global/graphql/podcastSeriesQuery.graphql` — podcast series listing
- `~/src/aj/ucms/frontend/src/global/graphql/episodeQuery.graphql` — podcast episode detail
- `~/src/aj/ucms/frontend/src/global/graphql/sectionPostsQuery.graphql` — posts by category
- `~/src/aj/ucms/frontend/src/global/graphql/postFragments.graphql` — shared Post type fields
- `~/src/aj/ucms/frontend/src/global/graphql/topicsQuery.graphql` — topic landing pages
- `apps/generator/src/generate-podcast.json` — see how the generator currently calls the GraphQL API (nodes "Fetch Latest News" and "Get Article Content" show the endpoint URL and query format)

**Deliverables:**

1. Create `packages/content/` as a new workspace package:
   - `packages/content/package.json` — name: `@alpha/content`
   - `packages/content/tsconfig.json`
   - `packages/content/src/client.ts` — main client
   - `packages/content/src/queries.ts` — GraphQL query strings
   - `packages/content/src/types.ts` — response types

2. `packages/content/src/queries.ts` — GraphQL queries as template strings:
   - `SEARCH_QUERY` — search articles (from searchQuery.graphql)
   - `SINGLE_ARTICLE_QUERY` — fetch full article by slug (from singleArticleQuery.graphql)
   - `POSTS_QUERY` — list articles with filtering (from postsQuery.graphql)
   - `SECTION_POSTS_QUERY` — articles in a section/category (from sectionPostsQuery.graphql)
   - `PODCAST_SERIES_QUERY` — list podcast series (from podcastSeriesQuery.graphql)
   - `EPISODE_QUERY` — single podcast episode (from episodeQuery.graphql)

   Copy the exact GraphQL query strings from the reference files, but simplify the fragments to include only the fields Alpha needs: id, title, excerpt/content, date, slug, link, author name, featured image URL, categories, tags.

3. `packages/content/src/types.ts`:
   - `Article` — `{ id, title, excerpt, content, date, slug, link, author, imageUrl, categories, tags }`
   - `SearchResult` — `{ title, snippet, link, imageUrl, publishedAt }`
   - `PodcastSeries` — `{ id, title, description, imageUrl }`
   - `PodcastEpisode` — `{ id, title, description, publishedAt, audioUrl, duration }`

4. `packages/content/src/client.ts` — `ContentClient` class:

   ```typescript
   class ContentClient {
     constructor(graphqlUrl: string);

     // Search articles
     searchArticles(query: string, offset?: number): Promise<SearchResult[]>;

     // Fetch full article by slug
     getArticle(slug: string): Promise<Article | null>;

     // Fetch recent articles (for catch-up)
     getRecentArticles(limit?: number): Promise<Article[]>;

     // Fetch articles in a category
     getArticlesByCategory(
       category: string,
       limit?: number,
     ): Promise<Article[]>;

     // List podcast series
     getPodcastSeries(): Promise<PodcastSeries[]>;

     // Get podcast episode
     getEpisode(id: string): Promise<PodcastEpisode | null>;
   }
   ```

5. Update subpath exports in package.json.

6. Write tests: `packages/content/src/client.test.ts`
   - Test GraphQL query construction
   - Test response parsing and type mapping
   - Mock fetch responses

7. Add `OmnyClient` for the Omny Studio Consumer API (`api.omny.fm`):
   - `packages/content/src/omny-client.ts` — `OmnyClient` class
   - `packages/content/src/omny-client.test.ts` — tests
   - `packages/content/src/http.ts` — shared HTTP utilities (`assertOk`, `DEFAULT_TIMEOUT_MS`) used by both clients

   ```typescript
   class OmnyClient {
     constructor(orgId: string); // or { orgId, baseUrl?, timeoutMs? }

     getPrograms(): Promise<OmnyProgram[]>;
     getClips(
       programSlug: string,
       options?: { pageSize?: number; cursor?: string },
     ): Promise<OmnyClipsResult>;
     getClip(programSlug: string, clipSlug: string): Promise<OmnyClip>;
   }
   ```

   - Consumer API is public/read-only (no auth needed, unlike the importer's management API)
   - Responses use PascalCase; the client maps to camelCase
   - Path segments (orgId, slugs) are validated against `[a-zA-Z0-9][a-zA-Z0-9_-]*` to prevent injection
   - Cursor-based pagination with default page size of 10
   - Reference: `docs/omny-consumer-api.openapi.json` (OpenAPI 3.0.1 spec for the Consumer API)

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- `import { ContentClient } from "@alpha/content"` resolves
- `import { OmnyClient } from "@alpha/content"` resolves
- `import { OmnyClient } from "@alpha/content/omny-client"` resolves

**Notes:**

- The GraphQL endpoint URL is visible in the generator's workflow JSON (the "Fetch Latest News" node). Look at the `url` field in its `engineConfig`.
- These queries don't need authentication — the AJ GraphQL API is public.
- Keep the queries simple. Alpha only needs article text, metadata, and images for RAG context and display. Don't include all the CMS-specific fields from the original queries.
- The search endpoint wraps Google CSE — response format includes `searchInformation` and `items[]` arrays.
- The Omny Consumer API (`api.omny.fm`) is separate from the management API (`api.omnystudio.com/v0`) used by the importer. The consumer API is public, the management API requires Bearer auth.
- `docs/omny-consumer-api.openapi.json` contains the full OpenAPI spec for the consumer API.

---

## Phase 3: Server — LiveKit Agent Foundation

### M6 — Email Magic Code Auth Endpoints

**What:** Replace the voice-based phone signup with HTTP endpoints for email magic code authentication. Auth becomes screen-driven (email input → code verification) before the voice agent takes over.

**Prerequisites:** M1, M2

**Key files to read first:**

- `apps/server/src/ApiServer.ts` — current Hono HTTP server (health + echo routes)
- `apps/server/src/handlers/SignupHandler.ts` — current voice signup flow (for understanding what it does, not to copy)
- `packages/data/src/crud/users.ts` — user CRUD (updated in M2 for email)
- `packages/data/src/crud/preferences.ts` — preferences CRUD (from M2)
- `packages/data/src/crud/sessions.ts` — sessions CRUD (from M2)
- `docs/PROJECT_OVERVIEW.md` § "User Experience Flow" > "First Launch" — the target auth flow

**Deliverables:**

1. Update `apps/server/src/ApiServer.ts` — add auth routes:

   **`POST /api/auth/send-code`**
   - Body: `{ email: string }`
   - Validate email format
   - Generate a random 6-digit code
   - If user exists: update verification code + timeout (30 min)
   - If user doesn't exist: create user with email, empty name, code, timeout
   - Send the code via email (for now, just log it to console — email service integration is out of scope)
   - Response: `{ success: true }`

   **`POST /api/auth/verify-code`**
   - Body: `{ email: string, code: string }`
   - Look up user by email
   - Check code matches and timeout hasn't expired
   - If valid: mark user validated, generate JWT (30-day), create a session
   - Response: `{ token: string, isNewUser: boolean }` (isNewUser = name is empty)
   - If invalid: `401 { error: "Invalid or expired code" }`

   **`POST /api/auth/livekit-token`** (placeholder for M8)
   - Header: `Authorization: Bearer <jwt>`
   - Validate JWT, extract userId
   - Response: `{ token: "<placeholder>", roomName: "<placeholder>" }`
   - This will be completed in M8 when LiveKit is integrated

2. Create `apps/server/src/middleware/auth.ts`:
   - JWT verification middleware for Hono
   - Extracts and verifies the Bearer token
   - Sets `userId` on the Hono context
   - Used by authenticated routes

3. Add Zod validation schemas for request bodies.

4. Write tests: `apps/server/src/ApiServer.test.ts` (update existing):
   - Test `POST /api/auth/send-code` with valid email
   - Test `POST /api/auth/send-code` with invalid email format
   - Test `POST /api/auth/verify-code` success and failure cases
   - Test auth middleware rejects missing/invalid tokens
   - Mock the database CRUD calls

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- Auth endpoints return correct responses for happy and error paths

**Notes:**

- Don't build actual email sending yet. Just log the code: `console.log(`Verification code for ${email}: ${code}`)`. We'll add email delivery later.
- JWT signing should use the existing `JWT_SECRET` env var and `jsonwebtoken` package already in the server dependencies.
- The `isNewUser` flag tells the client whether to expect the SetupAgent (name collection) or skip straight to CatchUpAgent.

---

### M7 — LiveKit Agent Server Scaffolding

**What:** Set up the LiveKit Agents SDK for Node.js and create a minimal agent that joins a room and speaks. This replaces the Socket.io + OpenAI Realtime API architecture.

**Prerequisites:** M6 (for the token endpoint)

**Key files to read first:**

- `apps/server/package.json` — current dependencies
- `apps/server/src/index.ts` — current entry point (Hono + Socket.io)
- `apps/server/src/handlers/CommunicationsHandler.ts` — current OpenAI Realtime integration (for understanding, not copying)
- LiveKit Agents docs: use the livekit-docs MCP tools to read `/agents/start/voice-ai` and `/agents/overview`
- LiveKit Node.js SDK: use livekit-docs MCP to search for Node.js agent examples

**Deliverables:**

1. Add LiveKit dependencies to `apps/server/package.json`:
   - `@livekit/agents` — Agent framework
   - `@livekit/rtc-node` — LiveKit server SDK
   - Any STT/TTS/LLM plugins needed (check LiveKit docs for exact package names)

2. Create `apps/server/src/agent/index.ts` — agent entry point:
   - Define a `WorkerOptions` configuration
   - Create an `entrypoint` function that:
     - Accepts a `JobContext`
     - Connects to the LiveKit room
     - Creates a basic `VoicePipelineAgent` with:
       - STT: Deepgram (or OpenAI Whisper as fallback)
       - LLM: OpenAI (direct for now — Cortex integration comes in M12)
       - TTS: OpenAI TTS
     - Starts the agent session
     - Agent says a greeting: "Hello, I'm Alpha."
   - Export the agent worker

3. Update `apps/server/src/index.ts`:
   - Keep the Hono HTTP server
   - Remove or disable the Socket.io server setup (keep the code commented out for reference)
   - Start the LiveKit agent worker alongside the HTTP server
   - Both should run in the same process

4. Update `apps/server/src/ApiServer.ts`:
   - Complete the `POST /api/auth/livekit-token` endpoint:
     - Validate JWT from Authorization header
     - Generate a LiveKit access token using `@livekit/rtc-node` (or the token utility from the SDK)
     - Token should include the user's identity (userId) and grants for the room
     - Room name: `alpha-${userId}` (one room per user)
     - Response: `{ token: string, roomName: string, livekitUrl: string }`

5. Add environment variables:
   - `LIVEKIT_URL` — LiveKit Cloud WebSocket URL
   - `LIVEKIT_API_KEY` — LiveKit API key
   - `LIVEKIT_API_SECRET` — LiveKit API secret

6. Write tests for token generation logic.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- When the server starts, the agent worker registers with LiveKit Cloud
- When a client joins a room, the agent joins and speaks a greeting
- The LiveKit token endpoint generates valid tokens

**Notes:**

- Use the LiveKit docs MCP to look up the exact API for `VoicePipelineAgent`, `WorkerOptions`, and token generation in the Node.js SDK. The API may have changed since training data — always check current docs.
- The agent worker and HTTP server coexist in the same process. The HTTP server handles auth and token generation; the agent worker handles voice sessions.
- For this milestone, use OpenAI directly for STT/LLM/TTS. Cortex integration comes later in M12.
- Don't worry about multi-agent handoffs yet — just get a single agent talking.

---

### M8 — SetupAgent (First-Time User Experience)

**What:** Create the SetupAgent that handles first-time users: collects their name via voice, delivers the intro explaining how Alpha works, and hands off to CatchUpAgent.

**Prerequisites:** M7

**Key files to read first:**

- The agent scaffolding from M7 (`apps/server/src/agent/index.ts`)
- `apps/server/src/handlers/SignupHandler.ts` — current voice signup (for the name collection pattern)
- `apps/server/src/tools/SaveNameTool.ts` — current Zod-based tool (adapt to LiveKit tool format)
- LiveKit docs: use livekit-docs MCP to read about function tools, agent instructions, and multi-agent handoffs in the Node.js SDK
- `docs/PROJECT_OVERVIEW.md` § "User Experience Flow" > "First Launch" — the target setup flow
- `packages/data/src/crud/users.ts` — to update the user's name

**Deliverables:**

1. Create `apps/server/src/agent/agents/SetupAgent.ts`:
   - A function or class that configures a voice agent for setup
   - System prompt: Collect the user's name, then deliver a brief intro explaining how Alpha works (see PROJECT_OVERVIEW § "First Launch" for the exact script concept)
   - One tool: `recordName` — accepts `{ name: string }`, calls `updateUserName(userId, name)` CRUD (you may need to add this to the users CRUD), creates user preferences with defaults
   - After the tool is called and the intro is delivered, signal handoff to CatchUpAgent
   - Pipeline config: STT (Deepgram or OpenAI), LLM (OpenAI for now), TTS (a warm, friendly voice)

2. Create `apps/server/src/agent/agents/CatchUpAgent.ts` (stub):
   - Minimal implementation — just accepts handoff and says "Catch-up coming soon"
   - Will be fully implemented in M10

3. Update `apps/server/index.ts` (note: the entry point is at the app root, not inside `src/`):
   - On room join, check if the user is new (`isNewUser` flag from auth, or check if name is empty in DB)
   - If new: start SetupAgent
   - If returning: start CatchUpAgent (stub)
   - Wire up the handoff from SetupAgent → CatchUpAgent

4. Add `updateUserName(userId, name)` to `packages/data/src/crud/users.ts` if it doesn't exist.

5. Write tests for the SetupAgent tool and handoff logic.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- First-time user connects → SetupAgent asks for name → user says name → agent stores it and delivers intro → hands off to CatchUpAgent stub
- Returning user connects → skips straight to CatchUpAgent stub

**Notes:**

- Use LiveKit docs MCP to look up the exact API for defining function tools in the Node.js Agents SDK. Tools should use Zod schemas (the SDK supports this).
- The handoff mechanism between agents is a key LiveKit Agents feature. Research how `AgentSession` handles agent transitions.
- The intro script should communicate: (1) what's about to happen (catch-up), (2) that the user can interrupt, (3) how to interact (ask questions, say "next", say "go deeper"). Keep it under 30 seconds.

---

## Phase 4: Content & Agents

### M9 — Content Search Tools

**What:** Build the tool layer that agents use to find content: vector search across podcast topics and cached responses, article search via GraphQL, and RAG via Cortex.

**Prerequisites:** M2, M4, M5

**Key files to read first:**

- `packages/data/src/crud/topics.ts` — vector search for podcast topics (from M2)
- `packages/data/src/crud/cached-responses.ts` — vector search for cached responses (from M2)
- `packages/cortex/src/client.ts` — Cortex client (from M4)
- `packages/content/src/client.ts` — AJ GraphQL client (from M5)
- `docs/PROJECT_OVERVIEW.md` § "Content Resolution" — the priority chain: direct request → cache → clip → generate

**Deliverables:**

1. Create `apps/server/src/agent/tools/searchContent.ts`:
   - LiveKit function tool definition
   - Params: `{ query: string }`
   - Embeds the query via Cortex's `embeddings` pathway (wraps OpenAI text-embedding-3-small and others)
   - Runs all three searches **in parallel** via `Promise.all`:
     - Cached responses (vector similarity, non-expired)
     - Podcast topics (vector similarity)
     - AJ articles (GraphQL search)
   - Returns a ranked result set with content type, similarity score, and summary
   - **Important:** Include the query embedding in the returned result so downstream tools (like `generateResponse`) can reuse it for caching without calling the embeddings API a second time
   - This is the core content resolution tool used by BrowseAgent

2. Create `apps/server/src/agent/tools/searchPodcasts.ts`:
   - LiveKit function tool definition
   - Params: `{ query: string, showName?: string }`
   - Searches podcast episodes by show name and/or keyword
   - Uses `@alpha/data/crud/episodes` for show-based lookup
   - Uses `@alpha/data/crud/topics` for content-based search
   - Returns episode/topic matches with metadata

3. Create `apps/server/src/agent/tools/fetchTopStories.ts`:
   - LiveKit function tool definition
   - Params: `{ since?: string }` (ISO date)
   - Fetches recent articles from AJ GraphQL API
   - Fetches pre-generated episodes from database
   - Returns a structured list for catch-up assembly

4. Create `apps/server/src/agent/tools/fetchWireHighlights.ts`:
   - LiveKit function tool definition
   - Params: `{ since?: string }`
   - Calls Cortex RAG with a "latest wire highlights" query
   - Returns wire service items

5. Create `apps/server/src/agent/tools/fetchNewPodcasts.ts`:
   - LiveKit function tool definition
   - Params: `{ since?: string }`
   - Queries `@alpha/data/crud/episodes` for recent episodes, excluding already-heard episodes in a single query (`LEFT JOIN listen_history ... WHERE listen_history.id IS NULL` or `NOT IN` subquery). Do not fetch-then-filter.
   - Returns new podcast episodes

6. Write tests for each tool — mock the database and API clients.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- Each tool has a clear Zod schema and returns structured data the agents can use

**Notes:**

- The embedding step in `searchContent` is important. The query text needs to be embedded into a 1536-dim vector before vector search. Use Cortex's `embeddings` pathway for this — it wraps the same embedding models (text-embedding-3-small) and keeps all AI calls routed through Cortex.
- Content resolution priority: cache hit (exact-ish match, non-expired) → podcast topic clip → article-based generation. The tool should return results in this priority order with content type labels so the agent can decide what to do.
- These tools return data to the agent's LLM. The LLM then decides how to respond to the user — it might play a clip, start generation, or just summarize.

---

### M10 — CatchUpAgent (Full Implementation)

**What:** Fully implement the CatchUpAgent that delivers a personalized briefing based on time since the user's last session.

**Prerequisites:** M8, M9

**Key files to read first:**

- `apps/server/src/agent/agents/CatchUpAgent.ts` — stub from M8
- `apps/server/src/agent/tools/fetchTopStories.ts` — from M9
- `apps/server/src/agent/tools/fetchWireHighlights.ts` — from M9
- `apps/server/src/agent/tools/fetchNewPodcasts.ts` — from M9
- `packages/data/src/crud/sessions.ts` — to find last session time
- `packages/data/src/crud/listen-history.ts` — to check what user has already heard
- `docs/PROJECT_OVERVIEW.md` § "Catch-Up Mode" and "Catch-Up Assembly" — the target behavior

**Deliverables:**

1. Update `apps/server/src/agent/agents/CatchUpAgent.ts`:
   - System prompt: You are a news briefing host. Deliver a personalized catch-up covering top stories, wire highlights, and new podcasts. Keep it conversational. The user can interrupt to ask questions or say "next" to skip.
   - Tools: `fetchTopStories`, `fetchWireHighlights`, `fetchNewPodcasts`
   - On entry:
     - Look up user's last session (`findLatestSession`)
     - Calculate time since last session
     - Call tools to gather content
     - Deliver briefing as a sequence of short segments
   - Handle interruptions: user asks "tell me more" → go deeper. User says "next" → skip to next item.
   - On completion: hand off to BrowseAgent with transition message ("That's the latest. Want to explore anything?")
   - Record what was delivered in listen_history

2. Create `apps/server/src/agent/agents/BrowseAgent.ts` (stub):
   - Minimal — accepts handoff, says "You're now in browse mode. Ask me anything about the news."
   - Will be fully implemented in M13

3. Wire handoff: CatchUpAgent → BrowseAgent in the agent entry point.

4. Write tests for CatchUpAgent briefing assembly logic.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- Returning user connects → CatchUpAgent gathers content based on time-since-last-session → delivers briefing → hands off to BrowseAgent stub

**Notes:**

- The catch-up length should be proportional to time away. 1 hour = quick 2-minute update. 1 day = fuller 5-minute briefing. 3+ days = comprehensive recap. Use the user's `catchUpDepth` preference to adjust.
- The agent should feel natural — transitions between topics should have conversational bridges, not just a list of headlines.
- Mark `catchUpDelivered` on the session when the briefing completes.

---

### M11 — Streaming Generation Pipeline

**What:** Build the LLM → TTS → stream pipeline that generates audio responses on the fly and simultaneously records them for caching. Cortex provides text generation only (no audio) — TTS is handled separately by OpenAI TTS or Cartesia, and we capture the TTS audio output for caching.

**Prerequisites:** M4, M2

**Key files to read first:**

- `apps/generator/src/nodes/PodGenEngine.ts` — existing TTS generation code (WAV construction, voice mapping, PCM caching). Shows the pattern: call OpenAI TTS API → get PCM audio → write to file. This is the same pattern we'll use for recording.
- `packages/ai/src/AudioGenerator.ts` — existing TTS utility
- `packages/cortex/src/client.ts` — for LLM text streaming only (from M4). Cortex has no TTS/audio capabilities.
- `packages/data/src/crud/cached-responses.ts` — for storing generated responses (from M2)
- `docs/PROJECT_OVERVIEW.md` § "Streaming Generation Pipeline" — the target architecture
- LiveKit docs: search for how to intercept/capture TTS audio output in the agent pipeline. We need to tap into the audio stream that the TTS plugin produces so we can record it while it plays to the user.

**Deliverables:**

1. Create `apps/server/src/agent/generation/StreamingGenerator.ts`:
   - Class that orchestrates the generation pipeline
   - The pipeline has two distinct stages:
     - **Text generation (Cortex):** Cortex LLM streams text. Cortex has no audio capabilities.
     - **Audio generation (TTS engine):** Text is fed to TTS (OpenAI TTS or Cartesia) which produces audio. This is either LiveKit's built-in TTS plugin or a direct API call.
   - `generate(query: string, ragContext: string, userId: string)`:
     - Calls Cortex LLM (streaming) with the query + RAG context → receives text chunks
     - Feeds text chunks to the TTS engine (OpenAI TTS API or Cartesia) → receives audio chunks
     - LiveKit's VoicePipelineAgent already does the LLM→TTS streaming internally. The key challenge is **tapping into the TTS audio output** to record it while it's being sent to the user.
     - Simultaneously accumulates the full response text and raw audio bytes
   - `finalize()`:
     - Called after streaming completes
     - Embeds the query text (for future similarity matching) via Cortex's `embeddings` pathway
     - Saves the accumulated audio to a WAV file on disk
     - Stores the response in `cached_responses` table with: queryEmbedding, responseText, audioFilename, contentType, expiresAt
     - Returns the cached response ID

2. Create `apps/server/src/agent/generation/AudioRecorder.ts`:
   - Utility that captures TTS audio output as it streams through the agent pipeline
   - Accumulates PCM audio chunks into a buffer
   - `save(filename: string)` — writes accumulated PCM to a WAV file (24kHz 16-bit mono, same format as PodGenEngine)
   - Uses the WAV header construction pattern from `PodGenEngine.ts`

3. Create `apps/server/src/agent/generation/ExpiryRules.ts`:
   - Determines `expiresAt` based on content type and topic:
     - Breaking news: 1 hour
     - Current events: 6 hours
     - Background/history: 7 days
     - Evergreen explainers: 30 days
   - Uses simple keyword/topic classification to choose the right TTL

4. Create `apps/server/src/agent/tools/generateResponse.ts`:
   - LiveKit function tool that wraps StreamingGenerator
   - Params: `{ query: string, context: string }`
   - Used by BrowseAgent when no cache hit or clip match exists
   - The tool triggers the agent to speak the generated response (LLM → TTS via the agent pipeline) while AudioRecorder captures the TTS output for caching

5. Write tests:
   - Test ExpiryRules classification
   - Test AudioRecorder WAV file construction
   - Test StreamingGenerator with mocked Cortex and TTS clients
   - Test cached response storage

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- StreamingGenerator can produce a text response via Cortex, the TTS engine converts it to audio, the audio plays to the user, and the audio is simultaneously recorded and stored in the cache

**Notes:**

- **Cortex generates text only.** It has no TTS or audio generation capabilities. The full pipeline is: Cortex (text) → TTS engine (audio) → LiveKit (stream to user) + AudioRecorder (save to disk).
- The TTS engine is either LiveKit's built-in TTS plugin (Cartesia, OpenAI, etc.) or a direct API call to OpenAI's TTS endpoint. Check LiveKit Agents docs for how TTS plugins work and whether you can intercept their audio output.
- The critical design question is: how do you tap into the TTS audio stream? Options:
  1. **LiveKit agent event hooks** — the agent pipeline may emit events or callbacks when TTS audio is produced. Subscribe to these to capture audio.
  2. **Custom TTS wrapper** — wrap the TTS plugin to tee the audio output to both the agent and the recorder.
  3. **Post-hoc recording** — if LiveKit doesn't expose TTS output, generate the response text via Cortex, then make a separate TTS API call to create the cached audio file (trades some efficiency for simplicity).
- Audio format: 24kHz 16-bit mono PCM WAV (matching PodGenEngine). Copy the WAV header construction from `PodGenEngine.ts`.
- For MVP, option 3 (post-hoc recording) may be simplest: let the agent pipeline handle LLM→TTS→user normally, accumulate the response text, then after the response is complete, call TTS once more to generate the cacheable audio file. This doubles TTS cost for generated responses but avoids complex audio tapping. Optimize later.

---

### M12 — Cortex LLM Integration for Agents

**What:** Replace direct OpenAI calls in the agent pipeline with Cortex, giving agents access to multi-model routing and journalism-specific capabilities.

**Prerequisites:** M4, M7

**Key files to read first:**

- `packages/cortex/src/client.ts` — Cortex client (from M4)
- `apps/server/src/agent/index.ts` — agent pipeline config (from M7)
- LiveKit docs: use livekit-docs MCP to search for custom LLM plugin integration, specifically how to use a custom OpenAI-compatible endpoint as the LLM in a VoicePipelineAgent
- `~/src/aj/aj-cortex/README.md` — Cortex's OpenAI-compatible endpoint at `/v1/chat/completions`

**Deliverables:**

1. Create `apps/server/src/agent/plugins/CortexLLM.ts`:
   - A custom LLM plugin/adapter for LiveKit Agents that routes through Cortex's OpenAI-compatible endpoint
   - Should work with LiveKit's `VoicePipelineAgent` pipeline configuration
   - Configurable model selection (maps to Cortex model names like `oai-gpt4o`, `gemini-flash-3-vision`, etc.)
   - Supports streaming responses

2. Update agent pipeline configuration in all agents to use CortexLLM instead of direct OpenAI:
   - SetupAgent — fast model (e.g., `oai-gpturbo` or equivalent)
   - CatchUpAgent — standard model (e.g., `oai-gpt4o`)
   - BrowseAgent stub — standard model
   - CatchUpAgent stub — standard model

3. Add `CORTEX_API_URL` to server environment variables.

4. Write tests for CortexLLM adapter.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- Agents use Cortex for LLM calls instead of OpenAI directly
- Model selection is configurable per agent

**Notes:**

- Cortex exposes an OpenAI-compatible endpoint at `{CORTEX_API_URL}/v1/chat/completions`. LiveKit's LLM plugin system likely supports custom OpenAI-compatible endpoints. Check the docs.
- If LiveKit's SDK lets you pass a custom `baseURL` to the OpenAI LLM plugin, that may be the simplest approach — just point it at Cortex.
- Different agents should use different models for cost/speed optimization. SetupAgent needs fast responses (simple task), BrowseAgent needs strong reasoning (content resolution).

---

### M13 — BrowseAgent (Content Resolution)

**What:** Fully implement BrowseAgent — the free-form voice navigation agent that handles content questions, podcast requests, and conversational exchanges.

**Prerequisites:** M9, M10, M11, M12

**Key files to read first:**

- `apps/server/src/agent/agents/BrowseAgent.ts` — stub from M10
- `apps/server/src/agent/tools/searchContent.ts` — from M9
- `apps/server/src/agent/tools/searchPodcasts.ts` — from M9
- `apps/server/src/agent/tools/generateResponse.ts` — from M11
- `packages/data/src/crud/cached-responses.ts` — cache lookup (from M2)
- `docs/PROJECT_OVERVIEW.md` § "Browse Mode" and "Content Resolution" — target behavior
- `docs/PROJECT_OVERVIEW.md` § "Agent Personality and Topic Boundaries" — topic drift handling

**Deliverables:**

1. Update `apps/server/src/agent/agents/BrowseAgent.ts`:
   - System prompt: Comprehensive instructions covering:
     - Role: knowledgeable, personable news and podcast host
     - Content resolution: use searchContent tool first, then decide to play clip or generate
     - Topic drift: gravitational pull back to news (see PROJECT_OVERVIEW § "Agent Personality")
     - Tone: warm, confident, informed. Not robotic.
   - Tools: `searchContent`, `searchPodcasts`, `generateResponse`, `playPodcast` (triggers handoff to PlaybackAgent)
   - Content resolution flow:
     1. User asks a question
     2. Agent calls `searchContent` tool
     3. Based on results: stream cached audio, play podcast clip, or call `generateResponse`
     4. Record what was played/generated in listen_history

2. Create `apps/server/src/agent/agents/PlaybackAgent.ts` (stub):
   - Minimal — accepts handoff with a podcast ID, says "Now playing [title]."
   - Will be fully implemented in M14

3. Wire handoff: BrowseAgent → PlaybackAgent (via `playPodcast` tool) and PlaybackAgent → BrowseAgent (on playback end).

4. Write tests for BrowseAgent content resolution logic.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- User in browse mode can ask questions → agent finds and delivers content
- "Play [podcast name]" → hands off to PlaybackAgent stub
- Topic drift → agent steers back gently

---

### M14 — PlaybackAgent

**What:** Implement PlaybackAgent for podcast playback with mid-listen interactions.

**Prerequisites:** M7, M9, M13 (for PlaybackAgent stub)

**Key files to read first:**

- `apps/server/src/agent/agents/PlaybackAgent.ts` — stub from M13
- `apps/server/src/handlers/PodcastHandler.ts` — current podcast playback (for reference)
- `docs/PROJECT_OVERVIEW.md` § "Podcast Playback Mode" — target behavior

**Deliverables:**

1. Update `apps/server/src/agent/agents/PlaybackAgent.ts`:
   - System prompt: You are managing podcast playback. The user can pause, resume, skip topics, or ask questions about what's playing.
   - Tools: `pausePlayback`, `resumePlayback`, `skipTopic`, `searchContext`
   - Receives podcast episode or topic ID on handoff
   - Streams podcast audio to the user
   - Handles interruptions: pause on speech, resume on silence (conversation awareness)
   - Mid-listen Q&A: user asks about content → agent pauses, answers using searchContext, offers to resume

2. Create playback control tools:
   - `pausePlayback` — pauses audio stream
   - `resumePlayback` — resumes from where it stopped
   - `skipTopic` — jumps to next topic segment (using podcast_topics startTime/endTime)
   - `searchContext` — searches for context about the current topic being played

3. Handle handoff back to BrowseAgent when:
   - Playback ends naturally
   - User says "stop" or "I'm done with this"

4. Record listen progress in listen_history (track completedPercent).

5. Write tests for playback control logic.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- User requests a podcast → PlaybackAgent streams it → user can interact mid-listen → returns to BrowseAgent

---

### M15 — Agent Handoff Wiring & Session Management

**What:** Connect all four agents into the complete multi-agent workflow with proper session lifecycle management.

**Prerequisites:** M8, M10, M13, M14

**Key files to read first:**

- All agent files from M8, M10, M13, M14
- `apps/server/src/agent/index.ts` — agent entry point
- `packages/data/src/crud/sessions.ts` — session management
- `packages/data/src/crud/listen-history.ts` — listen tracking
- `docs/PROJECT_OVERVIEW.md` § "Session Lifecycle and Mic Behavior" — target behavior
- LiveKit docs: search for agent handoff, multi-agent, session management

**Deliverables:**

1. Update `apps/server/src/agent/index.ts` — complete session orchestration:
   - On room join:
     - Create a session in the database
     - Check if user is new (no name) → SetupAgent
     - Check if returning → CatchUpAgent
   - Handoff chain: SetupAgent → CatchUpAgent → BrowseAgent ⇄ PlaybackAgent
   - On room leave:
     - End session (`endSession`)
     - Clean up resources

2. Implement conversation awareness behavior:
   - Speech detected during playback → pause audio
   - If relevant input → agent responds
   - If not relevant → stay silent
   - After ~5-8 seconds silence → resume playback
   - "Pause" → explicit hold. "Resume" / "continue" → resume
   - This is primarily controlled through agent instructions and LiveKit's VAD/turn detection

3. Implement session end handling:
   - User says "I'm done" or "stop" → end session gracefully
   - Disconnection → end session, clean up
   - Extended inactivity → end session

4. Create `apps/server/src/agent/tools/sessionTools.ts`:
   - `endSession` — tool the agent can call when the user wants to stop

5. Write integration tests for the full handoff chain.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- Complete flow works: new user → setup → catch-up → browse ⇄ playback → end
- Returning user skips setup
- Session tracking records everything

---

## Phase 5: Client

### M16 — Client: LiveKit SDK Integration + Auth Screen

**What:** Replace Socket.io with LiveKit React Native SDK and build the email auth screen.

**Prerequisites:** M6, M7

**Key files to read first:**

- `apps/client/App.tsx` — current monolithic component (Socket.io + audio)
- `apps/client/package.json` — current dependencies
- `apps/client/app.json` — Expo config
- `packages/socket/src/SocketInterfaces.ts` — current Socket.io types (being replaced)
- LiveKit docs: use livekit-docs MCP to search for React Native SDK setup, Expo integration
- `docs/PROJECT_OVERVIEW.md` § "Client Screens" — target screens

**Deliverables:**

1. Update `apps/client/package.json`:
   - Remove: `socket.io-client`
   - Add: `@livekit/react-native` (LiveKit React Native SDK)
   - Add: `@livekit/react-native-webrtc` (WebRTC transport)
   - Check LiveKit docs for any other required Expo plugins
   - Keep: `@react-native-async-storage/async-storage`, `react-native-realtime-audio` (may still be useful)

2. Update `apps/client/app.json`:
   - Add LiveKit Expo plugins per their documentation
   - Add background audio mode for iOS (`UIBackgroundModes: ["audio"]`)
   - Add microphone permission strings

3. Create navigation structure (can use simple state-based navigation or Expo Router):
   - `AuthScreen` — email input + code verification
   - `HomeScreen` — start button + session teaser
   - `SessionScreen` — active voice session (LiveKit room)

4. Create `apps/client/src/screens/AuthScreen.tsx`:
   - Email input field
   - Submit button → calls `POST /api/auth/send-code`
   - Code input field (appears after email submitted)
   - Verify button → calls `POST /api/auth/verify-code`
   - On success: store JWT in AsyncStorage, navigate to HomeScreen
   - Clean, minimal design

5. Create `apps/client/src/screens/HomeScreen.tsx`:
   - Large start button (primary UI element)
   - On tap: call `POST /api/auth/livekit-token` → get token + room → navigate to SessionScreen
   - Show session teaser text (placeholder for now)
   - Account info / logout (minimal, tucked away)

6. Create `apps/client/src/screens/SessionScreen.tsx`:
   - Join LiveKit room with the token from HomeScreen
   - Audio I/O handled by LiveKit SDK (microphone + agent audio playback)
   - Status indicator (connecting, listening, speaking)
   - Stop button → leave room, navigate back to HomeScreen
   - Minimal visual UI for MVP

7. Update `apps/client/App.tsx`:
   - Replace monolithic Socket.io component with navigation between screens
   - Wrap with LiveKit's `LiveKitRoom` provider (or equivalent from RN SDK)

8. Update `apps/client/src/config.ts` (create if needed):
   - `API_URL` — server HTTP endpoint
   - `LIVEKIT_URL` — LiveKit Cloud URL (passed from server via token endpoint)

**Acceptance criteria:**

- `bun run typecheck` passes (client workspace)
- `bun run lint` passes
- App launches → shows auth screen → email flow works → home screen → tap start → connects to LiveKit room → can hear agent speak

**Notes:**

- The LiveKit React Native SDK handles all audio I/O — microphone capture, echo cancellation, and playback. You may not need `react-native-realtime-audio` anymore, but check LiveKit's RN docs.
- The server URL should be configurable (not hardcoded IP like the current implementation).
- For MVP, simple state-based navigation (`useState` with screen enum) is fine. Expo Router can come later.

---

### M17 — Client: Active Session UI + RPC Handlers

**What:** Build the active session screen with content cards, session history, and RPC handlers for agent triggers.

**Prerequisites:** M16, M15

**Key files to read first:**

- `apps/client/src/screens/SessionScreen.tsx` — basic session screen from M16
- LiveKit docs: search for RPC in React Native SDK, data channels, participant events
- `docs/PROJECT_OVERVIEW.md` § "Agent → Client Triggers" — the trigger types
- `docs/PROJECT_OVERVIEW.md` § "Client Screens" > "Active Session Screen" — target UI

**Deliverables:**

1. Define RPC method contracts in `packages/socket/src/RPCContracts.ts`:
   - `showTopic(data: { title: string, summary: string, imageUrl?: string })` — display topic card
   - `showPodcast(data: { title: string, show: string, duration: number })` — podcast metadata
   - `showProgress(data: { items: number, current: number })` — catch-up progress
   - `showMode(data: { mode: 'setup' | 'catchup' | 'browse' | 'playback' })` — mode transition
   - `showLoading(data: { message?: string })` — generation indicator
   - `showTranscript(data: { text: string })` — live transcript of agent speech (for transcript toggle)

2. Update `apps/client/src/screens/SessionScreen.tsx`:
   - **Status indicator** — animated visual showing current state (listening, speaking, paused, generating). Pulsing ring or waveform.
   - **Content card** — displays current topic (title, summary, image). Transitions on `showTopic` RPC.
   - **Session history** — scrollable feed of past topic cards. Tapping a card could trigger "tell me more about this."
   - **Stop button** — always visible
   - **Transcript toggle** — shows live agent speech text. Off by default.

3. Register RPC handlers in the LiveKit room:
   - `showTopic` → update content card
   - `showPodcast` → update content card with podcast metadata
   - `showProgress` → show/update catch-up progress bar
   - `showMode` → update status indicator
   - `showLoading` → show generation spinner

4. Update agent code to send RPC triggers at appropriate points:
   - CatchUpAgent: `showProgress` as it moves through briefing items, `showTopic` for each item
   - BrowseAgent: `showTopic` when discussing content, `showLoading` when generating
   - PlaybackAgent: `showPodcast` with episode metadata
   - All agents: `showMode` on handoff

5. Write tests for RPC contract types.

**Acceptance criteria:**

- `bun run typecheck` passes
- `bun run lint` passes
- `bun test` passes
- During a session, content cards update as the agent discusses topics
- Catch-up progress indicator shows during briefing
- Mode transitions visible in status indicator

---

### M18 — Client: Background Audio + Lock Screen Controls

**What:** Enable sessions to continue when the app is backgrounded, with lock screen media controls.

**Prerequisites:** M16

**Key files to read first:**

- `apps/client/app.json` — Expo config (background modes)
- LiveKit docs: search for background audio, React Native background mode
- `docs/PROJECT_OVERVIEW.md` § "Session Lifecycle" > "Background audio" — requirements

**Deliverables:**

1. Configure background audio for iOS:
   - Add `UIBackgroundModes: ["audio"]` to `app.json` iOS config (if not already from M16)
   - Configure audio session category for playback + recording

2. Configure background audio for Android:
   - Add foreground service or equivalent for background audio
   - Add required permissions

3. Implement lock screen media controls:
   - Use `expo-av` or a React Native media session library
   - Show: current topic title, image (if available)
   - Controls: play/pause, skip forward (next topic)
   - Wire controls to agent RPC or LiveKit data channel messages

4. Handle app lifecycle:
   - App backgrounded → LiveKit connection stays alive, audio continues
   - App foregrounded → UI updates to current state
   - App killed → session ends gracefully (server-side cleanup)

5. Test background audio behavior on iOS simulator/device.

**Acceptance criteria:**

- Audio continues playing when app is backgrounded
- Lock screen shows current topic and media controls
- Play/pause and skip controls work from lock screen

**Notes:**

- This is iOS/Android native configuration — some of it may require custom Expo plugins or config plugins.
- LiveKit's WebRTC transport should naturally support background audio since WebRTC runs at the OS level, but it may need explicit permission configuration.

---

## Phase 6: Cortex Pathways

### M19 — Custom Cortex Pathways

**What:** Create custom Cortex pathways optimized for Alpha's core use cases: catch-up generation and response generation. Intent classification and topic drift detection are handled by the agent LLM's system prompt for MVP — dedicated pathways can be added later if needed.

**Prerequisites:** M4 (Cortex client)

**Key files to read first:**

- `~/src/aj/aj-cortex/pathways/rag.js` — complex pathway example with RAG and custom resolver
- `~/src/aj/aj-cortex/pathways/summary.js` — simple prompt pathway
- `~/src/aj/aj-cortex/pathways/create_answer_article_aje.js` — RAG + article search pathway
- `~/src/aj/aj-cortex/pathways/chat_labeeb.js` — chat pathway
- `~/src/aj/aj-cortex/config/default.json` — entity configuration examples (search for `entityConfig`)
- `docs/PROJECT_OVERVIEW.md` § "Custom Cortex Pathways" — pathway descriptions

**Deliverables — create these files in `~/src/aj/aj-cortex/pathways/`:**

1. `alpha_catchup_generator.js`:
   - Assembles a catch-up briefing script from multiple content inputs
   - Model: standard (e.g., `oai-gpt4o`)
   - Input: `{ topStories: string, wireHighlights: string, newPodcasts: string, timeSinceLastSession: string, catchUpDepth: string }`
   - Output: structured JSON briefing script with segments, transitions, and timing cues
   - Custom resolver that may call `summary` pathway for condensing articles

2. `alpha_response_generator.js`:
   - RAG-grounded news response optimized for TTS output
   - Model: standard (e.g., `oai-gpt4o`)
   - Input: `{ query: string, sources: string }` (sources are pre-fetched articles/wire data)
   - Output: natural speech text (optimized for audio — appropriate length, conversational cadence, no markdown/formatting)
   - Prompt engineering: output should sound like a knowledgeable host explaining something, not a written article

3. Create an Alpha entity in `~/src/aj/aj-cortex/config/default.json` (or document the configuration to add):
   - Entity name: `alpha_host`
   - Instructions: news and podcast host persona (from PROJECT_OVERVIEW § "Agent Personality")
   - Tools: search AJE content, search wires
   - Memory: disabled (stateless — session state lives in LiveKit)

**Acceptance criteria:**

- Each pathway file follows Cortex pathway format (exports default config object)
- Pathways would work if deployed to a Cortex instance (correct model references, input/output format)
- Response generator output is optimized for TTS (no markdown, natural speech patterns)

**Notes:**

- These are files in the aj-cortex repo, not in the Alpha repo. They would be submitted as a PR to aj-cortex.
- Test locally by running Cortex (`cd ~/src/aj/aj-cortex && npm run dev`) and calling the pathways via REST.
- The response generator is the most important one — it determines the quality of generated audio content. Spend time on the prompt to ensure output sounds natural when spoken.
- For the entity, look at existing entity definitions in `config/default.json` (search for `"entityConfig"`) as templates.

---

## Phase 7: Polish & Integration

### M20 — Help System + Preferences UI

**What:** Add the help overlay (voice command reference) and minimal preferences UI to the client.

**Prerequisites:** M17

**Key files to read first:**

- `apps/client/src/screens/HomeScreen.tsx` — home screen (from M16)
- `apps/client/src/screens/SessionScreen.tsx` — active session (from M17)
- `docs/PROJECT_OVERVIEW.md` § "Client Screens" — help icon, account access

**Deliverables:**

1. Create help overlay component:
   - List of example voice commands organized by mode:
     - Catch-up: "next", "tell me more", "play that podcast"
     - Browse: "what's happening in Sudan?", "play the latest episode of The Take", "I'm done"
     - Playback: "pause", "skip ahead", "what did they just say about X?"
   - Accessible from both HomeScreen and SessionScreen via help icon
   - Dismissable with tap or "close"

2. Add account/preferences section to HomeScreen:
   - Display user name and email
   - Catch-up depth preference (brief / standard / detailed)
   - Logout button (clears AsyncStorage token)

3. Write minimal tests for component rendering.

4. Add server-side preferences endpoint in `apps/server/src/ApiServer.ts`:
   - `PUT /api/user/preferences` — authenticated, accepts `{ timezone?, catchUpDepth?, preferences? }`, calls `updatePreferences` CRUD
   - `GET /api/user/preferences` — authenticated, returns current preferences

**Acceptance criteria:**

- Help overlay shows and dismisses correctly
- Preferences API endpoints work (GET returns current, PUT saves updates)
- Client preferences UI saves via the API
- Logout clears token and returns to auth screen

---

## Milestone Dependency Graph

```
M1 ─→ M2 ─┬─→ M3
           │
           ├─→ M6 ─→ M7 ─┬─→ M8 ─→ M10 ─→ M13 ─┬─→ M14 ─→ M15
           │              │                  ↑     │
           │              ├─→ M12 ───────────┘     │
           │              │                        │
           │              └─→ M16 ─→ M17 ─→ M20   │
           │                   │                   │
           │                   └─→ M18             │
           │                                       │
           └─→ M9 ────────────────────────────────┘
                ↑
M4 ────────────┤ (also feeds M11, M12)
               │
M5 ────────────┘

M11 ─── (depends on M4, M2; feeds into M13)

M19 ─── (depends on M4; independent PR to aj-cortex)
```

**Key dependency notes:**

- M13 (BrowseAgent) is the convergence point: depends on M9, M10, M11, M12
- M14 (PlaybackAgent) depends on M13 (for the stub file)
- M11 and M12 can run in parallel with M8-M10 since they share no dependencies
- M16 (client) can start as soon as M6+M7 are done — in parallel with agent work
- M19 (Cortex pathways) can start any time after M4 — early start gives PR review time

**Suggested execution order** (single-track; parallelize where noted):

1. M1 (schema)
2. M2 (CRUD)
3. M4 + M5 + M3 in parallel (Cortex client, Content client, consolidation)
4. M6 (email auth API)
5. M7 (LiveKit scaffolding)
6. M8 + M9 + M11 + M19 in parallel (SetupAgent, search tools, streaming gen, Cortex pathways)
7. M10 + M12 + M16 in parallel (CatchUpAgent, Cortex LLM integration, client LiveKit + auth)
8. M13 (BrowseAgent — needs M9, M10, M11, M12)
9. M14 + M17 in parallel (PlaybackAgent, client session UI)
10. M15 + M18 in parallel (handoff wiring, background audio)
11. M20 (help + preferences)
