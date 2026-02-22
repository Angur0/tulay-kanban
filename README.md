# Tulay Kanban

Real-time Kanban board built with FastAPI, PostgreSQL, Kafka, and a modular vanilla-JS frontend.

## What it does

- Multi-board Kanban with list and task drag/drop
- Live activity updates over WebSockets (Kafka-backed)
- Task details panel (description, priority, due date, assignee, labels)
- Comments + image attachments
- Light/Dark theme and responsive layout

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

### 4) Run backend

```bash
python main.py
```

Open http://localhost:8000

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
│   ├── main.py
│   ├── auth.py
│   ├── database.py
│   ├── models.py
│   └── storage.py
├── frontend/
│   ├── app.js             # Frontend bootstrap entrypoint
│   ├── events.js          # Main app orchestration + event wiring
│   ├── dom-events.js      # Static DOM-only event hooks
│   ├── api.js             # Frontend HTTP/Kafka transport helpers
│   ├── state.js           # Frontend constants/shared primitives
│   ├── ui.js              # Frontend UI/format helpers
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

- [Known Issues](docs/KNOWN_ISSUES.md)
- [Storage Architecture](docs/STORAGE_ARCHITECTURE.md)
- [Storage Migration](docs/STORAGE_MIGRATION.md)
- [Storage Quick Reference](docs/STORAGE_QUICK_REF.md)

## License

MIT

