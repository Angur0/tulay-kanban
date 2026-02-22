# Known Issues & Technical Debt

This document tracks remaining issues, active refactors, and recently completed architecture work.

## Open Issues

### Backend & API
- **Column reorder batching**: Board reordering is batched via `POST /api/workspaces/{ws_id}/boards/reorder`, but column reordering still uses multiple `PUT /api/columns/{id}` calls. Add a batched column reorder endpoint.
- **Server-side task filtering/grouping**: `loadMyTasks` still groups tasks on the client. Move grouping/filtering to API query params (for example `?assignee=me&group_by=status`).

### Frontend & UI Safety
- **Template bloat in JS**: Large HTML strings are still hardcoded in orchestration/rendering paths. Migrate to HTML `<template>` tags or a lightweight component approach.
- **Manual escaping dependency**: Widespread `innerHTML` rendering still depends on `escapeHtml`. Prefer DOM-first rendering with `.textContent` (or Sanitizer API where appropriate).

### Performance
- **Layout thrashing risk**: Sidebar overflow handling still relies on manual offset-style calculations; replace with CSS-first layout (including Container Queries where suitable).

## In Progress / Partially Resolved

- No active partially resolved items right now.

## Resolved (2026-02-22)

- Frontend bootstrap was modularized: `frontend/app.js` now acts as entrypoint with logic split into `frontend/api.js`, `frontend/state.js`, `frontend/ui.js`, and `frontend/events.js`.
- Backend monolith routing was decomposed from `backend/main.py` into feature routers under `backend/routers/*` and shared modules in `backend/core/*`, with `backend/main.py` as composition root.
- Frontend listener orchestration was split from `frontend/events.js` into focused listener modules: `frontend/listeners/board.js`, `frontend/listeners/task.js`, `frontend/listeners/modal.js`, and `frontend/listeners/dragdrop.js`.
- Non-listener board/task/modal handlers were extracted into service modules: `frontend/services/board-service.js`, `frontend/services/task-service.js`, and `frontend/services/modal-service.js`.
- Drag-drop and realtime runtime handlers were extracted into `frontend/services/dragdrop-service.js` and `frontend/services/realtime-service.js`, reducing direct logic load in `frontend/events.js`.
- Modal interaction reliability was improved: create/delete/edit modals now close on outside click and key modal actions support Enter-triggered confirmation.
- ID ownership cleanup was completed: legacy frontend `Date.now()` ID fallback (`Task.generateId`) was removed, leaving persisted ID generation fully backend/database-owned.
- Global namespace cleanup was completed: `tasks` and `boards` are module-scoped and no longer exposed through the `window` namespace.
- Date formatting consistency was improved by using shared `Intl.DateTimeFormat` helpers in frontend date rendering.
