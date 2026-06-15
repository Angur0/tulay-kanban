# Project Overview

Tulay Kanban is a real-time Kanban task management app with workspace, board, list, task, label, member, search, and timeline views. The backend exposes a FastAPI API backed by PostgreSQL, while the frontend is a Svelte 5/Vite TypeScript app that consumes REST endpoints and WebSocket events.

# Tech Stack

- Python with FastAPI, Uvicorn, SQLAlchemy, Pydantic, and python-jose
- PostgreSQL 15 via Docker Compose
- Svelte 5, TypeScript, and Vite
- Tailwind CDN utility classes with custom shared CSS in `frontend/src/app.css`
- WebSockets for realtime board updates
- JWT bearer authentication with localStorage token storage
- Local filesystem uploads by default, with optional Cloudflare R2 support
- Frappe Gantt for timeline visualization

# Directory Structure

```text
tulay-kanban/
├── main.py
├── backend/
│   ├── main.py
│   ├── core/
│   │   ├── auth.py
│   │   ├── deps.py
│   │   ├── rbac.py
│   │   ├── realtime.py
│   │   └── setup.py
│   ├── routers/
│   │   ├── auth.py
│   │   ├── boards.py
│   │   ├── labels.py
│   │   ├── misc.py
│   │   ├── tasks.py
│   │   └── workspaces.py
│   ├── services/
│   │   └── gantt_image_service.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── storage.py
├── frontend/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── app.css
│   │   ├── main.ts
│   │   ├── routes/
│   │   └── lib/
│   │       ├── api/
│   │       ├── components/
│   │       ├── stores/
│   │       ├── api.ts
│   │       ├── constants.ts
│   │       └── types.ts
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── scripts/
├── docs/
├── docker-compose.yml
└── requirements.txt
```

# System Architecture

The root `main.py` launches `backend.main:app`. On startup, FastAPI creates database tables, runs lightweight schema/setup helpers, seeds initial data, initializes the configured upload storage backend, mounts uploaded/static assets, and wires feature routers.

Frontend routes are composed by `frontend/src/App.svelte`, which switches between the login page and authenticated app shell. `AppLayout.svelte` loads the current user, workspaces, boards, and board data into Svelte stores; child views such as `BoardView.svelte`, `GanttView.svelte`, and `MyTasksView.svelte` render store-backed UI and call typed API helpers under `frontend/src/lib/api/`.

Task, list, board, label, workspace, and auth changes flow through FastAPI routers, SQLAlchemy models, and Pydantic schemas. Realtime updates are broadcast through `backend/core/realtime.py` to connected clients on `/ws/{board_id}`, and the frontend reloads affected board data when relevant events arrive.

The authenticated UI uses a desktop sidebar layout at tablet/desktop widths and switches to an off-canvas mobile drawer below `768px`. Kanban columns remain horizontally scrollable with viewport-aware column widths, while header actions, filters, card controls, and the task panel use wrapped or touch-friendly layouts for narrow screens.

# Core Integrations

- PostgreSQL: primary relational database for users, workspaces, boards, columns, tasks, labels, comments, and activity.
- Docker Compose: local PostgreSQL orchestration.
- WebSockets: realtime client notifications for board/task/list changes.
- JWT auth: login-protected API access and current-user lookup.
- Upload storage: local `uploads/` directory by default, optional Cloudflare R2 via storage environment variables.
- Frappe Gantt: timeline/Gantt visualization in the frontend.
