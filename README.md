# Tulay Kanban

Real-time Kanban board built with FastAPI, PostgreSQL, Kafka, and a modular vanilla-JS frontend.

## What it does

- Multi-board Kanban with list and task drag/drop
- Live activity updates over WebSockets (Kafka-backed)
- Task details panel (description, priority, due date, assignee, labels)
- Comments + image attachments
- Light/Dark theme and responsive layout

## Current changes (2026-02-22)

- Frontend bootstrap was simplified: `frontend/app.js` now initializes and delegates to modular ES modules.
- Frontend orchestration was split into focused listener modules in `frontend/listeners/*`.
- Non-listener runtime handlers were extracted to `frontend/services/*` for board/task/modal/realtime/drag-drop flows.
- Backend monolith routing was decomposed into feature routers in `backend/routers/*`.
- Shared backend cross-cutting logic was isolated in `backend/core/*`.
- Board ordering now supports batched reorder via `POST /api/workspaces/{ws_id}/boards/reorder`.
- Modal UX flow was hardened: create/delete/edit modals now close reliably on outside click and support Enter-to-confirm in relevant inputs/buttons.

## Tech stack

- Frontend: Vanilla JavaScript ES modules + Tailwind CSS
- Backend: FastAPI + SQLAlchemy
- Data: PostgreSQL
- Streaming: Kafka
- Auth: JWT login (registration disabled)
- Runtime: Docker Compose (Kafka/Postgres) + local Python app server

## Quick start

### 1) Prerequisites

- Docker + Docker Compose
- Python 3.9+

### 2) Start infrastructure

```bash
docker compose up -d
```

Wait for Kafka/Postgres to be healthy before launching backend.

### 3) Install Python dependencies

```bash
pip install -r requirements.txt
```

Optional (Cloudflare R2 storage only):

```bash
pip install boto3
```

### 3.1) Configure environment (optional)

The app runs with defaults, but you can set optional environment variables:

- `STORAGE_BACKEND` (`local` or `r2`, default: `local`)
- `BASE_URL` (default: empty string; use `http://localhost:8000` for absolute upload URLs)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (required only for `STORAGE_BACKEND=r2`)

You can copy `.env.example` as reference, but note this project does **not** auto-load `.env` at runtime. Export variables in your shell (or Docker/host environment) before starting the app.

### 4) Run backend

```bash
python main.py
```

Open http://localhost:8000

## Troubleshooting startup (`python main.py` exits with code 1)

Most startup failures are one of these:

1. **PostgreSQL is not running on `localhost:5432`**
	- Start infra first: `docker compose up -d`
	- Verify container health/logs with `docker compose ps` and `docker compose logs db`

2. **Dependencies are missing**
	- Reinstall: `pip install -r requirements.txt`

3. **Kafka is unavailable**
	- Kafka connection failures are non-fatal in this project (it falls back to websocket-only broadcast), but ensure `kafka` container is up if you need Kafka-backed fan-out.

4. **Python version/runtime mismatch**
	- Use Python `3.9+`.

## Login

Use demo credentials (registration is disabled):

- Email: `test@example.com`
- Password: `password123`

If you are not authenticated, the app redirects to `/login`.

## Project layout

```text
tulay-kanban/
├── main.py                # Root launcher (imports backend.main)
├── backend/
│   ├── main.py            # Backend composition root
│   ├── core/
│   │   ├── auth.py
│   │   ├── deps.py
│   │   ├── realtime.py
│   │   └── setup.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── boards.py
│   │   ├── labels.py
│   │   ├── misc.py
│   │   ├── tasks.py
│   │   └── workspaces.py
│   └── storage.py
├── frontend/
│   ├── app.js             # Frontend bootstrap entrypoint
│   ├── dom-events.js      # Static DOM-only event hooks
│   ├── api.js             # Frontend HTTP/Kafka transport helpers
│   ├── state.js           # Frontend constants/shared primitives
│   ├── ui.js              # Frontend UI/format helpers
│   ├── events.js          # Frontend composition/orchestration root
│   ├── listeners/
│   │   ├── board.js
│   │   ├── task.js
│   │   ├── modal.js
│   │   └── dragdrop.js
│   ├── services/
│   │   ├── board-service.js
│   │   ├── task-service.js
│   │   ├── modal-service.js
│   │   ├── realtime-service.js
│   │   └── dragdrop-service.js
│   ├── index.html         # Main app shell
│   └── login.html         # Login page
├── scripts/
│   └── clean_db.py
├── clean_db.py            # Root launcher for scripts/clean_db.py
├── docker-compose.yml
├── requirements.txt
└── docs/
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Known Issues](docs/KNOWN_ISSUES.md)
- [Storage Architecture](docs/STORAGE_ARCHITECTURE.md)
- [Storage Migration](docs/STORAGE_MIGRATION.md)
- [Storage Quick Reference](docs/STORAGE_QUICK_REF.md)

For known technical debt and pending refactors, see [Known Issues](docs/KNOWN_ISSUES.md).

## License

MIT

