# Tulay Kanban

Real-time Kanban board built with FastAPI, PostgreSQL, Kafka, and a modular TypeScript frontend.

## Features

- Multi-workspace, multi-board Kanban flow
- Drag-and-drop for columns and tasks
- Live updates via WebSockets (Kafka-backed when available)
- Task detail panel (description, priority, due date, assignee, labels, comments)
- Image attachment upload support
- Light/Dark theme

## Tech Stack

- Backend: FastAPI + SQLAlchemy
- Frontend: TypeScript + Vite + modular browser code
- Data: PostgreSQL
- Event streaming: Kafka (graceful offline fallback)
- Auth: JWT login (registration disabled)

## Prerequisites

- Python 3.9+
- Docker + Docker Compose
- Node.js 18+ (only needed for Vite frontend development)

## Quick Start (Backend-served UI)

1) Start infrastructure:

```bash
docker compose up -d
```

2) Install Python dependencies:

```bash
pip install -r requirements.txt
```

3) Run the app:

```bash
python main.py
```

4) Open:

- App: http://localhost:5173
- Login: http://localhost:5173/login.html

## Frontend Dev Mode (Optional)

Use this if you want HMR and local frontend iteration.

1) Keep backend running at `http://localhost:8000`
2) In `frontend/`:

```bash
npm install
npm run dev
```

3) Open Vite dev server: http://localhost:5173

`vite.config.ts` proxies `/api`, `/ws`, and `/uploads` to the backend.

## Environment Variables (Optional)

- `STORAGE_BACKEND`: `local` (default) or `r2`
- `BASE_URL`: for absolute file URLs (example: `http://localhost:8000`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`: required only when `STORAGE_BACKEND=r2`

Notes:

- The app does not auto-load `.env`; export variables in your shell/runtime environment.
- `boto3` is only required for R2 storage.

## Demo Login

- Email: `test@example.com`
- Password: `password123`

## Troubleshooting

- PostgreSQL unavailable on `localhost:5432`: run `docker compose up -d` and check `docker compose ps`
- Missing Python packages: re-run `pip install -r requirements.txt`
- Kafka unavailable: app still runs and falls back to direct WebSocket broadcast

## Project Layout

```text
tulay-kanban/
├── main.py
├── backend/
│   ├── main.py
│   ├── core/
│   ├── routers/
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── storage.py
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       ├── events.ts
│       ├── api.ts
│       ├── state.ts
│       ├── ui.ts
│       ├── dom-events.ts
│       ├── listeners/
│       └── services/
├── scripts/
├── docs/
├── docker-compose.yml
└── requirements.txt
```

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Known Issues](docs/KNOWN_ISSUES.md)
- [Storage Architecture](docs/STORAGE_ARCHITECTURE.md)
- [Storage Migration](docs/STORAGE_MIGRATION.md)
- [Storage Quick Reference](docs/STORAGE_QUICK_REF.md)

## License

MIT

