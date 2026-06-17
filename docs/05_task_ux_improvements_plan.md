# Implementation Plan: Task UX Improvements

This document outlines the detailed plans for implementing requested task UX changes, including visual markers for archived lists, smart task deletion, toast notifications for user actions, and WebSocket-based task assignment alerts.

---

## 1. Archive List Marker

**Goal:** Reduce visual prominence or highlight archived columns to differentiate them from active columns.
- **Specification:** Apply a reduced opacity style (`opacity: 0.6` or similar) to the archived column column wrapper to indicate it is archived/inactive.
- **Target File:** `frontend/src/lib/components/Column.svelte`
- **Implementation Detail:** Add conditional CSS styling or Tailwind class (e.g. `opacity-60` or custom inline styling) on the main column container if `column.is_archive` is true.

---

## 2. Smart Task Deletion with Warning Suppression (Per Browser)

**Goal:** Change task deletion behavior so that:
1. If an archive list exists on the board and the task is *not* already in it, deleting the task moves it to the archive list instead of permanent deletion.
2. If no archive list exists, or if the task is already in the archive list, deleting the task permanently deletes it. In this case, show a warning modal with a "Don't show this warning again" checkbox.
3. If warning is suppressed (stored in `localStorage` per browser), perform the deletion immediately without showing the confirmation warning.

### Steps:
- **`tasksApi.ts`:** Update `deleteTask` to parse and return the response body containing the action status (e.g., `{"status": "archived" | "deleted"}`).
- **`DeleteTaskModal.svelte`:**
  - Read active `columns` to detect if an archive column exists on the board, and if the target task is already in it.
  - Read `localStorage.getItem('tulay_suppress_delete_warning')` to check if warning is suppressed.
  - If warning is suppressed: bypass the modal confirmation flow and delete immediately when the user clicks delete, or automatically confirm the modal if opened.
  - If warning is not suppressed:
    - If task will be archived: Show a friendly message ("This task will be moved to Archive"). No title confirmation needed.
    - If task will be permanently deleted: Show the destructive warning, text-confirmation input, and a "Don't show this warning again" checkbox.
    - If the checkbox is checked, save `'true'` to `localStorage.setItem('tulay_suppress_delete_warning', 'true')` upon deletion.

---

## 3. Toast Notification System

**Goal:** Provide transient, auto-dismissing feedback messages for task CRUD actions performed by the current user.
- **Specification:** Toast container in the bottom-right corner. Toast duration of 2 seconds. Only fire for actions initiated by the user (not from events broadcasted by other users, unless it's a direct assignment).

### Steps:
- **`toast.ts` Store:** Already created in `frontend/src/lib/stores/toast.ts` with 2-second default duration.
- **`ToastContainer.svelte`:** Create a floating component in the bottom-right of the screen that listens to the `toastStore` and displays toasts with CSS transitions.
- **App Mounting:** Add `<ToastContainer />` inside `AppLayout.svelte`.
- **API and UI Wiring:** Call `toastSuccess`/`toastError` directly in user-facing action handler methods:
  - Task Creation (`CreateTaskModal.svelte` & inline create forms).
  - Task Updates (`TaskModal.svelte`).
  - Task Deletion/Archival (`DeleteTaskModal.svelte`).
  - Bulk actions in column menu (`Column.svelte`).
  - Column transition drag-and-drop (`BoardView.svelte` -> only when columns change, not when reordering within the same column).

---

## 4. WebSocket Assignment Notifications

**Goal:** Notify the current user via a toast whenever they are assigned to a task, regardless of who performed the assignment (including themselves).
- **Specification:** Use the active WebSocket event stream to listen for `TASK_UPDATED` events where the assignee matches the current user.

### Steps:
- **Backend Change (`backend/routers/tasks.py`):** Modify the event payload for `TASK_UPDATED` to include the `taskTitle` (or `task_title`) so the frontend toast can print the task name.
- **Frontend Change (`AppLayout.svelte`):** In the WebSocket message event listener, inspect `TASK_UPDATED` events:
  - If `event.data.assignee_id === currentUser.id`, show a toast: `"You were assigned to task: [taskTitle]"` (or `"You assigned yourself to task: [taskTitle]"` if the event's `user_id` matches the current user's ID).

---

## 5. Documentation Updates

**Goal:** Update developer docs to reflect these design decisions.
- **Target Files:** `docs/02_planned_changes.md`, `docs/03_done_changes.md`.
