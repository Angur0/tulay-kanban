# Done Changes

### 2026-06-15

**Added:**
- Initialized the canonical documentation system with architecture, planned changes, changelog, and issue-tracking files.
- Added a mobile responsiveness roadmap covering app shell, header, Kanban board, touch interactions, Gantt view, modals, and responsive QA breakpoints.
- Configured Vite server to bind to `0.0.0.0` in `vite.config.ts` so the frontend dev server is reachable on the local network/VPN interfaces.
- Added firewall management in `scripts/launch_arch_linux.sh` to temporarily open/close port 8000 via UFW during runtime.

**Changed:**
- Updated the Svelte app shell with a mobile off-canvas sidebar, mobile menu trigger, responsive header controls, and small-screen modal/task panel behavior.
- Made the Kanban board viewport and columns responsive while preserving horizontal swipe/scroll interactions on mobile.
- Improved touch accessibility for task-card actions, column controls, filter controls, My Tasks spacing, and responsive dropdown positioning.
- Documented the responsive layout rules in the architecture doc and migrated completed responsive tasks out of planned changes.
- Rewrote the README to match the current FastAPI, PostgreSQL, Svelte 5, Vite, WebSocket, mobile-responsive, and canonical-docs state of the codebase.
- Added an Arch Linux launch script that starts the backend and frontend together from the repository root.
- Updated the launch script to source `venv/bin/activate` before starting the backend.
- Made `API_URL` dynamic using `window.location.hostname` so any local network client hits the correct server IP.
- Refactored `uploadImage` to return and store raw relative paths (`/uploads/file.jpg`) rather than host-prefixed absolute URLs, ensuring uploads work across devices.
- Relocated the Kanban "Add Card" button inside the scrollable column task area to prevent it from disappearing off-screen on smaller viewports.
- Configured the Gantt Chart (`GanttView.svelte`) to be read-only (`readonly: true`) and disabled drag-to-reschedule functionality for all roles.
- Moved older unstructured documentation files (`ARCHITECTURE.md`, `GANTT_CHART_PLAN.md`, etc.) to a new `docs/legacy/` archive.

**Fixed:**
- Fixed TypeScript safety issues in the account settings update flow, task lightbox event handling, and Gantt export/header helpers that blocked `svelte-check`.
- Fixed CORS NetworkError when connecting from Tailscale IPs by adding the `100.64.0.0/10` block to the backend allowed origins regex.

**Removed:**
- Removed the "Drag bars to reschedule" hint from the Gantt chart legend since the interface is now read-only.
