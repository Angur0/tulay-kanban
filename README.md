# Tulay Kanban

Tulay Kanban is a real-time Kanban task management app for workspaces, boards, lists, tasks, labels, comments, attachments, and timeline planning. It uses a FastAPI backend with PostgreSQL and a Svelte 5/Vite frontend that talks to the API over REST and receives live board updates over WebSockets.

## Features

- Multi-workspace, multi-board Kanban workflow
- Role-based board access for owners, moderators, members, and viewers
- Drag-and-drop ordering for columns and tasks
- Mobile-responsive app shell with an off-canvas navigation drawer
- Board, My Tasks, and Gantt/timeline views
- Task detail panel with priority, dates, assignee, labels, comments, subtasks, and images
- Search, filters, board/list/task management modals, and account settings
- Live updates via WebSockets
- Image uploads with local storage by default and optional Cloudflare R2 support
- Gantt image/PDF export and board CSV export
- Light/dark theme

## Tech Stack

- Backend: Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic
- Frontend: Svelte 5, TypeScript, Vite
- Styling: Tailwind CDN utilities plus `frontend/src/app.css`
- Database: PostgreSQL 15 via Docker Compose
- Realtime: WebSockets
- Auth: JWT bearer tokens stored client-side
- Storage: local `uploads/` directory or optional Cloudflare R2
- Timeline: Frappe Gantt

## Prerequisites

- Python 3.9+
- Docker and Docker Compose
- Node.js 18+
- npm

## Quick Start

Run the database:

```bash
docker compose up -d
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Start the backend API:

```bash
python main.py
```

In another terminal, install frontend dependencies and start Vite:

```bash
cd frontend
npm install
npm run dev
```

Open the app:

- Frontend: `http://localhost:5173`
- Login route: `http://localhost:5173/login`
- Backend API: `http://localhost:8000`
- Health check: `http://localhost:8000/api/health`

The frontend currently calls `http://localhost:8000` directly via `frontend/src/lib/constants.ts`.

## Demo Login

- Email: `test@example.com`
- Password: `password123`

The backend seed setup creates the demo user if it is missing. Registration UI exists, but backend registration is intentionally disabled.

## Common Commands

Backend:

```bash
python main.py
python clean_db.py
python scripts/clean_db.py
```

Frontend:

```bash
cd frontend
npm run dev
npm run check
npm run build
npm run preview
```

Infrastructure:

```bash
docker compose up -d
docker compose ps
docker compose down
```

## Production Build Notes

Build the frontend before relying on FastAPI static serving:

```bash
cd frontend
npm run build
cd ..
python main.py
```

FastAPI mounts `frontend/dist` assets and serves the built root page at `/`. During development, prefer the Vite dev server at `http://localhost:5173` for client-side routing and hot reload.

## Environment Variables

- `STORAGE_BACKEND`: `local` by default; set to `r2` for Cloudflare R2.
- `BASE_URL`: base URL for absolute local file URLs, for example `http://localhost:8000`.
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID.
- `R2_ACCESS_KEY_ID`: Cloudflare R2 access key.
- `R2_SECRET_ACCESS_KEY`: Cloudflare R2 secret key.
- `R2_BUCKET_NAME`: Cloudflare R2 bucket.
- `R2_PUBLIC_URL`: public R2 bucket/base URL.

Notes:

- The app does not automatically load `.env`; export variables in your shell/runtime environment.
- `boto3` is optional and only needed when enabling R2 storage.
- The database URL is currently hardcoded in `backend/database.py` as `postgresql://user:password@localhost:5432/kanban`.

## Project Layout

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

## Documentation

Canonical project docs:

- [Architecture](docs/01_architecture.md)
- [Planned Changes](docs/02_planned_changes.md)
- [Done Changes](docs/03_done_changes.md)
- [Issues](docs/04_issues.md)

Additional reference docs:

- [Storage Architecture](docs/STORAGE_ARCHITECTURE.md)
- [Storage Migration](docs/STORAGE_MIGRATION.md)
- [Storage Quick Reference](docs/STORAGE_QUICK_REF.md)
- [Gantt Chart Plan](docs/GANTT_CHART_PLAN.md)
- [Legacy Architecture Notes](docs/ARCHITECTURE.md)
- [Legacy Known Issues](docs/KNOWN_ISSUES.md)

## Troubleshooting

- PostgreSQL connection fails: run `docker compose up -d` and confirm `docker compose ps` shows the `db` service.
- Backend imports fail: re-run `pip install -r requirements.txt`.
- Frontend packages are missing: run `npm install` inside `frontend/`.
- Frontend cannot reach the API: confirm `python main.py` is running on `http://localhost:8000`.
- Uploads fail: check storage environment variables and backend startup logs.
- Gantt export fails: ensure Playwright and its browser dependencies are installed in the runtime environment.

## Verification Status

Current frontend checks used during recent UI work:

```bash
cd frontend
npm run check
npm run build
```

`svelte-check` currently passes with zero errors, though the project still has existing accessibility warnings to clean up.

## License

MIT
