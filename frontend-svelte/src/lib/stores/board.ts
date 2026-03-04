import { writable, derived } from 'svelte/store';
import type { Board, Column, Task, Label } from '$lib/types';

// Core State
export const boards = writable<Board[]>([]);
export const activeBoardId = writable<string | null>(null);
export const columns = writable<Column[]>([]);
export const tasks = writable<Task[]>([]);
export const labels = writable<Label[]>([]);
export const boardMembers = writable<any[]>([]);
export const activeTask = writable<Task | null>(null);
export const createTaskColumnId = writable<string | null>(null);
export const deleteListTarget = writable<{ id: string; title: string } | null>(null);
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

export function setCreateTaskColumnId(columnId: string | null) {
    createTaskColumnId.set(columnId);
}

export function setDeleteListTarget(target: { id: string; title: string } | null) {
    deleteListTarget.set(target);
}

export function setEditBoardTarget(target: Board | null) {
    editBoardTarget.set(target);
}

export function setDeleteBoardTarget(target: Board | null) {
    deleteBoardTarget.set(target);
}
