# Manual Test Plan — Local Environment Setup

This document describes how to stand up the Alpha platform locally with enough podcast content to exercise all user-facing flows end-to-end.

---

## Current State

| Asset                                                      | Status      | Count                           |
| ---------------------------------------------------------- | ----------- | ------------------------------- |
| `podcast_topics` rows (old schema, no `episode_id`)        | Exist       | 307 across 43 episodes          |
| Importer WAV files (`apps/importer/public/pods/`)          | Exist       | 203 files                       |
| Generator cached segments (`apps/generator/pods/cache/`)   | Exist       | 105 article dirs                |
| Generator full podcast (`apps/generator/pods/podcast.wav`) | Exists      | 127 MB                          |
| Server `audio/topics/` directory                           | Empty       | 0                               |
| New schema tables (`podcast_episodes`, `sessions`, etc.)   | Not created | Migration 0004 pending          |
| Users table                                                | Old schema  | Has `phone_number`, not `email` |

**Bottom line:** The database has old-schema data from prior importer runs, but the new schema hasn't been applied and the server's audio directory is empty. We need to migrate, seed episodes, link topics, and populate the audio directory.

---

## Step 1: Apply Database Migration

The migration `0004_handy_the_phantom.sql` creates all new tables and alters existing ones. It renames `phone_number` → `email`, adds `episode_id`/`start_time`/`end_time` to `podcast_topics`, and creates `podcast_episodes`, `sessions`, `user_preferences`, `listen_history`, and `cached_responses`.

```bash
cd packages/data
bun run migrate
```

**Verify:**

```sql
psql postgres://paulingalls@localhost:5432/alpha -c "\dt"
-- Should show: cached_responses, listen_history, podcast_episodes, podcast_topics, sessions, user_preferences, users
```

**Risk:** The migration renames `phone_number` → `email` and drops the old unique constraint. Existing user rows will have their phone number in the `email` column. This is fine — we'll create fresh test users anyway.

---

## Step 2: Create Podcast Episodes from Existing Topic Data

The 307 existing topics are grouped into 43 episodes by directory path (the middle path segment in `filename`). We need to:

1. Insert a `podcast_episodes` row for each unique episode directory
2. Update each `podcast_topics` row to set `episode_id` pointing to its parent episode

Write a seed script at `packages/data/src/seed-episodes.ts`:

```bash
cd packages/data
bun run seed-episodes.ts
```

The script should:

- Query `SELECT DISTINCT` episode directory IDs from `podcast_topics.filename`
- For each, create a `podcast_episodes` row with:
  - `showName`: `"Al Jazeera"` (all from same Omny import)
  - `title`: Derive from topic titles in that group (use the first topic's title or the directory slug)
  - `publishedAt`: Use the earliest `created_at` from topics in that group
- Update `podcast_topics` rows to set `episode_id` and extract `start_time`/`end_time` from filename ordering

---

## Step 3: Populate Server Audio Directory

The server's `PlaybackAgent` looks for topic audio at `apps/server/audio/topics/{basename}`. The existing importer WAV files are at `apps/importer/public/pods/{episodeId}/{clip}.wav`. The topic `filename` column stores relative paths like `public/pods/wo8swVXf7_VNDsQBJKabr/clip_0-pcm_s16le.wav`.

The `PlaybackAgent` uses `path.basename(topic.filename)` to get just the clip filename, then looks in `audioDir`. Since clip names like `clip_0-pcm_s16le.wav` collide across episodes, we need to either:

**Option A — Flatten with unique names (recommended):**

- Update `podcast_topics.filename` to use unique basenames (e.g., `{episodeId}_clip_0.wav`)
- Copy/symlink files into `apps/server/audio/topics/` with those names

**Option B — Symlink by episode subdirectory:**

- Change the `audioDir` setup to include episode subdirectories
- Requires a code change in `PlaybackAgent`

Go with **Option A**. Add this to the seed script:

```bash
# For each topic:
#   1. Copy apps/importer/public/pods/{episodeDir}/{clip}.wav → apps/server/audio/topics/{episodeDir}_{clip}.wav
#   2. UPDATE podcast_topics SET filename = '{episodeDir}_{clip}.wav' WHERE id = ...
```

**Verify:**

```bash
ls apps/server/audio/topics/ | wc -l
# Should be ~307 (matching topic count)
```

---

## Step 4: Generate Fresh Podcast Content (Optional, Adds Depth)

The generator creates a daily news podcast from Al Jazeera articles. Running it adds a fresh episode with different content from the imported podcasts.

```bash
cd apps/generator
bun run dev
# Triggers immediately on start (triggerOnStart: true)
# Takes ~10-20 minutes to complete
# Produces: pods/podcast.wav + pods/cache/{slug}/segment.pcm for each article
```

After generation completes:

1. Create a `podcast_episodes` row for the generated episode
2. For each cached segment in `pods/cache/`, create a `podcast_topics` row with embedding
3. Convert PCM segments to WAV and copy to `apps/server/audio/topics/`

**Note:** The generator already inserts topics via `TopicInsertNode`, but the filename paths will point to the generator's local `pods/cache/` directory. You'll need to copy the audio and update the paths.

**Decision: Skip this for the first test pass.** The 43 imported episodes (307 topics) provide enough content variety. Only run the generator if you want to test the catch-up flow with "new" content that doesn't appear in listen history.

---

## Step 5: Configure External Services

The server agent needs two external services at prewarm time:

| Service         | Env Var               | Purpose                              | Required for Testing?                |
| --------------- | --------------------- | ------------------------------------ | ------------------------------------ |
| Content GraphQL | `CONTENT_GRAPHQL_URL` | Article search, catch-up top stories | Yes — catch-up and browse            |
| Cortex API      | `CORTEX_API_URL`      | Embeddings, RAG, chat completions    | Yes — search and response generation |

Both are validated at agent startup (`apps/server/src/agent/main.ts:73-92`). The server will start without them (HTTP endpoints work), but the LiveKit agent will fail to prewarm if they're missing.

**If you don't have Cortex/Content services running locally:**

- Set placeholder URLs to allow server startup
- The auth, preferences, and basic API flows will work
- Voice agent sessions will fail at the point they try to call these services
- This is enough to test: auth flow, preferences UI, LiveKit room connection, basic RPC

**If you do have them:**

```bash
# In apps/server/.env
CONTENT_GRAPHQL_URL=https://www.aljazeera.com/graphql
CORTEX_API_URL=http://localhost:4000  # or your Cortex instance
```

---

## Step 6: Start Infrastructure

### Prerequisites

```bash
# PostgreSQL running locally on port 5432 with database "alpha"
# LiveKit server running (local dev server or LiveKit Cloud)
# Bun installed
```

### Start the Server

```bash
# From repo root
bun run dev
# Or from apps/server
cd apps/server && bun run dev
```

### Start the Client

```bash
cd apps/client && bun start
# Open in Expo Go or iOS simulator
```

---

## Step 7: Test Matrix

### Content Requirements per Flow

| Flow                                   |  Needs Topics?   |     Needs Episodes?      | Needs Audio Files? | Needs Cortex? | Needs Content? |
| -------------------------------------- | :--------------: | :----------------------: | :----------------: | :-----------: | :------------: |
| Auth (send code, verify, get token)    |        No        |            No            |         No         |      No       |       No       |
| Preferences (get/put, timezone sync)   |        No        |            No            |         No         |      No       |       No       |
| LiveKit room connection                |        No        |            No            |         No         |      No       |       No       |
| Setup agent (new user name collection) |        No        |            No            |         No         |      No       |       No       |
| Catch-up briefing                      |        No        | Yes (for "new podcasts") |         No         |      Yes      |      Yes       |
| Browse & search                        | Yes (embeddings) |           Yes            |         No         |      Yes      |    Optional    |
| Play podcast                           |       Yes        |           Yes            |        Yes         |      No       |       No       |
| Playback controls (pause/skip/resume)  |       Yes        |           Yes            |        Yes         |      No       |       No       |
| Search during playback                 |       Yes        |           Yes            |        Yes         |      Yes      |       No       |
| Lock screen controls                   |       Yes        |           Yes            |        Yes         |      No       |       No       |

### Minimum Viable Test Dataset

For a meaningful test pass covering all flows:

- **3 episodes** with **5-8 topics each** = ~20 topics with embeddings and audio files
- **1 test user** with email auth
- **Cortex + Content services** reachable (or mocked)

The existing 43 episodes / 307 topics is more than enough — the work is migrating the schema and wiring up audio files.

---

## Test Scenarios

### 1. Auth & Onboarding

1. Open client → verify login screen appears
2. Enter email → receive verification code (check server logs for code)
3. Enter code → verify JWT issued, stored in SecureStore
4. Verify new user setup flow: agent asks for name
5. Say name → verify it's saved to DB
6. Logout → verify token cleared, back to login screen
7. Login again → verify returning user flow (no name prompt)

### 2. Preferences

1. After login, verify HomeScreen loads preferences (name, email, catch-up depth)
2. Tap catch-up depth pill → verify preference saved to DB
3. Verify timezone auto-synced on login
4. Rapidly tap pills → verify rate limiting returns 429 after 30 requests

### 3. Catch-Up Briefing

1. Start a session → verify catch-up agent activates
2. Listen to briefing → verify it mentions recent articles and new podcasts
3. Verify `sessions.catch_up_delivered` set to `true` after briefing completes
4. End session, start new one immediately → verify short catch-up (< 2h since last)

### 4. Browse & Search

1. After catch-up, ask "What's happening in Ukraine?"
2. Verify agent searches topics by embedding similarity
3. Verify agent offers to play a relevant episode
4. Ask about a topic with no results → verify graceful fallback

### 5. Podcast Playback

1. Ask to play a specific episode → verify PlaybackAgent activates
2. Verify audio streams from topic files
3. Say "pause" → verify playback pauses
4. Say "resume" → verify playback continues from same point
5. Say "skip" → verify next topic plays
6. Ask a question during playback → verify search works, then playback resumes
7. Say "stop" → verify return to browse mode
8. Verify `listen_history` rows created with `completed_percent`

### 6. Lock Screen / Background

1. During playback, background the app
2. Verify lock screen controls appear (play/pause, skip)
3. Tap pause on lock screen → verify playback pauses
4. Tap skip → verify next topic plays
5. Bring app to foreground → verify UI state matches

### 7. Help Overlay

1. Tap "?" button on HomeScreen → verify help overlay appears
2. Close overlay → verify it dismisses
3. Tap "?" during session → verify session help overlay appears

---

## Quick-Start Checklist

```
[ ] 1. Apply migration:  cd packages/data && bun run migrate
[ ] 2. Write + run seed script to create episodes and link topics
[ ] 3. Copy importer audio to apps/server/audio/topics/ with unique names
[ ] 4. Update topic filenames in DB to match new basenames
[ ] 5. Set env vars in apps/server/.env (CONTENT_GRAPHQL_URL, CORTEX_API_URL)
[ ] 6. Start server:  bun run dev
[ ] 7. Start client:  cd apps/client && bun start
[ ] 8. Run through test scenarios above
```
