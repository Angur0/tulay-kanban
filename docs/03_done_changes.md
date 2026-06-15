# Done Changes

### 2026-06-15

**Added:**
- Initialized the canonical documentation system with architecture, planned changes, changelog, and issue-tracking files.
- Added a mobile responsiveness roadmap covering app shell, header, Kanban board, touch interactions, Gantt view, modals, and responsive QA breakpoints.

**Changed:**
- Updated the Svelte app shell with a mobile off-canvas sidebar, mobile menu trigger, responsive header controls, and small-screen modal/task panel behavior.
- Made the Kanban board viewport and columns responsive while preserving horizontal swipe/scroll interactions on mobile.
- Improved touch accessibility for task-card actions, column controls, filter controls, My Tasks spacing, and responsive dropdown positioning.
- Documented the responsive layout rules in the architecture doc and migrated completed responsive tasks out of planned changes.
- Rewrote the README to match the current FastAPI, PostgreSQL, Svelte 5, Vite, WebSocket, mobile-responsive, and canonical-docs state of the codebase.
- Added an Arch Linux launch script that starts the backend and frontend together from the repository root.
- Updated the launch script to source `venv/bin/activate` before starting the backend.

**Fixed:**
- Fixed TypeScript safety issues in the account settings update flow, task lightbox event handling, and Gantt export/header helpers that blocked `svelte-check`.

**Removed:**
- None.
