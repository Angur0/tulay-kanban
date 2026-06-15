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
- Frappe Gantt for read-only timeline visualization

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
│   └── legacy/   ← older standalone docs archived here
├── docker-compose.yml
└── requirements.txt
```

# System Architecture

The root `main.py` launches `backend.main:app`. On startup, FastAPI creates database tables, runs lightweight schema/setup helpers, seeds initial data, initializes the configured upload storage backend, mounts uploaded/static assets, and wires feature routers.

Frontend routes are composed by `frontend/src/App.svelte`, which switches between the login page and authenticated app shell. `AppLayout.svelte` loads the current user, workspaces, boards, and board data into Svelte stores; child views such as `BoardView.svelte`, `GanttView.svelte`, and `MyTasksView.svelte` render store-backed UI and call typed API helpers under `frontend/src/lib/api/`.

Task, list, board, label, workspace, and auth changes flow through FastAPI routers, SQLAlchemy models, and Pydantic schemas. Realtime updates are broadcast through `backend/core/realtime.py` to connected clients on `/ws/{board_id}`, and the frontend reloads affected board data when relevant events arrive.

The authenticated UI uses a desktop sidebar layout at tablet/desktop widths and switches to an off-canvas mobile drawer below `768px`. Kanban columns remain horizontally scrollable with viewport-aware column widths, while header actions, filters, card controls, and the task panel use wrapped or touch-friendly layouts for narrow screens.

# Network / LAN Access

The app is designed to be accessible to devices on the same local network (including Tailscale VPN).

- **Backend** (`uvicorn`): Bound to `0.0.0.0:8000` locally. It is proxied by the frontend dev server, so clients never access port 8000 directly.
- **Frontend** (`vite dev`): Bound to `0.0.0.0` via `server.host` in `vite.config.ts`, acting as the single-port network gateway (port 5173). It proxies `/api`, `/uploads`, and WebSocket `/ws` traffic to the backend.
- **API URL**: `constants.ts` derives `API_URL` dynamically from the browser's own origin (`window.location.host`) so client API calls go back through the Vite dev server proxy.
- **CORS**: `backend/main.py` is configured with wildcard CORS / private range allowed regexes, though same-origin proxying on 5173 bypasses standard CORS blockages entirely.
- **Firewall**: Launch scripts (`scripts/launch_arch_linux.sh` / `scripts/launch_windows.bat`) automatically open port 5173 in the system firewall (UFW or Windows Defender Firewall) on startup, and clean up the rule upon script termination.


# Image Uploads

Image paths are stored as relative paths (e.g. `/uploads/foo.jpg`) in the database. The `resolveImageUrl()` helper in `tasksApi.ts` prepends the correct `API_URL` at display time, ensuring images uploaded from any device load correctly on any other device on the network.

# Gantt Chart

The Gantt view (`GanttView.svelte`) uses Frappe Gantt in **read-only mode** (`readonly: true`). Dragging task bars to change dates is disabled for all roles. Dates are edited via the task modal. Clicking a bar opens the task modal. The view supports Day / Week / Month modes and an optional Compress View that collapses large empty date gaps.

# Core Integrations

- PostgreSQL: primary relational database for users, workspaces, boards, columns, tasks, labels, comments, and activity.
- Docker Compose: local PostgreSQL orchestration.
- WebSockets: realtime client notifications for board/task/list changes.
- JWT auth: login-protected API access and current-user lookup.
- Upload storage: local `uploads/` directory by default, optional Cloudflare R2 via storage environment variables.
- Frappe Gantt: read-only timeline/Gantt visualization in the frontend.
