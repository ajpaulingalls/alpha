# Alpha - Project Overview

## Vision

Alpha is a voice-driven mobile app that gives users hands-free access to Al Jazeera's full podcast catalog, article archive, and multiple media wire sources — all through natural conversation. The phone stays in your pocket.

### The Core Experience

On launch, Alpha plays a personalized catch-up: what's happened since you last opened the app, what's new in the world, and any recently released podcasts. Once the catch-up finishes, the user can browse, ask questions, and dig deeper — entirely by voice.

The key interaction is **interactive Q&A mid-listen**. A user hearing a podcast about a conflict can ask "what's the backstory here?" and Alpha responds with either a relevant existing podcast clip or a dynamically generated one, drawing from Al Jazeera's full content library. This turns passive podcast listening into an active, conversational experience.

### Streaming Generation with Cache-and-Reuse

To keep dynamic responses feeling conversational, Alpha uses a streaming pipeline: the LLM generates text that streams into TTS, which streams audio to the user in real-time. Time-to-first-audio lands around 1-2 seconds — fast enough to feel like a natural reply rather than a loading screen.

Every generated response is simultaneously recorded server-side, embedded, and indexed. When a future user asks a similar question, Alpha can serve the cached response instantly instead of regenerating it. This creates a content flywheel: more users produce more cached content, which makes responses faster and cheaper over time. The system gets better the more it's used.

Cached responses are subject to staleness checks — evergreen background and history questions cache well, while breaking news topics are regenerated to stay current.

### Content Sources

- **Al Jazeera podcasts** - Imported, transcribed, split into topics, and embedded for semantic search
- **Al Jazeera article archive** - Full article history indexed for RAG-powered Q&A
- **Media wire services** - Multiple wire sources for breadth of coverage
- **Generated podcasts** - Daily automated news-to-podcast episodes (two AI hosts, Blair & Betty) produced from current articles

### Design Principles

1. **Voice-first** - The entire experience works without looking at the screen. Signup, browsing, playback, and Q&A are all conversational.
2. **Catch up, then explore** - Launch gives you a briefing; you decide when to go deeper.
3. **Answer with audio** - When the user asks a question, the response is a podcast clip — either sourced from existing content or generated on the fly. The format stays consistent.
4. **Get smarter over time** - Every interaction enriches the content library for future users.

---

## System Architecture

```
                         +-------------------+
                         |   Mobile Client   |
                         | (React Native/Expo)|
                         |  LiveKit RN SDK   |
                         +--------+----------+
                                  |
                          WebRTC (audio + data)
                                  |
                         +--------v----------+
                         |   LiveKit Cloud   |
                         |  (media transport) |
                         +--------+----------+
                                  |
                         +--------v----------+
                         |   Agent Server    |
                         | (LiveKit Agents   |
                         |  Node.js SDK)     |
                         +--+-----+-----+---+
                            |     |     |
               +------------+     |     +-------------+
               |                  |                   |
     +---------v------+   +------v-------+   +-------v-------+
     |   AJ Cortex    |   |  PostgreSQL  |   |  Audio Files  |
     | (LLM, RAG,     |   | + pgvector   |   |  (./pods/)    |
     |  wires, tools)  |   +--------------+   +---------------+
     +-----------------+          ^
                    +-------------+-------------+
                    |                           |
           +-------v--------+         +--------v-------+
           |    Generator    |         |    Importer     |
           | (news->podcast) |         | (index podcasts)|
           +-----------------+         +----------------+
```

### Key Architectural Decisions

**LiveKit as the voice infrastructure.** The prototype used Socket.io with the OpenAI Realtime API directly. The production architecture uses LiveKit Cloud for media transport and the LiveKit Agents SDK (Node.js) for the voice pipeline. This provides:

- Managed WebRTC infrastructure — no custom audio streaming code
- Built-in STT → LLM → TTS pipeline with streaming
- Native VAD, turn detection, and interruption handling
- Multi-agent handoffs for conversation phase management
- React Native + Expo SDK for the mobile client
- Background audio support via WebRTC
- RPC for structured agent → client communication (UI triggers)

**Cortex as the AI backbone.** Rather than calling OpenAI directly, the agent routes LLM calls through AJ Cortex, gaining access to multiple model providers, wire service data, RAG, and journalism-specific pathways.

**Multi-agent workflow.** Instead of one monolithic handler, the voice experience is decomposed into focused agents that hand off to each other. Each agent has minimal instructions and only the tools it needs, keeping context small and latency low.

---

## Apps

### Agent Server (`apps/server/`)

A LiveKit Agent server (Node.js SDK) that joins LiveKit rooms as a voice AI participant. The agent handles the full voice experience through multiple focused agents that hand off to each other.

**Agent workflow (multi-agent handoffs):**

```
SetupAgent → CatchUpAgent → BrowseAgent ⇄ PlaybackAgent
```

- **SetupAgent** — First-time only. Collects the user's name via voice, delivers the intro explaining how Alpha works, then hands off to CatchUpAgent. Tools: `recordName`.
- **CatchUpAgent** — Assembles and delivers a personalized briefing based on time since the user's last session. Covers top stories, wire highlights, and new podcast releases. Tools: `fetchTopStories`, `fetchWireHighlights`, `fetchNewPodcasts`. Hands off to BrowseAgent when the briefing is complete.
- **BrowseAgent** — Free-form voice navigation. Handles content questions, podcast requests, follow-ups, and conversational exchanges. This is where content resolution happens (cache → clip → generate). Tools: `searchContent`, `searchPodcasts`, `generateResponse`, `playPodcast` (triggers handoff to PlaybackAgent).
- **PlaybackAgent** — Manages podcast playback with mid-listen interactions (pause, skip, ask about what's playing). Tools: `pausePlayback`, `resumePlayback`, `skipTopic`, `searchContext`. Hands back to BrowseAgent when playback ends or the user says "stop."

Each agent has focused instructions and minimal tools — small context means faster LLM responses.

**Pipeline configuration:**

- **STT** — Deepgram (or configurable via LiveKit Inference)
- **LLM** — Routed through Cortex (multi-model access)
- **TTS** — Cartesia Sonic or OpenAI TTS (configurable per agent)
- **VAD** — Silero (built-in)
- **Turn detection** — LiveKit multilingual model (built-in)

**Agent → client communication:**
Agents send structured data to the client via LiveKit RPC — topic cards, podcast metadata, progress updates, mode transitions. The client renders these as visual companions to the audio.

**HTTP API (Hono):**
Retains a lightweight Hono server for non-realtime endpoints: health checks, email verification, token generation for LiveKit room access.

### Generator (`apps/generator/`)

Automated news-to-podcast pipeline. Runs on a daily cron schedule.

**Pipeline stages** (defined in `generate-podcast.json`, executed by `@ts-flow`):

1. Fetch Al Jazeera homepage via GraphQL API
2. Download full article content for featured posts
3. Summarize each article with GPT (max 200 words)
4. Generate vector embeddings for search
5. Write a two-host podcast script (Blair & Betty) as structured JSON
6. Convert script to audio using OpenAI TTS - `PodGenEngine` generates per-line audio, caches PCM segments, and mixes in intro/transition music
7. Store podcast metadata + embedding in PostgreSQL

**Voice mapping:** Blair (male) = onyx voice, Betty (female) = shimmer voice

### Importer (`apps/importer/`)

On-demand podcast indexing. Triggered by `POST /start` with a `{ programId }` payload.

**Pipeline stages** (defined in `index-podcast-topics.json`, executed by `@ts-flow`):

1. Fetch podcasts from Omny Studio API
2. Download ad-free audio files
3. Transcribe with Whisper (VTT format)
4. Extract topics with GPT (name, summary, start/end timestamps)
5. Trim audio to topic boundaries with ffmpeg
6. Resample to 24kHz 16-bit mono PCM
7. Embed topic summaries (1536 dimensions)
8. Insert into `podcast_topics` table with vector embeddings

### Client (`apps/client/`)

React Native/Expo mobile app using the LiveKit React Native SDK. Voice-first interface with minimal visual UI.

**Key behaviors:**

- Checks `AsyncStorage` for existing auth token on launch
- Authenticated users request a LiveKit room token from the HTTP API, then join a LiveKit room via WebRTC
- Audio I/O is handled by LiveKit's SDK — microphone capture, echo cancellation, and agent audio playback are all managed by the WebRTC transport layer
- Registers RPC methods to receive agent → client triggers (topic cards, podcast metadata, mode transitions)
- Supports background audio via WebRTC — sessions continue when the app is backgrounded
- Lock screen media controls (play/pause, skip) via standard OS media APIs

---

## Shared Packages

### `@alpha/data` (`packages/data/`)

Drizzle ORM database layer for PostgreSQL + pgvector.

**Schemas:** See [Data Model](#data-model) for full table definitions. Seven tables: `users`, `user_preferences`, `sessions`, `listen_history`, `podcast_episodes`, `podcast_topics`, `cached_responses`.

**Subpath exports:**

- `@alpha/data/schema/*` — table definitions (users, user_preferences, sessions, listen_history, podcast_episodes, podcast_topics, cached_responses)
- `@alpha/data/crud/users` — user account CRUD
- `@alpha/data/crud/preferences` — user preferences CRUD
- `@alpha/data/crud/sessions` — session lifecycle (create, end, find latest)
- `@alpha/data/crud/listen-history` — record and query what users have heard
- `@alpha/data/crud/episodes` — podcast episode CRUD
- `@alpha/data/crud/topics` — podcast topic CRUD (used by importer and content resolution)
- `@alpha/data/crud/cached-responses` — cache lookup, store, hit count, expiry
- `@alpha/data/client` — database connection

### `@alpha/ai` (`packages/ai/`)

OpenAI TTS utility. Exports `generateAudioFromTextToFile()` which calls the TTS API and writes PCM output (24kHz 16-bit) directly to a file.

### `@alpha/content` (`packages/content/`)

Typed clients for external content APIs. Two independent clients:

- **`ContentClient`** — Al Jazeera GraphQL API (`aljazeera.com/graphql`). Searches articles, fetches full article content for RAG context, and discovers podcast series. Public API, no auth.
- **`OmnyClient`** — Omny Studio Consumer API (`api.omny.fm`). Read-only access to full podcast episodes for playback. Lists programs, paginates episodes (cursor-based), and fetches individual clips by slug. Public API, no auth. Constructor takes an org ID.

**Subpath exports:**

- `@alpha/content` — both clients + all public types
- `@alpha/content/client` — `ContentClient` only
- `@alpha/content/omny-client` — `OmnyClient` only
- `@alpha/content/types` — all type definitions

### `@alpha/socket` (`packages/socket/`)

Shared type definitions for agent ↔ client communication. With the move to LiveKit, this will evolve to define the RPC method contracts and data payloads for agent → client triggers (topic cards, podcast metadata, mode transitions) rather than Socket.io event types.

---

## User Experience Flow

### 1. First Launch (Auth → Setup → Catch-Up)

**Auth (screen-driven):**
The only part of Alpha that requires looking at your phone.

1. App opens to a simple screen: email input field, submit button
2. User enters email, taps submit
3. Server sends a 6-digit magic code to their email
4. User enters the code in the app
5. On verification: server creates the user, generates a JWT, client persists it
6. Screen transitions — the voice agent takes over

**Setup (voice-driven, ~25 seconds):**
The agent collects minimal info and sets expectations.

7. Agent: _"Welcome to Alpha. What's your name?"_
8. User says their name → agent stores it
9. Agent: _"Hey Sarah, I'm Alpha. I'm going to catch you up on what's been happening today. If anything catches your ear, just jump in — ask me a question, tell me to go deeper, or say 'next' to move on. Here's what's going on..."_

This intro communicates three things: what's about to happen, that you can interrupt, and how to interact. That's enough — the user learns the rest by doing.

**Catch-up begins (value delivered under 1 minute from install).**

### 2. Returning User

1. App opens, JWT found in storage
2. Client connects to server with token — no auth screen
3. Agent starts immediately with a personalized catch-up:
   - What's happened since the user last opened the app
   - Any new podcasts released
   - Top stories from wire services
4. Once the catch-up finishes, the user is in browse mode

### 3. Catch-Up Mode

The default state on every app launch. The agent delivers a briefing tailored to recency — more happened since yesterday than since an hour ago.

**What the agent covers:**

- Top stories since the user's last session
- Breaking or developing stories with updates
- New Al Jazeera podcast episodes released
- Notable wire service items

**User can interrupt at any point:**

- _"Tell me more about that"_ → agent goes deeper on the current topic
- _"What's the backstory?"_ → agent provides context (from cached clip or generated response)
- _"Next"_ → skip to the next item
- _"Play that podcast"_ → switches to playing the referenced podcast episode
- Silence → catch-up continues to the next item

**Catch-up ends:**
When the briefing is complete, the agent lets the user know and transitions to browse mode: _"That's the latest. Want to explore anything, or are you good for now?"_

### 4. Browse Mode

Free-form voice navigation. The user explores by asking for what they want.

**Example interactions:**

- _"What's going on in Sudan?"_ → agent finds relevant content (cached clip, podcast topic, or generated response)
- _"Play the latest episode of The Take"_ → streams the podcast
- _"What are the latest podcasts?"_ → agent lists recent episodes, user picks one
- _"Tell me about the climate summit"_ → agent pulls from articles and podcasts, responds with audio
- _"I'm done"_ or silence → session winds down gracefully

**Content resolution:** When the user asks a question, the agent decides the best way to answer:

1. **Cache hit** — A previously generated response matches the question (vector similarity). Stream it instantly.
2. **Existing podcast clip** — A topic segment from an imported/generated podcast matches. Play that clip.
3. **Generate new** — No good match exists. Stream a new response via LLM → TTS pipeline. Record and index it for future reuse.

### 5. Podcast Playback Mode

When the user requests a specific podcast or the agent plays a relevant clip.

**During playback, the user can:**

- _"Pause" / "Resume"_
- _"Skip ahead"_ or _"Next topic"_ → jump to the next topic segment
- _"What did they just say about X?"_ → agent pauses playback and responds, then offers to resume
- _"Who is [person mentioned]?"_ → agent provides context without leaving the podcast
- _"Stop"_ → returns to browse mode

**After a clip or segment ends:**
The agent briefly checks in: _"Want to keep listening, or explore something else?"_

### 6. Agent → Client Triggers

The voice agent drives the experience, but it can send triggers to update the client UI as a visual companion. The screen reinforces what's happening without requiring interaction.

**Example triggers:**

- `showTopic { title, summary, imageUrl }` — display a card for the current topic being discussed
- `showPodcast { title, show, duration }` — show podcast metadata during playback
- `showTranscript { text }` — live transcript of what the agent is saying
- `showProgress { items, current }` — catch-up progress indicator
- `showBrowseMode` — visual cue that the user is in free exploration
- `showLoading` — brief indicator while content is being generated

The screen is a companion, not the driver. Everything works without looking at it.

### 7. Session Lifecycle and Mic Behavior

**Starting a session:**
A tap on the screen starts the session. This is the one deliberate action required — no always-on listening, no wake word (for MVP). The tap connects to the server, opens the mic, and the voice agent begins.

**During a session:**
The mic stays open for the entire session. The user never needs to press-and-hold or push-to-talk — they just speak whenever they want. This is essential for the "phone in your pocket" experience.

**Conversation awareness (interruption handling):**
When audio is playing (catch-up, podcast, generated response) and speech is detected:

1. **Audio pauses immediately** — same behavior as AirPods conversation awareness
2. Speech is processed by the server
3. **If relevant** (question, command, "next", "go deeper") → agent responds
4. **If not relevant** (talking to another person, ambient speech) → agent stays silent. No "were you talking to me?" prompt. Just waits.
5. **After ~5-8 seconds of silence** → playback resumes where it left off
6. User can also say "continue" or tap to resume immediately

The app is confident and patient. It pauses because you spoke, responds if you were talking to it, and picks back up when the moment has passed. If you were having a side conversation, you barely notice — it just paused and resumed.

The silence threshold before auto-resume (5-8 seconds) is a tunable parameter. Too short interrupts human conversations; too long creates dead air after a quick aside. This will need real-world testing to dial in.

**Explicit pause/resume:**
For longer interruptions (phone call, getting off the train), the user can:

- Say "pause" → session pauses, mic stops processing
- Say "resume" / "continue" or tap → session picks back up
- This is distinct from the automatic conversation awareness behavior — it's a deliberate hold

**Background audio:**
Sessions must continue when the app is in the background. Audio playback and mic input stay active. This requires background audio permissions and is critical to the pocket experience — the user locks their phone and keeps listening.

**Ending a session:**

- Say "I'm done" or "stop" → session ends, mic closes, server disconnects
- Tap the stop button on screen
- App killed or backgrounded for an extended period → session ends gracefully, server cleans up

### 8. Client Screens

The app is deliberately minimal visually. The complexity lives in the voice layer. Four screens total.

**Auth Screen**
The only screen that requires typed input. Shown once on first launch, never again.

- Email input field
- 6-digit code input field (appears after email is submitted)
- Submit button
- Clean, simple — get through it fast

**Home Screen (Idle)**
What the user sees when the app is open with no active session. The start button is the centerpiece.

- Large, prominent start button — the primary UI element
- Session teaser: _"14 new stories since yesterday"_ or _"New episode of The Take"_ — gives the user a reason to tap start
- Account access (name, email, logout) — minimal, tucked away
- Help icon — opens a quick reference of example voice commands

**Active Session Screen**
Where the app lives during a session. Designed to be glanced at, not stared at.

- **Status indicator** — ambient visual showing app state: listening, speaking, paused, generating. A waveform, pulsing ring, or similar. Not text-based — readable at a glance from arm's length.
- **Content card** — the current topic being discussed. Shows title, summary snippet, and image when available (especially valuable for article-sourced content). Cards transition as the agent moves between topics.
- **Session history** — scrollable feed of topic cards covered in this session. When you glance at your phone, you can see what's been discussed. Tapping a past card tells the agent to revisit that topic.
- **Stop button** — always visible
- **Transcript toggle** — live text of what the agent is saying. Off by default, available for accessibility, noisy environments, or when the user wants to read along. Not prominent — a small toggle or swipe gesture.
- **Help icon** — same quick reference of example commands. Available but not intrusive. For users who forget what they can say.

**Lock Screen / Notification Center**
Not a custom screen, but critical to support via standard OS media APIs.

- Media controls: play/pause, skip forward (next topic)
- Current topic title and image
- This is the primary visual interface for the pocket use case — users glance at their lock screen to see what's playing

## Server-Side Content Architecture

### Content Sources

The server orchestrates across four content sources to answer user queries, build catch-ups, and play podcasts.

**1. Podcast Catalog (Omny Studio)**
Al Jazeera's existing podcast catalog, hosted on Omny Studio. Accessed two ways:

- **Consumer API** (`api.omny.fm`) — public read-only API for browsing programs and streaming full episodes. Used by the server via `OmnyClient` (`@alpha/content/omny-client`) when users request episode playback. No auth needed.
- **Management API** (`api.omnystudio.com/v0`) — authenticated API used by the importer to fetch episodes for indexing. Episodes are transcribed, split into topic segments, embedded for vector search. Each topic has a title, summary, embedding, and trimmed audio file that can be served as individual clips in response to user queries.

**2. Pre-Generated Episodes (Generator)**
Daily automated podcast episodes produced from Al Jazeera's top stories. Two AI hosts (Blair & Betty) discuss current news articles. Full audio files with embeddings stored in the database. Used in catch-ups and available for on-demand playback.

**3. Al Jazeera Article Archive (GraphQL API)**
Full access to Al Jazeera's website data via their GraphQL API, including article content and search. Used as RAG context when generating responses — the server searches for relevant articles, pulls their content, and feeds it to the LLM to produce an informed audio response.

**4. Cortex API (AJ Cortex)**
Al Jazeera's internal AI platform ([aj-cortex](https://github.com/ALJAZEERAPLUS/aj-cortex)). A GraphQL/REST API providing:

- **Wire service data** — access to multiple media wire sources for breadth beyond AJ's own content
- **Multi-model LLM access** — OpenAI, Google Gemini, Anthropic Claude, X.AI Grok — the server can route to the best model for each task
- **RAG and embeddings** — built-in retrieval augmented generation and similarity search pathways
- **Journalism-specific pathways** — summarization, headline generation, topic extraction, translation, content analysis
- **Entity system** — pre-configured AI entities with memory and specialized tools
- **Translation** — multi-language support across multiple providers

Cortex acts as Alpha's AI backbone rather than calling OpenAI directly, giving access to the right model for each task plus all editorial tooling.

### Content Resolution

When a user asks a question or makes a request, the server resolves the best way to respond:

**1. Direct podcast request** — _"Play the latest episode of The Take"_
Search imported podcasts by show name / recency. Stream the full episode. No generation needed.

**2. Cache hit** — _"What's happening in Sudan?"_ (asked before by another user)
Vector similarity search against previously generated responses. If a recent, relevant cached response exists, stream it instantly. Staleness rules apply: breaking news cache expires quickly, background/history content persists longer.

**3. Existing podcast clip** — _"What's the backstory on this conflict?"_
Vector similarity search against imported podcast topics and generated episode segments. If a topic segment matches well, play that clip directly. Original journalism, no generation needed.

**4. Search and generate** — No cached or pre-existing audio matches.

- Search Al Jazeera article archive (GraphQL) for relevant articles
- Search wire data (Cortex) for additional coverage
- Feed the best matching content as RAG context to the LLM (via Cortex)
- Stream the response through LLM → TTS → user
- Simultaneously record, embed, and index the generated audio for future cache hits

The resolution priority is: direct request → cache → existing clip → generate. This minimizes latency and cost while maximizing content reuse.

### Catch-Up Assembly

The personalized catch-up on app launch is assembled from multiple sources:

- **Time-since-last-session** determines scope — 8 hours gets a quick briefing, 3 days gets a fuller recap
- **Top stories** — pull from pre-generated episodes (Generator) and/or fresh article summaries (Al Jazeera GraphQL)
- **Wire highlights** — notable items from wire services (Cortex)
- **New podcast releases** — recently imported episodes (Importer) the user hasn't heard
- The catch-up is structured as a sequence of short segments with natural transitions, delivered by the voice agent

### Streaming Generation Pipeline

When content must be generated on the fly:

1. **Cortex generates text** (streaming) — informed by RAG context from articles and wire data. Cortex provides text generation only; it has no audio/TTS capabilities.
2. **Text streams into TTS engine** (OpenAI TTS or Cartesia) — audio begins generating before the full text is complete. TTS is handled by LiveKit's TTS plugin or a direct API call, not by Cortex.
3. **TTS audio streams to the user** — time-to-first-audio ~1-2 seconds
4. **Server captures the TTS audio output**, saves it to disk, generates an embedding of the query, and indexes the response in the cache
5. **Future similar queries** hit the cache and stream the recorded audio instantly

The pipeline ensures the user never waits for a full generation cycle. They hear the response beginning almost immediately, and every generation enriches the cache for future users.

**Recording strategy:** The TTS engine produces audio that flows to the user via LiveKit. To cache it, the server taps into the TTS output (via agent pipeline hooks, a custom TTS wrapper, or a post-hoc re-generation) and writes the raw PCM to a WAV file. The simplest MVP approach is post-hoc: let the agent pipeline handle the live response, accumulate the text, then call TTS once more after the response completes to produce the cacheable audio file. This can be optimized later to capture audio inline.

### Voice Pipeline: STT → LLM → TTS (via LiveKit Agents)

The voice pipeline is managed by the LiveKit Agents SDK. Each agent session configures STT, LLM, and TTS providers, and the framework handles streaming, VAD, turn detection, and interruptions automatically.

**Pipeline configuration per agent:**

- **STT** — Deepgram Nova-3 (via LiveKit Inference or direct plugin)
- **LLM** — Routed through Cortex via a custom pipeline node override (Cortex's OpenAI-compatible `/v1/chat/completions` endpoint), giving access to multi-model selection and journalism-specific pathways. Cortex handles text generation only — no audio.
- **TTS** — Cartesia Sonic-3 or OpenAI TTS (configurable per agent, allowing different voices for different modes). TTS is the only audio generation step — Cortex does not produce audio.
- **VAD** — Silero (built-in, handles speech detection and pause/resume behavior)
- **Turn detection** — LiveKit multilingual model (handles natural conversation timing)

**Efficiency through agent decomposition:**
Instead of a single pipeline with an intent classifier gate, the multi-agent architecture achieves efficiency by keeping each agent's context minimal:

| Agent         | Context size                               | Tools   | Response speed                                 |
| ------------- | ------------------------------------------ | ------- | ---------------------------------------------- |
| SetupAgent    | Tiny — just name collection                | 1 tool  | Very fast                                      |
| CatchUpAgent  | Small — briefing script + sources          | 3 tools | Fast                                           |
| BrowseAgent   | Medium — content resolution + search       | 4 tools | Fast for cache/clip hits, ~1-2s for generation |
| PlaybackAgent | Small — playback controls + context search | 4 tools | Very fast for commands                         |

The LLM in each agent handles intent classification naturally through its instructions — no separate classification step needed. Navigation commands, content requests, and conversational exchanges are all handled by the active agent's instructions and tools. The agent handoff model means the LLM only sees tools relevant to the current conversation phase.

**Interruption handling:**
LiveKit's turn detection and VAD handle the conversation awareness behavior described in the UX flow. When the user speaks during agent audio playback, the framework automatically interrupts the agent's speech. The agent then processes the user's input and decides how to respond — or stays silent if the input isn't relevant (handled through agent instructions).

### Agent Personality and Topic Boundaries

The agent should feel like a knowledgeable, personable news host — not a robotic gatekeeper. It can chat, respond to pleasantries, and handle brief tangents naturally. But it has a gravitational pull back toward news and podcast content.

**How topic drift works:**

- **On-topic** — news, current events, podcasts, follow-up questions → full engagement, no restrictions
- **Brief tangent** — "what do you think about the Yankees?", "I'm tired today" → agent responds naturally, then steers back: _"Ha, I'm more of a news person — but actually, there's some interesting sports coverage today."_
- **Empathetic redirect** — "I'm stressed about work" → _"Sorry to hear that. Want me to find you something interesting to listen to?"_
- **Sustained drift** — multiple off-topic exchanges in a row → agent increases redirect pressure gently, not abruptly. The tone stays warm but the pull toward content gets stronger.

This is enforced through:

1. **System prompt** — defines the agent's role, personality, and boundaries. It's a news and podcast host, not a general assistant.
2. **Intent classifier** — flags topic drift so the system can track how far off-topic the conversation has gone
3. **RAG grounding** — when generating content responses, the LLM always works from source material (articles, transcripts, wire data), so it naturally stays factual and on-topic
4. **No general knowledge mode** — the agent never enters a mode where it's answering from its training data alone. Every substantive response is grounded in Al Jazeera content or wire data.

### Custom Cortex Pathways

Alpha can leverage existing Cortex pathways and create new ones via PR. Likely custom pathways:

- **Intent classifier** — fast categorization of user utterances with entity extraction
- **Catch-up generator** — assembles a briefing script from multiple content sources, tailored to time-since-last-session
- **Response generator** — RAG-grounded news response with streaming, optimized for TTS output (natural speech patterns, appropriate length)
- **Topic drift detector** — tracks conversation context and flags when redirect pressure should increase

---

## Data Model

### Schema Overview

```
┌──────────────────┐       ┌──────────────────────┐
│      users       │       │   user_preferences    │
│──────────────────│       │──────────────────────│
│ id (UUID PK)     │◄──────│ userId (FK)           │
│ email (unique)   │       │ timezone              │
│ name             │       │ catchUpDepth (varchar)│
│ verificationCode │       │ preferences (JSONB)   │
│ validated        │       └──────────────────────┘
│ validationTimeout│
└────────┬─────────┘
         │
         │ userId (FK)
         ▼
┌──────────────────┐       ┌──────────────────────┐
│     sessions     │       │    listen_history     │
│──────────────────│       │──────────────────────│
│ id (UUID PK)     │◄──────│ sessionId (FK)        │
│ userId (FK)      │       │ userId (FK)           │
│ startedAt        │       │ contentType (varchar) │
│ endedAt          │       │ contentId (UUID)      │
│ catchUpDelivered │       │ listenedAt            │
└──────────────────┘       │ completedPercent      │
                           └──────────────────────┘

┌──────────────────┐       ┌──────────────────────┐
│ podcast_episodes │       │   podcast_topics      │
│──────────────────│       │──────────────────────│
│ id (UUID PK)     │◄──────│ episodeId (FK, null)  │
│ showName         │       │ id (UUID PK)          │
│ title            │       │ title                 │
│ description      │       │ summary               │
│ publishedAt      │       │ embedding (vec 1536)  │
│ sourceUrl        │       │ filename              │
│ audioFilename    │       │ startTime             │
│ duration         │       │ endTime               │
└──────────────────┘       └──────────────────────┘

┌──────────────────────┐
│  cached_responses    │
│──────────────────────│
│ id (UUID PK)         │
│ queryEmbedding (vec) │
│ responseText         │
│ audioFilename        │
│ sourceSummary        │
│ contentType (enum)   │
│ expiresAt            │
│ hitCount             │
└──────────────────────┘
```

### Tables

**`users`** — User accounts. Migrating from phone-based to email-based auth.

| Column                | Type         | Notes                                     |
| --------------------- | ------------ | ----------------------------------------- |
| id                    | UUID         | PK, auto-generated                        |
| email                 | varchar(255) | unique, not null — replaces `phoneNumber` |
| name                  | varchar(255) | collected during voice setup              |
| verificationCode      | varchar(6)   | magic code, nullable                      |
| validated             | boolean      | default false                             |
| validationTimeout     | timestamp    | code expiration                           |
| createdAt / updatedAt | timestamp    | auto-managed                              |

**`user_preferences`** — Personalization data that improves the experience over time. One row per user.

| Column                | Type        | Notes                                                                                                                                             |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                    | UUID        | PK                                                                                                                                                |
| userId                | UUID        | FK → users, unique                                                                                                                                |
| timezone              | varchar(50) | for "what happened today" relevance                                                                                                               |
| catchUpDepth          | varchar(20) | `brief` / `standard` / `detailed` — controls briefing length. Uses varchar rather than a Drizzle enum to avoid migrations when adding new values. |
| preferences           | JSONB       | evolving preferences (see below)                                                                                                                  |
| createdAt / updatedAt | timestamp   | auto-managed                                                                                                                                      |

The `preferences` JSONB column holds data we expect to evolve as we learn what matters:

- `followedShows` — array of show names the user follows (triggers "new episode" mentions in catch-up)
- `topicWeights` — map of topic → weight, learned from engagement (what they ask about, what they skip). Used to prioritize catch-up ordering
- `preferredVoice` — if we offer voice options in the future

Typed columns (`timezone`, `catchUpDepth`) are things that directly drive queries or pipeline config. JSONB holds everything else — we can promote fields to columns when they stabilize.

**`sessions`** — One row per app launch. Drives catch-up recency.

| Column           | Type      | Notes                                           |
| ---------------- | --------- | ----------------------------------------------- |
| id               | UUID      | PK                                              |
| userId           | UUID      | FK → users                                      |
| startedAt        | timestamp | when the session began                          |
| endedAt          | timestamp | nullable, set on disconnect                     |
| catchUpDelivered | boolean   | whether the catch-up completed for this session |

The most recent session's `startedAt` tells the CatchUpAgent how far back to look.

**`listen_history`** — What content a user has consumed. Prevents repeating stories in catch-up and powers "you already heard about this" awareness.

| Column           | Type        | Notes                                           |
| ---------------- | ----------- | ----------------------------------------------- |
| id               | UUID        | PK                                              |
| sessionId        | UUID        | FK → sessions                                   |
| userId           | UUID        | FK → users (denormalized for fast queries)      |
| contentType      | varchar(20) | `podcast_topic` / `cached_response` / `episode` |
| contentId        | UUID        | references the relevant table by type           |
| listenedAt       | timestamp   | when playback started                           |
| completedPercent | integer     | 0-100, how much was actually heard              |

`contentType` + `contentId` is a polymorphic reference. We don't use foreign keys here — the agent writes the content type and ID, and the query layer resolves it. This avoids coupling listen_history to every content table.

**`podcast_episodes`** — Full episode metadata. Parent of `podcast_topics`.

| Column                | Type         | Notes                              |
| --------------------- | ------------ | ---------------------------------- |
| id                    | UUID         | PK                                 |
| showName              | varchar(255) | e.g., "The Take", "Newsfeed"       |
| title                 | varchar(255) | episode title                      |
| description           | text         | episode description                |
| publishedAt           | timestamp    | original publish date              |
| sourceUrl             | varchar(500) | Omny Studio or original source URL |
| audioFilename         | varchar(255) | full episode audio file            |
| duration              | integer      | duration in seconds                |
| createdAt / updatedAt | timestamp    | auto-managed                       |

Enables queries like "play the latest episode of The Take" — `WHERE showName = 'The Take' ORDER BY publishedAt DESC LIMIT 1`.

**`podcast_topics`** — Existing table, enhanced. Individual topic segments within episodes.

| Column                | Type         | Notes                                                                      |
| --------------------- | ------------ | -------------------------------------------------------------------------- |
| id                    | UUID         | PK                                                                         |
| episodeId             | UUID         | FK → podcast_episodes, nullable (generated topics may not have an episode) |
| title                 | varchar(255) | topic title                                                                |
| summary               | text         | topic summary                                                              |
| embedding             | vector(1536) | HNSW indexed, cosine similarity                                            |
| filename              | varchar(255) | trimmed audio segment file                                                 |
| startTime             | integer      | start time in source episode (seconds)                                     |
| endTime               | integer      | end time in source episode (seconds)                                       |
| createdAt / updatedAt | timestamp    | auto-managed                                                               |

Added: `episodeId` (links segments to their parent episode), `startTime` / `endTime` (for seeking within episodes, already extracted by the importer but not stored).

**`cached_responses`** — The cache-and-reuse flywheel. Every generated audio response is stored here.

| Column                | Type         | Notes                                                                          |
| --------------------- | ------------ | ------------------------------------------------------------------------------ |
| id                    | UUID         | PK                                                                             |
| queryEmbedding        | vector(1536) | HNSW indexed — what the user asked                                             |
| responseText          | text         | the generated text (for display, re-generation)                                |
| audioFilename         | varchar(255) | recorded audio file                                                            |
| sourceSummary         | text         | brief note on what sources were used (for debugging, not RAG)                  |
| contentType           | varchar(20)  | `catch_up` / `answer` / `deep_dive`                                            |
| expiresAt             | timestamp    | staleness cutoff — breaking news expires fast, background content lives longer |
| hitCount              | integer      | default 0, incremented on cache hits — for analytics and eviction              |
| createdAt / updatedAt | timestamp    | auto-managed                                                                   |

Cache lookup: embed the user's query → vector similarity search against `queryEmbedding` → if similarity > threshold AND `expiresAt` > now → cache hit, stream `audioFilename`. Otherwise, generate fresh.

### Key Design Decisions

- **No local article storage.** Articles are fetched on-demand from Al Jazeera's GraphQL API and wire data from Cortex. If a search doesn't find relevant content, the agent goes broader rather than maintaining a local copy. This keeps the data model lean and avoids sync issues.
- **Polymorphic listen history.** `contentType` + `contentId` rather than separate FK columns per content type. Simpler to extend as new content types emerge.
- **JSONB for evolving preferences.** We don't know which preferences matter most yet. JSONB lets us iterate without migrations. Fields get promoted to typed columns once they stabilize and need to be queried directly.
- **Expiry-based cache invalidation.** Cached responses have an `expiresAt` set at generation time based on content type — breaking news gets short TTLs, historical context gets longer ones. No complex invalidation logic.

---

## Workflow Engine (`@ts-flow`)

Both the generator and importer use a JSON-defined workflow framework. Each workflow file declares:

- **Nodes** - Named processing steps with a type, configuration, and connections to other nodes
- **Node types** - Built-in (`HttpGetQueryEngine`, `OpenAIChatEngine`, `OpenAIWhisperEngine`, etc.) or custom (extend `NodeBase`, implement `IQueryEngine`)

Workflows are bootstrapped by `@ts-flow/core`, which loads the JSON definition and wires up node implementations at runtime. Custom nodes are registered via an `extensions` map when initializing the workflow.

**Data layer consolidation:** The generator and importer currently use `@ts-flow`'s built-in `PGInsertQueryEngine` to write directly to the database, bypassing `@alpha/data`. This creates schema drift risk — changes to the Drizzle schema don't automatically propagate to the workflow SQL. To fix this, we'll create custom `@ts-flow` nodes (implementing `IQueryEngine`) that wrap `@alpha/data` CRUD operations. The workflow JSON references the custom node type, and the node implementation calls the shared data layer. Schema changes propagate everywhere through Drizzle.

---

## Development Status

### Implemented (Prototype)

- Voice-guided signup flow (Socket.io + OpenAI Realtime API — to be replaced with LiveKit)
- Real-time bidirectional audio streaming (prototype architecture)
- Automated news-to-podcast generation (cron-based)
- Podcast import, transcription, topic extraction, and embedding
- JWT authentication with 30-day tokens
- PostgreSQL with pgvector for vector similarity search (HNSW index)
- ESLint + Prettier + lefthook git hooks + bun test runner

### To Be Built (Production Architecture)

- **LiveKit Agent server** — Multi-agent workflow with handoffs (SetupAgent → CatchUpAgent → BrowseAgent ⇄ PlaybackAgent)
- **LiveKit client integration** — Replace Socket.io with LiveKit React Native SDK + WebRTC
- **Cortex integration** — Custom pipeline node routing LLM calls through Cortex
- **Content resolution system** — Cache → clip → generate pipeline with embedding-based lookup
- **Catch-up assembly** — Personalized briefing from multiple content sources based on recency
- **Streaming generation with cache-and-reuse** — LLM → TTS → user with simultaneous recording and indexing
- **Email magic code auth** — Replace phone/SMS verification with email-based magic codes
- **Agent → client RPC** — Structured triggers for topic cards, podcast metadata, mode transitions
- **RAG search endpoint** — Vector similarity search against podcast topics and cached responses
- **Background audio** — WebRTC-based background session support
- **Lock screen controls** — OS media API integration

---

## Tech Stack

| Layer                | Technology                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| Runtime              | Bun                                                                      |
| Language             | TypeScript (strict mode)                                                 |
| Voice infrastructure | LiveKit Cloud (WebRTC media transport)                                   |
| Agent framework      | LiveKit Agents SDK (Node.js)                                             |
| STT                  | Deepgram Nova-3 (via LiveKit Inference)                                  |
| LLM                  | Multi-model via AJ Cortex (OpenAI, Gemini, Claude, Grok)                 |
| TTS                  | Cartesia Sonic-3 / OpenAI TTS (configurable per agent)                   |
| AI platform          | AJ Cortex (RAG, embeddings, wire data, journalism pathways)              |
| HTTP server          | Hono (auth endpoints, health checks)                                     |
| Mobile               | React Native + Expo + LiveKit React Native SDK                           |
| Database             | PostgreSQL + pgvector + Drizzle ORM                                      |
| Embeddings           | text-embedding-3-small via Cortex `embeddings` pathway (1536 dimensions) |
| Content workflows    | @ts-flow (JSON-defined node graphs) for generator + importer             |
| Audio processing     | ffmpeg (trim, resample)                                                  |
| Package management   | Bun workspaces                                                           |
| Code quality         | ESLint (typescript-eslint strict), Prettier, lefthook                    |

---

## Environment Variables

| Variable                     | Used By             | Description                               |
| ---------------------------- | ------------------- | ----------------------------------------- |
| `LIVEKIT_URL`                | server, client      | LiveKit Cloud project WebSocket URL       |
| `LIVEKIT_API_KEY`            | server              | LiveKit API key for authentication        |
| `LIVEKIT_API_SECRET`         | server              | LiveKit API secret for token generation   |
| `CORTEX_API_URL`             | server              | AJ Cortex GraphQL/REST endpoint           |
| `OPENAI_API_KEY`             | generator, importer | OpenAI API access (for content pipelines) |
| `DATABASE_URL`               | server, data        | PostgreSQL connection string              |
| `POSTGRES_CONNECTION_STRING` | generator, importer | PostgreSQL connection (for @ts-flow)      |
| `JWT_SECRET`                 | server              | Secret for signing auth tokens            |
| `PORT`                       | server              | HTTP server port (default: 8081)          |
| `OMNY_STUDIO_API_KEY`        | importer            | Omny Studio management API access         |
| `OMNY_STUDIO_ORG_ID`         | server              | Omny Studio org ID (for consumer API)     |
