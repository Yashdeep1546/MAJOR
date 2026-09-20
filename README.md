# AETHER — Autonomous Agentic Task Management System

AETHER is an autonomous, AI-orchestrated task management platform built on a 4-stage state machine (`UNDERSTAND` → `PLAN` → `EXECUTE` → `CRITIQUE`), dual-model routing, and short-term session caching with multi-tier database fallback.

---

## Architecture Flow

```
┌───────────────────────────────────────────────────────────┐
│                    React 19 Frontend                      │
│     (/chat UI  •  /tasks Kanban  •  /trace/:id Viewer)    │
└─────────────────────────────┬─────────────────────────────┘
                              │ HTTP / REST (/api/chat, /api/tasks)
                              ▼
┌───────────────────────────────────────────────────────────┐
│                   Express 5 API Server                    │
└──────┬──────────────────────┬──────────────────────┬──────┘
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Redis Cache  │       │ Orchestrator │       │  PostgreSQL  │
│ (ioredis)    │       │ State Machine│       │ (Prisma ORM) │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │
       │ Context Cache Hit    │ Multi-Step Loop      │ Persistence:
       │ (TTL: 1 hour)        │ (Max 5 iterations)   │ • users
       │                      │                      │ • tasks
       │ Fallback to Postgres │                      │ • conversations
       │ if cache miss or down│                      │ • messages
       │                      ▼                      │ • agent_actions
       │         ┌───────────────────────────┐       │ • reminders
       │         │    Dual-Model Routing     │       │ • preferences
       │         ├───────────────────────────┤       └──────────────┘
       │         │ Fast Model (Gemini Flash) │
       │         │ • UNDERSTAND              │
       │         │ • CRITIQUE                │
       │         ├───────────────────────────┤
       │         │ Reasoning Model (Gemini)  │
       │         │ • PLAN (Function Calling) │
       │         │ • Global 12.5s Throttling │
       │         │ • Exponential Backoff     │
       │         └────────────┬──────────────┘
       │                      │
       │                      ▼
       │         ┌───────────────────────────┐
       │         │   Task Tool Registry      │
       │         │ • create_task             │
       │         │ • update_task             │
       │         │ • complete_task           │
       │         │ • list_tasks              │
       └─────────┴───────────────────────────┘
```

### Core Architecture Components

1. **Autonomous Re-planning Loop**: The orchestrator is not a naive linear chain; it executes within a guarded `while` loop (up to 5 iterations). If the model determines it needs information to execute an action (e.g., calling `list_tasks` to discover a task's database ID before marking it complete), it executes the query tool, injects the output into context, and loops autonomously back to `PLAN` without requiring user intervention.
2. **Dual-Model Routing**:
   - **Fast Model** (`gemini-3.1-flash-lite` / `gemini-2.0-flash`): Routes `UNDERSTAND` (intent extraction) and `CRITIQUE` (summarization and user response formatting) to minimize latency and token consumption.
   - **Reasoning Model** (`gemini-3.5-flash-lite` / `gemini-2.0-pro`): Routes `PLAN` for schema-strict function calling and multi-tool decision trees.
3. **Rate Limiting & Resiliency**: Built-in 12.5-second minimum interval gating (`MIN_INTERVAL_MS`) with exponential backoff and jitter (20s, 40s, 80s) to adhere strictly to free-tier API quotas and eliminate `429 Too Many Requests` crashes.
4. **Session Context Management**:
   - Short-term conversation memory is stored in **Redis** with a sliding 20-message window and a 3600-second (1 hour) TTL.
   - **Graceful Degradation**: If Redis is offline or unreachable, the server logs a warning and falls back immediately to Postgres queries without throwing or breaking `/api/chat`.

---

## Monorepo Layout

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI (lint → typecheck → test → build)
├── docker-compose.yml             # Postgres 16 (port 5433) & Redis 7 (port 6379)
├── eslint.config.mjs              # Minimal ESLint configuration
├── package.json                   # Monorepo root scripts & dev dependencies
├── pnpm-lock.yaml                 # Pnpm lockfile (v10)
├── pnpm-workspace.yaml            # Workspace package definitions & build permissions
└── packages/
    ├── shared/                    # @aether/shared
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── schemas/           # Task schemas & Gemini FunctionDeclaration generators
    │       └── types/             # Shared TypeScript types
    ├── server/                    # @aether/server
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── seed.ts                # Database seeder (default user & sample tasks)
    │   ├── prisma/
    │   │   ├── schema.prisma      # Models: User, Task, Conversation, Message, AgentAction, Reminder, Preference
    │   │   └── migrations/        # Applied SQL migration history
    │   ├── scripts/
    │   │   └── eval.ts            # 30-prompt Natural Language Evaluation Suite
    │   ├── tests/
    │   │   ├── unit/              # Vitest unit tests (task.service, engine state machine)
    │   │   └── integration/       # Real DB & API lifecycle integration tests
    │   └── src/
    │       ├── index.ts           # Express server bootstrap
    │       ├── config.ts          # Environment configuration loader
    │       ├── orchestrator/      # State machine engine, Gemini wrapper, tool registry
    │       ├── routes/            # /api/chat, /api/tasks, /api/audit
    │       └── services/          # Task service, audit service, Redis cache service
    └── web/                       # @aether/web
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts         # Vite configuration with API reverse proxy
        └── src/
            ├── App.tsx            # Main application layout & navigation
            ├── index.css          # Design system stylesheet (dark theme, glassmorphism)
            ├── components/        # Chat, TaskCard, TaskModal, TraceViewer, Toast
            ├── pages/             # ChatPage (/chat), TasksPage (/tasks), TracePage (/trace/:id)
            └── services/          # Frontend API client
```

---

## Evaluation Benchmark & Pass Rate

The system was evaluated against the Phase 1 Evaluation Suite ([`packages/server/scripts/eval.ts`](file:///c:/Users/ACER/Downloads/Major/project/packages/server/scripts/eval.ts)) consisting of 30 natural-language prompts testing intent recognition, autonomous multi-step execution, idempotency, conversational ambiguity, and contradictory input handling.

| Metric | Before Fixes | After Phase 1 Fixes |
|---|---|---|
| **Total Prompts** | 30 | 30 |
| **Passed** | 0 | **27** |
| **Failed** | 30 | **3** |
| **Pass Rate** | **0.0%** | **90.0%** |

### Breakdown of Test Results

- **Standard Requests (9/10 Passed)**: Successfully resolved task creations, status listings, priority updates, and multi-step completions via autonomous ID discovery.
- **Ambiguous & Conversational Queries (10/10 Passed)**: Correctly refrained from triggering inappropriate mutations on ambiguous prompts (e.g., "Add a task", "Change priority", "Make it done"), while mapping colloquial inspection queries (e.g., "List things", "What should I do today?") to `list_tasks`.
- **Duplicate & Idempotency Tests (5/5 Passed)**: Verified duplicate task prevention and idempotent execution across repetitive requests.
- **Contradictions & Edge Cases (3/5 Passed)**: Correctly synthesized self-correcting instructions (e.g., "Create a task to buy groceries, no wait, to buy milk") and handled greetings without invoking tools.

### Current Failing Edge Cases (3/30)

1. `Mark the report task as done` (Expected: `complete_task` | Result: `None`): When the specific task title is absent or ambiguous in the active list, the model occasionally halts in `UNDERSTAND` rather than chaining an exploratory search.
2. `Create a high priority task and then make it low priority` (Expected: `create_task` | Result: `None`): The self-contradiction heuristic in the reasoning prompt occasionally opts for clarifying dialogue rather than synthesizing the latter priority.
3. `Complete task ID 999999999999` (Expected: `complete_task` | Result: `None`): The model flagged the synthetic ID format as invalid during intent extraction rather than passing it to the tool execution failure handler.

---

## Setup Instructions

### Prerequisites

- **Node.js**: `v20.x` or higher
- **pnpm**: `v10.x`
- **Docker & Docker Compose**: For local PostgreSQL and Redis containers

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start PostgreSQL & Redis

AETHER uses Docker Compose to provision PostgreSQL 16 (bound to host port `5433` to prevent conflicts with standard local Postgres installations) and Redis 7 (port `6379`).

```bash
docker-compose up -d
```

Verify containers are running:
```bash
docker-compose ps
```

### 3. Configure Environment Variables

Copy the example configuration file to `.env`:

```bash
cp .env.example .env
```

Ensure `.env` contains:

```env
DATABASE_URL=postgresql://aether:aether@localhost:5433/aether
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=3001
```

### 4. Run Database Migrations & Seed

Apply the Prisma schema migrations and seed default data:

```bash
# Apply migrations to local Postgres
pnpm db:migrate

# Seed default user and sample tasks
pnpm db:seed
```

*(Optional: Launch Prisma Studio at `http://localhost:5555` using `pnpm --filter @aether/server db:studio`)*

### 5. Start Development Servers

Run both the Express backend (`http://localhost:3001`) and Vite frontend (`http://localhost:5173`) concurrently:

```bash
pnpm dev
```

Open your browser to `http://localhost:5173` to access the AETHER application.

---

## Testing & Quality Gates

The workspace includes comprehensive unit, integration, and type-safety suites:

```bash
# Run all Vitest unit and integration suites
pnpm test

# Run ESLint across all workspace packages
pnpm lint

# Run TypeScript typechecks without emit
pnpm typecheck

# Build all packages for production
pnpm build

# Execute the 30-prompt Natural Language Evaluation Suite
pnpm eval
```

### Continuous Integration (CI)

A GitHub Actions workflow is configured at [`.github/workflows/ci.yml`](file:///c:/Users/ACER/Downloads/Major/project/.github/workflows/ci.yml). On every push and pull request to `main`, it executes with fail-fast enforcement in strict sequence:

$$\text{Lint} \longrightarrow \text{Typecheck} \longrightarrow \text{Test} \longrightarrow \text{Build}$$

The CI runner spins up Dockerized PostgreSQL and Redis service containers with health checks to run the real-database integration tests automatically.

---

## Environment Variables Reference

| Variable | Type | Required | Default | Description |
|---|---|---|---|---|
| `DATABASE_URL` | String | **Yes** | — | PostgreSQL connection string (e.g. `postgresql://aether:aether@localhost:5433/aether`) |
| `GEMINI_API_KEY` | String | **Yes** | — | Google Gemini API key for dual-model orchestration |
| `REDIS_URL` | String | No | `redis://localhost:6379` | Redis connection URL for session caching |
| `PORT` | Number | No | `3001` | Port for the Express backend server |
| `GEMINI_MODEL_FAST` | String | No | `gemini-3.1-flash-lite` | Model identifier for `UNDERSTAND` and `CRITIQUE` states |
| `GEMINI_MODEL_REASONING` | String | No | `gemini-3.5-flash-lite` | Model identifier for `PLAN` function calling state |

---

## Phase 2 Roadmap

The following architectural components are implemented in the database schema and migrations, but are scheduled for end-to-end wiring in Phase 2:

1. **Reminders Subsystem**:
   - *Current State*: The `Reminder` model exists in `schema.prisma` (`id`, `taskId`, `fireAt`, `status: PENDING|SENT|FAILED|CANCELLED`), with database foreign key relations and applied migrations.
   - *Phase 2 Work*: Register `create_reminder` and `cancel_reminder` tools in the orchestrator registry; implement a background cron worker or queue for notification firing; surface reminder badges and alerts in the `/tasks` UI.

2. **User Preferences**:
   - *Current State*: The `Preference` model exists in `schema.prisma` (`userId`, `timezone`, `notificationsEnabled`), migrated and linked to `User`.
   - *Phase 2 Work*: Inject user preferences into the orchestrator system prompt (e.g., respecting user timezone during relative date parsing like "tomorrow morning"); build a `/settings` view in the frontend.

3. **Streaming & WebSockets**:
   - *Current State*: Responses are returned via standard HTTP JSON once the orchestrator loop completes.
   - *Phase 2 Work*: Implement Server-Sent Events (SSE) or WebSockets to stream intermediate state machine transitions (`UNDERSTAND` → `PLAN` → `EXECUTE` → `CRITIQUE`) directly to the UI in real time.

4. **Long-Term Vector Memory**:
   - *Current State*: Bounded to the last 20 messages in Redis short-term cache and relational history in Postgres.
   - *Phase 2 Work*: Integrate vector embeddings (e.g., pgvector) for semantic retrieval of tasks and notes across distant historical conversations.
