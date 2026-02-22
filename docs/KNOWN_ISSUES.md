# Known Issues & Technical Debt

This document tracks architectural improvements and performance optimizations needed for the Tulay Kanban project.

## Architecture & Refactoring
- **Resolved (2026-02-22)**: `frontend/app.js` was split into ES modules (`frontend/api.js`, `frontend/state.js`, `frontend/ui.js`, `frontend/events.js`) with `frontend/app.js` reduced to a bootstrap entrypoint.
- **Follow-up Refactor Needed**: `frontend/events.js` still contains a large orchestration surface and should be further decomposed (e.g., board, task, modal, and drag/drop submodules).
- **Global Namespace Pollution**: Multiple global variables (`tasks`, `boards`) and duplicate functions (e.g., `escapeHtml` covers logic already available in DOM APIs).

## Backend & API
- **Batched Updates**: Column and task reordering currently fires N individual API calls. The backend needs a single `/reorder` endpoint.
- **Client-side Filtering**: `loadMyTasks` manually groups data in JS. This logic should move to API query parameters (e.g., `?assignee=me&group_by=status`).
- **ID Generation**: Unique IDs are generated on the client (`Date.now()`). This should be fully delegated to the database (PostgreSQL UUIDs/Serials).

## UI & Performance
- **Template Bloat**: HTML strings are hardcoded in JS. These should be migrated to HTML `<template>` tags or a lightweight component library.
- **Manual Escaping**: `innerHTML` usage requires manual `escapeHtml`. Moving to `.textContent` or the native Sanitizer API is safer.
- **Layout Thrashing**: Sidebar overflow logic uses expensive manual `offset` calculations. This should be replaced with CSS/Container Queries.
- **Date Handling**: Custom date formatting logic should be replaced by `Intl.DateTimeFormat` for better performance and localization.
