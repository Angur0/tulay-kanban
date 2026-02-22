# Tulay Kanban Architecture

This document explains the full codebase structure, runtime flow, and major responsibilities.

## System Overview

Tulay Kanban is a FastAPI backend with a modular vanilla-JS frontend.

- HTTP API serves authentication, workspaces, boards, tasks, comments, labels, uploads, and health checks.
- WebSocket broadcasts real-time events to connected clients.
- Kafka is used when available for event distribution; backend falls back to direct websocket broadcast in offline mode.
- PostgreSQL stores application data via SQLAlchemy models.
- Image uploads use a pluggable storage backend (`local` by default, optional Cloudflare R2).

## Repository Layout

```text
tulay-kanban/
├── main.py                      # Root launcher (imports and runs backend.main:app)
├── backend/
│   ├── main.py                  # Composition root: app, lifespan, router wiring, static mounts
│   ├── database.py              # Engine/session config and DB dependency helpers
│   ├── models.py                # SQLAlchemy models and relationships
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── storage.py               # Storage abstraction + local/R2 implementations
│   ├── core/
│   │   ├── auth.py              # Password hashing + JWT token creation/verification config
│   │   ├── deps.py              # Shared FastAPI dependencies (current user, workspace access)
│   │   ├── realtime.py          # Kafka/WebSocket manager + publish/broadcast utilities
│   │   └── setup.py             # DB bootstrap helpers (column ensure + seed)
│   └── routers/
│       ├── auth.py              # /api/auth/*
│       ├── workspaces.py        # /api/workspaces/*
│       ├── boards.py            # board + column routes
│       ├── labels.py            # workspace/board label routes
│       ├── tasks.py             # task, comment, activity routes
│       └── misc.py              # upload, events, health, websocket, static file routes
├── frontend/
│   ├── app.js                   # Frontend bootstrap entrypoint
│   ├── api.js                   # HTTP helpers and API transport wrappers
│   ├── events.js                # Frontend composition/orchestration root
│   ├── dom-events.js            # Static DOM interactions
│   ├── listeners/
│   │   ├── board.js             # Board/navigation/action listeners
│   │   ├── task.js              # Task/panel/comment listeners
│   │   ├── modal.js             # Modal and modal-keyboard listeners
│   │   └── dragdrop.js          # Column/task drag-drop listener wiring
│   ├── services/
│   │   ├── board-service.js     # Board/workspace state handlers and CRUD flows
│   │   ├── task-service.js      # Task state handlers and CRUD flows
│   │   ├── modal-service.js     # Modal/list state handlers
│   │   ├── realtime-service.js  # WebSocket/Kafka runtime handlers
│   │   └── dragdrop-service.js  # Task/column drag-drop runtime handlers
│   ├── state.js                 # Shared frontend state/constants
│   ├── ui.js                    # UI rendering/format helpers
│   ├── index.html               # App shell
│   └── login.html               # Login page
├── scripts/
│   └── clean_db.py              # DB cleanup utility
├── clean_db.py                  # Root launcher for scripts/clean_db.py
├── docker-compose.yml           # PostgreSQL + Kafka/ZooKeeper infra
├── requirements.txt             # Python dependencies
└── docs/
```

## Backend Runtime Flow

### Startup

`backend/main.py` performs startup in this sequence:

1. Ensure DB tables exist (`models.Base.metadata.create_all`).
2. Run setup tasks (`ensure_board_icon_column`, `seed_db`).
3. Create FastAPI app with lifespan.
4. In lifespan startup:
   - Initialize storage backend (`backend.storage.get_storage_backend`).
   - Start Kafka producer.
   - Start Kafka consumer task for websocket fan-out.
5. Mount static directories (`/uploads`, `/static`) and include routers.

### Request Handling

- Routers in `backend/routers/*` define endpoints by domain.
- Shared auth/access checks come from `backend/core/deps.py`.
- DB session is injected through `backend.database.get_db`.
- Task/comment changes publish events via `backend.core.realtime.publish_or_broadcast`.

### Realtime Event Path

1. API operation creates/updates/deletes entities.
2. Router builds event payload.
3. `publish_or_broadcast` sends to Kafka when connected.
4. Kafka consumer (`consume_events`) re-broadcasts to active websocket clients.
5. If Kafka is unavailable, backend directly broadcasts over websocket.

## Data Model Summary

Core entities in `backend/models.py`:

- `User`: authentication identity.
- `Workspace`: top-level collaboration container.
- `Board`: belongs to workspace; contains columns and tasks.
- `BoardColumn`: ordered lane inside a board.
- `Task`: main work item, can include labels, assignee, due date, images.
- `Comment`: task discussion entries with optional images.
- `Label`: workspace-level or board-level labels.
- `Activity`: immutable timeline events for board activity feed.

## Frontend Interaction Model

- `frontend/app.js` bootstraps the app.
- `frontend/api.js` handles API calls and auth token usage.
- `frontend/events.js` coordinates runtime state and delegates listener wiring to `frontend/listeners/*`.
- `frontend/services/*` contains non-listener board/task/modal state handlers extracted from `frontend/events.js`.
- `frontend/services/realtime-service.js` and `frontend/services/dragdrop-service.js` isolate runtime transport and drag-drop behavior from `frontend/events.js`.
- `frontend/ui.js` renders views and UI helpers.
- WebSocket connection receives live events for near real-time UI updates.

## Infrastructure and External Services

- PostgreSQL: primary relational database.
- Kafka: event bus for realtime fan-out (optional at runtime).
- Local filesystem or Cloudflare R2: image storage backend.
- Docker Compose: local infrastructure orchestration.

## Configuration Notes

- Authentication uses JWT bearer tokens.
- Registration endpoint exists but is intentionally disabled.
- Demo seed user is created if absent (`test@example.com` / `password123`).
- Storage backend is selected by `STORAGE_BACKEND` environment variable.

## Known Architectural Boundaries

- `backend/main.py` is now a composition root, not a feature implementation file.
- API route logic is grouped by feature in `backend/routers/*`.
- Cross-cutting concerns (auth/deps/realtime/setup) live in `backend/core/*`.
- Storage is isolated behind an interface in `backend/storage.py`.

## Suggested Reading Order

1. `README.md` (project overview + quick start)
2. `docs/ARCHITECTURE.md` (this file)
3. `backend/main.py` (wiring and lifecycle)
4. `backend/routers/*` (API behavior)
5. `backend/models.py` + `backend/schemas.py` (data contracts)
6. `frontend/app.js` + `frontend/events.js` (UI runtime behavior)
