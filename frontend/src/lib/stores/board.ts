import { writable, derived } from 'svelte/store';
import type { Board, Column, Task, Label } from '$lib/types';
import { taskFilters } from '$lib/stores/filter';

// Core State
export const boards = writable<Board[]>([]);
export const activeBoardId = writable<string | null>(null);
export const columns = writable<Column[]>([]);
export const tasks = writable<Task[]>([]);
export const labels = writable<Label[]>([]);
export const boardMembers = writable<any[]>([]);
export const activeTask = writable<Task | null>(null);
export const deleteListTarget = writable<{ id: string; title: string } | null>(null);
export const deleteTaskTarget = writable<{ id: string; title: string } | null>(null);
export const editBoardTarget = writable<Board | null>(null);
export const deleteBoardTarget = writable<Board | null>(null);

// Derived State
export const activeBoard = derived(
    [boards, activeBoardId],
    ([$boards, $activeBoardId]) => $boards.find(b => b.id === $activeBoardId) || null
);

export const tasksByColumn = derived(
    [tasks, columns],
    ([$tasks, $columns]) => {
        const grouped: Record<string, Task[]> = {};
        for (const col of $columns) {
            grouped[col.id] = [];
        }
        for (const task of $tasks) {
            if (!grouped[task.column_id]) grouped[task.column_id] = [];
            grouped[task.column_id].push(task);
        }
        // sort tasks? Backend probably handles sorting or we just use array order
        return grouped;
    }
);

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export const filteredTasksByColumn = derived(
    [tasks, columns, taskFilters],
    ([$tasks, $columns, $filters]) => {
        const grouped: Record<string, Task[]> = {};
        for (const col of $columns) {
            grouped[col.id] = [];
        }

        let filtered = $tasks;

        // Priority filter is now handled as a sort order preference below

        // Label filter
        if ($filters.labelIds.length > 0) {
            filtered = filtered.filter(t => {
                // API returns full label objects in `labels`; fall back to `label_ids` if present
                const taskLabelIds = (t.labels as { id: string }[] | undefined)?.map(l => l.id)
                    ?? (t.label_ids as string[] | undefined)
                    ?? [];
                return $filters.labelIds.every(lid => taskLabelIds.includes(lid));
            });
        }

        // Board-level task search
        if ($filters.searchQuery.trim()) {
            const q = $filters.searchQuery.trim().toLowerCase();
            filtered = filtered.filter(
                t =>
                    t.title.toLowerCase().includes(q) ||
                    (t.description || '').toLowerCase().includes(q)
            );
        }

        // Group into columns
        for (const task of filtered) {
            if (!grouped[task.column_id]) grouped[task.column_id] = [];
            grouped[task.column_id].push(task);
        }

        // Sort within each column
        for (const colId of Object.keys(grouped)) {
            grouped[colId].sort((a, b) => {
                // If a specific priority is selected, sort those tasks to the top
                if ($filters.priority !== 'all') {
                    if (a.priority === $filters.priority && b.priority !== $filters.priority) return -1;
                    if (b.priority === $filters.priority && a.priority !== $filters.priority) return 1;
                }
                
                switch ($filters.sortBy) {
                    case 'priority-asc':
                        return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
                    case 'priority-desc':
                        return (PRIORITY_ORDER[b.priority] ?? 1) - (PRIORITY_ORDER[a.priority] ?? 1);
                    case 'due-date': {
                        const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity;
                        const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity;
                        return aDate - bDate;
                    }
                    case 'title':
                        return a.title.localeCompare(b.title);
                    default:
                        // natural board order
                        return (a.order ?? 0) - (b.order ?? 0);
                }
            });
        }

        return grouped;
    }
);

// Actions
export function setBoards(newBoards: Board[]) {
    boards.set(newBoards);
}

export function setActiveBoardId(id: string | null) {
    activeBoardId.set(id);
}

export function setColumns(newColumns: Column[]) {
    columns.set(newColumns);
}

export function setTasks(newTasks: Task[]) {
    tasks.set(newTasks);
}

export function setLabels(newLabels: Label[]) {
    labels.set(newLabels);
}

export function setBoardMembers(members: any[]) {
    boardMembers.set(members);
}

export function setActiveTask(task: Task | null) {
    activeTask.set(task);
}

export function setDeleteListTarget(target: { id: string; title: string } | null) {
    deleteListTarget.set(target);
}

export function setDeleteTaskTarget(target: { id: string; title: string } | null) {
    deleteTaskTarget.set(target);
}

export function setEditBoardTarget(target: Board | null) {
    editBoardTarget.set(target);
}

export function setDeleteBoardTarget(target: Board | null) {
    deleteBoardTarget.set(target);
}
