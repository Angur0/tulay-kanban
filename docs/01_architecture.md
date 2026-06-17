# Project Overview

Tulay Kanban is a real-time Kanban task management app with workspace, board, list, task, label, member, search, and timeline views. The backend exposes a FastAPI API backed by PostgreSQL, while the frontend is a Svelte 5/Vite TypeScript app that consumes REST endpoints and WebSocket events.

# Tech Stack

- Python with FastAPI, Uvicorn, SQLAlchemy, Pydantic, and python-jose
- PostgreSQL 15 via Docker Compose
- Svelte 5, TypeScript, and Vite
- Tailwind CSS via PostCSS with custom shared CSS in `frontend/src/app.css` (Fully bundled for offline access)
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

The application is deployed using Docker Compose with an embedded DNS container (dnsmasq) to provide native Tailscale split-DNS support.

- **Backend** (`tulay-backend`): Runs FastAPI on internal port 8000.
- **Frontend** (`tulay-frontend`): Runs an Nginx reverse proxy serving the built static assets and proxying `/api`, `/uploads`, and `/ws` to the backend. It listens on port 80 (or custom configured port).
- **DNS** (`tulay-dns`): Resolves `tulay-kanban.internal` to the host's Tailscale IP.
- **API URL**: `constants.ts` derives `API_URL` dynamically from the browser's own origin (`window.location.host`) so client API calls go back through the Nginx proxy.
- **Offline Capable**: The frontend builds all necessary fonts (`@fontsource/inter`), icons (`material-symbols`), and Tailwind CSS directly into the dist bundle, ensuring full functionality even in environments with no internet access.


# Image Uploads

Image paths are stored as relative paths (e.g. `/uploads/foo.jpg`) in the database. The `resolveImageUrl()` helper in `tasksApi.ts` prepends the correct `API_URL` at display time, ensuring images uploaded from any device load correctly on any other device on the network.

# Gantt Chart

The Gantt view (`GanttView.svelte`) uses Frappe Gantt in **read-only mode** (`readonly: true`). Dragging task bars to change dates is disabled. The view supports Day / Week / Month modes and an optional Compress View that collapses large empty date gaps. Task bars are dynamically color-coded based on their current column/list index (modulo 8, using classes `gantt-bar-color-0` through `7`) to match the list grouping. Unscheduled tasks (displaying default dates) are rendered at 50% opacity. The color-coding and view modes propagate to PNG/PDF exports generated via Playwright.

# Calendar View

The Calendar view (`CalendarView.svelte`) displays tasks on a calendar layout with three sub-views: Month, Week, and Day.
- **State Persistence:** The selected year, month, day, and active view mode are stored locally, surviving view switches during the session.
- **Responsiveness:** Grids adjust layout dynamically. On small screens, Month and Week views display portrait-orientation alerts prompting device rotation, while the Day view falls back to a compact, vertically stacked list of hourly task strips.
- **Integrations:** Supports desktop click-to-create inline task forms with pre-filled due dates, and dynamically filters displayed tasks using the board's active FilterBar selections (search text, labels, and priorities).

# Toast Notifications & Realtime Alerts

- **Toast System:** A central toast notification store (`stores/toast.ts`) handles success, warning, error, and info popups with a 2-second auto-dismiss. The `<ToastContainer />` is mounted globally in `AppLayout.svelte`.
- **User Action Feedback:** Triggered when the current user completes CRUD actions (creating/updating/deleting tasks, moving columns, and executing bulk list operations).
- **WebSocket Alerts:** Listens to the `/ws/{board_id}` WebSocket connection. When a `TASK_UPDATED` broadcast event indicates that the current user has been assigned to a task by another member, it generates a real-time toast alert.

# System Maintenance Mode

Tulay Kanban includes administrative maintenance mode configurations to lock out non-admin users during emergency operations or scheduled database windows.

- **Backend Enforcement**: Maintenance status is evaluated during authentication boundaries (`get_current_user` dependency) and user lifecycle gates (`/login`, `/register`). If the system settings indicate active manual maintenance or a current UTC timestamp falling within the scheduled maintenance window, non-admin users receive an `HTTP 503 Service Unavailable` response containing details about the maintenance state and estimated return time.
- **Frontend Interception**: The `authFetch` client globally intercepts `503` responses. If a maintenance payload is detected, it populates Svelte stores (`isMaintenanceMode` and `maintenanceEndTime`). This triggers the `MaintenanceOverlay.svelte` component to mount globally, locking out user interactions and providing a live, localized countdown timer of the remaining maintenance duration.
- **Admin Configuration**: Administrators manage the system settings via a dashboard card in the Admin Panel (`AdminView.svelte`), which triggers `GET` and `PUT` operations on `/api/admin/settings`. Pickers set local times, which the client converts to UTC ISO strings before storing them in the `SystemSettings` singleton DB table.

# Core Integrations

- PostgreSQL: primary relational database for users, workspaces, boards, columns, tasks, labels, comments, and activity.
- Docker Compose: local PostgreSQL orchestration.
- WebSockets: realtime client notifications for board/task/list changes.
- JWT auth: login-protected API access and current-user lookup.
- Upload storage: local `uploads/` directory by default, optional Cloudflare R2 via storage environment variables.
- Frappe Gantt: read-only timeline/Gantt visualization in the frontend.
- svelte-simple-calendar (or custom calendar rendering): custom month/week/day calendar grid logic.

