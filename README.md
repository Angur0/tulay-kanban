# Tulay Kanban

Tulay Kanban is a real-time Kanban task management app for workspaces, boards, lists, tasks, labels, comments, attachments, and timeline planning. It uses a FastAPI backend with PostgreSQL and a Svelte 5/Vite frontend that talks to the API over REST and receives live board updates over WebSockets.

## Features

- Multi-workspace, multi-board Kanban workflow
- Role-based board access for owners, editors, moderators, members, and viewers
- Dedicated Single Admin Account and User Management Panel
- System Maintenance Mode (Emergency lockout and scheduled maintenance windows with real-time countdown overlays)
- Drag-and-drop ordering for columns and tasks
- Mobile-responsive app shell with an off-canvas navigation drawer
- Board, My Tasks, Gantt/timeline, and Calendar views
- Task detail panel with priority, dates, assignee, labels, comments, subtasks, and images
- Search (with multi-label filter chips), board filters, board/list/task modals, and account settings
- Live updates via WebSockets with real-time assignment notifications
- Toast notification system for user actions (task CRUD, drag-and-drop, and bulk changes)
- Smart column/list archive-first deletion with warning suppression (per-browser settings)
- Orphaned tasks indicators for users that have been deleted or suspended
- Image uploads with local storage by default and optional Cloudflare R2 support
- Gantt timeline color-coding by column with export styling support
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

## Running the Application (Local Deployment with Docker)

Tulay Kanban is fully containerized with Docker, making it simple to deploy locally across Windows and Linux. The deployment features automatic Tailscale split-DNS, meaning it is accessible natively via `http://tulay-kanban.internal` on any device on your Tailnet.

### Prerequisites

1. Docker and Docker Compose installed.
2. Tailscale running on the host and client devices.
3. If running on **Windows**, you must free port 53 so the DNS container can bind to it. Run this in an Administrator PowerShell:
   ```powershell
   Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters" -Name EnableGlobalQueryBlockList -Value 0
   Stop-Service Dnscache -Force; Start-Service Dnscache
   ```

### 1. Setup Environment

Copy `.env.example` to `.env` and configure:
- `HOST_TAILSCALE_IP`: Set this to your host machine's Tailscale IPv4 address (find it by running `tailscale ip -4`).
- `HOST_HTTP_PORT`: Keep as `80`. *(If port 80 is occupied on your host, you must either stop the conflicting service, or change this port to `8080`)*.
- Update the `POSTGRES_*` credentials and `SECRET_KEY` if desired.

### 2. Start Containers

Build and start the application stack (Postgres, Backend, Frontend, and DNS):
```bash
docker compose up -d --build
```

### 3. Configure Tailscale Split-DNS (One-Time Setup)

1. Open your **[Tailscale Admin Console -> DNS](https://login.tailscale.com/admin/dns)**.
2. Under **Nameservers** click **Add nameserver** -> **Custom**.
3. Set the IP address to your host machine's Tailscale IP (the same one you put in `.env`).
4. Select **Restrict to domain** and enter `internal`.
5. Save the configuration.

### Accessing the App

Once deployed and configured, simply open a browser on any Tailscale-connected device:

- **App URL:** `http://tulay-kanban.internal` (or `http://tulay-kanban.internal:8080` if you changed the port).

---

## Demo Login

- Email: `admin@tulay.local`
- Password: `admin1234`

The backend seed setup creates the default admin user if it is missing. Registration UI exists, but backend registration is intentionally disabled. On first login, you will be prompted to change this default password.

## Development Commands

If you are modifying the codebase and need to test things manually:

Infrastructure:
```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

Frontend (requires Node 20+):
```bash
cd frontend
npm run dev
npm run check
npm run build
```

## Environment Variables

Your `.env` file controls the Docker deployment. Key variables:

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB`: Database credentials.
- `SECRET_KEY`: Used to securely sign JWT tokens.
- `HOST_TAILSCALE_IP`: Used by the DNS container to route `.internal` traffic.
- `HOST_HTTP_PORT`: Exposed HTTP port on the host machine.
- `STORAGE_BACKEND`: `local` by default; set to `r2` for Cloudflare R2.
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL`: Cloudflare R2 settings.

Notes:
- The `.env` file is automatically parsed by Docker Compose. The `DATABASE_URL` is dynamically generated and passed to the backend container.

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
│   │   ├── admin.py
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
- [Task UX Improvements Plan](docs/05_task_ux_improvements_plan.md)


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
