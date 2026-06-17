# Done Changes

### 2026-06-17

**Added:**
- Implemented Toast notification system with auto-dismiss (2s), colored left-border, and stack layout.
- Added `stores/toast.ts` with `toastSuccess`, `toastError`, `toastInfo`, `toastWarning` helpers.
- Mounted `ToastContainer.svelte` in AppLayout and wired toasts to all task actions: create, update, move, delete/archive, and bulk list operations.
- Added WebSocket assignment notifications: when another user assigns a task to you, a toast is shown with the task title.
- Backend already sends `taskTitle` and `assignee_id` in TASK_CREATED/TASK_UPDATED broadcast events.
- Implemented a complete, responsive Calendar View (`CalendarView.svelte`) with Month, Week, and Day views.
- Added persistent calendar state (selected month, year, day, view mode) that survives view switches until page reload.
- Integrated fully responsive layouts: portrait orientation rotation prompts for Month/Week grids, and compact horizontal task strips for Day view on mobile.
- Supported desktop click-to-create inline task forms with pre-filled due dates.
- Bound task display directly to active Board filter states (priority, label selections, and text searches).
- Implemented optional List parameters (Hidden and Archive). Created default Archive column per board, limited to one.
- Added List Settings modal with toggle settings for is_hidden and is_archive, and customized column headers to display status badges.
- Implemented global Show Hidden Lists filter option in FilterBar.svelte and filtered lists in BoardView.svelte.
- Created bulk list actions for tasks: bulk move to another list, bulk delete (archiving tasks if Archive list exists), and bulk creation.
- Removed line-through and opacity styles on completed main tasks.

### 2026-06-15

**Added:**
- Initialized the canonical documentation system with architecture, planned changes, changelog, and issue-tracking files.
- Added a mobile responsiveness roadmap covering app shell, header, Kanban board, touch interactions, Gantt view, modals, and responsive QA breakpoints.
- Configured Vite server to bind to `0.0.0.0` in `vite.config.ts` so the frontend dev server is reachable on the local network/VPN interfaces.
- Added a reverse proxy configuration to Vite's dev server (`vite.config.ts`) to forward API, uploads, and WebSocket traffic to the backend, enabling a single-port entry point for clients (port 5173).
- Added firewall management in `scripts/launch_arch_linux.sh` to temporarily open/close port 5173 via UFW during runtime.
- Added a Windows launch script `scripts/launch_windows.bat` that automates backend/frontend startup and manages Windows Firewall rules for port 5173 on startup and shutdown.
- Updated python virtual environment creation and activation steps in README for both Linux and Windows.

**Changed:**
- Updated the Svelte app shell with a mobile off-canvas sidebar, mobile menu trigger, responsive header controls, and small-screen modal/task panel behavior.
- Made the Kanban board viewport and columns responsive while preserving horizontal swipe/scroll interactions on mobile.
- Improved touch accessibility for task-card actions, column controls, filter controls, My Tasks spacing, and responsive dropdown positioning.
- Documented the responsive layout rules in the architecture doc and migrated completed responsive tasks out of planned changes.
- Rewrote the README to match the current FastAPI, PostgreSQL, Svelte 5, Vite, WebSocket, mobile-responsive, and canonical-docs state of the codebase.
- Added an Arch Linux launch script that starts the backend and frontend together from the repository root.
- Updated the launch script to source `venv/bin/activate` before starting the backend.
- Made `API_URL` dynamic using `window.location.host` so that all backend calls go through Vite's dev server proxy.
- Refactored `uploadImage` to return and store raw relative paths (`/uploads/file.jpg`) rather than host-prefixed absolute URLs, ensuring uploads work across devices.
- Relocated the Kanban "Add Card" button inside the scrollable column task area to prevent it from disappearing off-screen on smaller viewports.
- Configured the Gantt Chart (`GanttView.svelte`) to be read-only (`readonly: true`) and disabled drag-to-reschedule functionality for all roles.
- Moved older unstructured documentation files (`ARCHITECTURE.md`, `GANTT_CHART_PLAN.md`, etc.) to a new `docs/legacy/` archive.

**Fixed:**
- Fixed TypeScript safety issues in the account settings update flow, task lightbox event handling, and Gantt export/header helpers that blocked `svelte-check`.
- Fixed CORS NetworkError when connecting from Tailscale IPs by adding the `100.64.0.0/10` block to the backend allowed origins regex.

**Removed:**
- Removed the "Drag bars to reschedule" hint from the Gantt chart legend since the interface is now read-only.
