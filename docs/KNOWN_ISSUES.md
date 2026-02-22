# Known Issues & Technical Debt

This document tracks remaining issues, active refactors, and recently completed architecture work.

## Open Issues

### Backend & API
- **Column reorder batching**: Board reordering is batched via `POST /api/workspaces/{ws_id}/boards/reorder`, but column reordering still uses multiple `PUT /api/columns/{id}` calls. Add a batched column reorder endpoint.
- **Server-side task filtering/grouping**: `loadMyTasks` still groups tasks on the client. Move grouping/filtering to API query params (for example `?assignee=me&group_by=status`).

### Frontend & UI Safety
- **Legacy client ID generation fallback**: A `Date.now()`-based task ID fallback still exists in frontend runtime and should be removed in favor of backend-generated UUIDs only.
- **Template bloat in JS**: Large HTML strings are still hardcoded in orchestration/rendering paths. Migrate to HTML `<template>` tags or a lightweight component approach.
- **Manual escaping dependency**: Widespread `innerHTML` rendering still depends on `escapeHtml`. Prefer DOM-first rendering with `.textContent` (or Sanitizer API where appropriate).

### Performance
- **Layout thrashing risk**: Sidebar overflow handling still relies on manual offset-style calculations; replace with CSS-first layout (including Container Queries where suitable).
- **Date formatting consistency**: Replace custom date formatting logic with `Intl.DateTimeFormat` for performance and localization.

## In Progress / Partially Resolved

- **Global namespace cleanup (2026-02-22)**: `tasks` and `boards` were moved to module scope, reducing `window` pollution. Remaining work is to reduce manual HTML escaping/rendering patterns.
- **ID ownership (2026-02-22)**: Persisted records now rely on backend/database UUID defaults, but legacy frontend fallback generation remains to be removed.

## Resolved (2026-02-22)

- Frontend bootstrap was modularized: `frontend/app.js` now acts as entrypoint with logic split into `frontend/api.js`, `frontend/state.js`, `frontend/ui.js`, and `frontend/events.js`.
- Backend monolith routing was decomposed from `backend/main.py` into feature routers under `backend/routers/*` and shared modules in `backend/core/*`, with `backend/main.py` as composition root.
- Frontend listener orchestration was split from `frontend/events.js` into focused listener modules: `frontend/listeners/board.js`, `frontend/listeners/task.js`, `frontend/listeners/modal.js`, and `frontend/listeners/dragdrop.js`.
- Non-listener board/task/modal handlers were extracted into service modules: `frontend/services/board-service.js`, `frontend/services/task-service.js`, and `frontend/services/modal-service.js`.
- Drag-drop and realtime runtime handlers were extracted into `frontend/services/dragdrop-service.js` and `frontend/services/realtime-service.js`, reducing direct logic load in `frontend/events.js`.
