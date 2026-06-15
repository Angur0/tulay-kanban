/**
 * Touch drag-and-drop store.
 *
 * Coordinates a pointer-event-based drag between TaskCard and Column components
 * without replacing the existing mouse drag-and-drop system.
 *
 * Lifecycle:
 *   1. TaskCard fires `startTouchDrag(taskId, columnId)` after a long-press.
 *   2. As the pointer moves, Column listens to the `touchDrag` store and
 *      computes the drop indicator position.
 *   3. TaskCard fires `commitTouchDrop(x, y)` on pointerup; Column that
 *      owns the element under (x, y) dispatches the existing taskDrop event.
 */

import { writable, get } from "svelte/store";

export interface TouchDragState {
    active: boolean;
    taskId: string | null;
    fromColumnId: string | null;
    /** Current pointer position (client coordinates) */
    x: number;
    y: number;
}

const initial: TouchDragState = {
    active: false,
    taskId: null,
    fromColumnId: null,
    x: 0,
    y: 0,
};

export const touchDrag = writable<TouchDragState>({ ...initial });

export function startTouchDrag(taskId: string, fromColumnId: string, x: number, y: number) {
    touchDrag.set({ active: true, taskId, fromColumnId, x, y });
}

export function moveTouchDrag(x: number, y: number) {
    const s = get(touchDrag);
    if (!s.active) return;
    touchDrag.update((state) => ({ ...state, x, y }));
}

export function cancelTouchDrag() {
    touchDrag.set({ ...initial });
}

/**
 * Finalize the drag. Returns the stored state and resets it so the caller
 * (a Column component) can dispatch the taskDrop event with the right data.
 */
export function commitTouchDrop(): TouchDragState {
    const snapshot = get(touchDrag);
    touchDrag.set({ ...initial });
    return snapshot;
}
