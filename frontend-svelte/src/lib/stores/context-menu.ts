import { writable } from 'svelte/store';
import type { Task } from '$lib/types';

type MenuType = 'board' | 'column' | 'task';

export interface ContextMenuState {
    type: MenuType;
    x: number;
    y: number;
    boardId?: string;
    boardName?: string;
    columnId?: string;
    task?: Task;
}

export const contextMenu = writable<ContextMenuState | null>(null);

export function openContextMenu(state: ContextMenuState) {
    contextMenu.set(state);
}

export function closeContextMenu() {
    contextMenu.set(null);
}
