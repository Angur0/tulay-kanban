# Gantt Chart Implementation Plan

## Overview
This document outlines the plan to implement a Gantt chart view for the Kanban board. This feature will allow users to toggle between the traditional Kanban board view and a timeline-based Gantt chart view, providing better visualization for task scheduling and project timelines.

We will use the **Frappe Gantt** library (`frappe-gantt`), which is a lightweight, modern JavaScript Gantt chart library that integrates easily with frameworks like Svelte.

## 1. Dependencies
First, install the necessary dependencies for the frontend:
```bash
cd frontend
npm install frappe-gantt
npm install -D @types/frappe-gantt
```

## 2. State Management Updates
We need a way to track whether the user is looking at the Kanban view or the Gantt view.

**File:** `frontend/src/lib/stores/ui.ts`
- Add a new writable store `boardViewMode`:
  ```typescript
  export const boardViewMode = writable<'kanban' | 'gantt'>('kanban');
  ```
- Add a helper function to toggle the view:
  ```typescript
  export function setBoardViewMode(mode: 'kanban' | 'gantt') {
      boardViewMode.set(mode);
  }
  ```

## 3. UI Navigation Changes
Add a toggle control in the board header to allow users to switch between views.

**File:** `frontend/src/lib/components/Header.svelte`
- Import the new `boardViewMode` store.
- Add a segmented control or toggle buttons next to the "Filter" and "Members" buttons:
  ```html
  <div class="flex items-center bg-[#eff1f3] dark:bg-[#1e2936] rounded-lg p-0.5">
      <button 
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors {$boardViewMode === 'kanban' ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary' : 'text-[#5c6b7f] hover:text-[#111418]'}"
          on:click={() => setBoardViewMode('kanban')}>
          <span class="material-symbols-outlined text-[16px] align-middle">view_kanban</span>
      </button>
      <button 
          class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors {$boardViewMode === 'gantt' ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary' : 'text-[#5c6b7f] hover:text-[#111418]'}"
          on:click={() => setBoardViewMode('gantt')}>
          <span class="material-symbols-outlined text-[16px] align-middle">calendar_view_week</span>
      </button>
  </div>
  ```

## 4. Main Page Routing Update
Conditionally render the `BoardView` or the new `GanttView` based on the selected mode.

**File:** `frontend/src/routes/+page.svelte`
- Import `GanttView` and `boardViewMode`.
- Wrap the board rendering logic:
  ```html
  {#if $activeView === "board"}
      {#if $activeBoard}
          {#if $boardViewMode === 'kanban'}
              <BoardView />
          {:else}
              <GanttView />
          {/if}
      {:else}
          <!-- empty state -->
      {/if}
  ```

## 5. New Component: `GanttView.svelte`
Create the core Gantt chart wrapper component.

**File:** `frontend/src/lib/components/GanttView.svelte`
- **Data Transformation:** Subscribe to the `$tasks` store and transform the tasks into Frappe Gantt's required format.
  - Required fields: `id`, `name`, `start`, `end`, `progress`, `dependencies`.
  - Handle tasks without dates by assigning them a default 1-day duration starting today (or filter them out completely, though displaying them as unscheduled at the top or today is better).
- **Initialization:** Use Svelte's `onMount` or an action (`use:gantt`) to initialize `new Gantt("#gantt-container", tasks, options)`.
- **Reactivity:** When `$tasks` change, call `gantt.refresh(formattedTasks)` to update the chart dynamically.
- **Event Handling:**
  - `on_click(task)`: Open the `TaskModal` for the clicked task using its `id`.
  - `on_date_change(task, start, end)`: Trigger an API call `updateTask(task.id, { start_date: start, due_date: end })` to persist drag-and-drop date changes to the backend.

## 6. Edge Cases & Styling
- **Styling:** Import `frappe-gantt/dist/frappe-gantt.css` globally or inside the component. Apply CSS overrides to match the Tulay Kanban dark/light themes (since Frappe's default might look out of place).
- **Read-only handling:** Prevent dragging tasks on the Gantt chart if the user has `viewer` role (`$currentBoardRole`). Use the `readonly: true` option in Frappe Gantt based on permissions.
- **Null Dates:** Tasks completely missing `start_date` and `due_date` should probably default to `start = now`, `end = now + 1 day` so they appear on the timeline. We can visually distinguish them with a specific CSS class.
