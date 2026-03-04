import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';
import { activeBoardId, setColumns, setLabels, setTasks } from '$lib/stores/board';
import { activeWorkspaceId } from '$lib/stores/user';
import { get } from 'svelte/store';
import type { Column, Label, Task } from '$lib/types';

export async function loadColumnsAndTasks() {
    const boardId = get(activeBoardId);
    const workspaceId = get(activeWorkspaceId);
    if (!boardId) return;

    try {
        const [colsRes, tasksRes, boardLabelsRes, workspaceLabelsRes] = await Promise.all([
            authFetch(`${API_URL}/api/boards/${boardId}/columns`),
            authFetch(`${API_URL}/api/boards/${boardId}/tasks`),
            authFetch(`${API_URL}/api/boards/${boardId}/labels`),
            workspaceId
                ? authFetch(`${API_URL}/api/workspaces/${workspaceId}/labels`)
                : Promise.resolve(null),
        ]);

        if (colsRes) {
            const loadedCols = await colsRes.json();
            setColumns(
                loadedCols.sort((a: Column, b: Column) => {
                    const aPos = typeof a.position === 'number' ? a.position : a.order ?? 0;
                    const bPos = typeof b.position === 'number' ? b.position : b.order ?? 0;
                    return aPos - bPos;
                })
            );
        }

        if (tasksRes) {
            const loadedTasks = await tasksRes.json();
            setTasks(
                loadedTasks.sort((a: Task, b: Task) => {
                    const aOrder = typeof a.order === 'number' ? a.order : 0;
                    const bOrder = typeof b.order === 'number' ? b.order : 0;
                    if (aOrder !== bOrder) return aOrder - bOrder;
                    const aCreated =
                        typeof a.created_at === 'string' ? new Date(a.created_at).getTime() : 0;
                    const bCreated =
                        typeof b.created_at === 'string' ? new Date(b.created_at).getTime() : 0;
                    return aCreated - bCreated;
                })
            );
        }

        const mergedLabels: Label[] = [];
        if (workspaceLabelsRes?.ok) {
            mergedLabels.push(...((await workspaceLabelsRes.json()) as Label[]));
        }
        if (boardLabelsRes?.ok) {
            mergedLabels.push(...((await boardLabelsRes.json()) as Label[]));
        }

        if (mergedLabels.length > 0) {
            const deduped = new Map<string, Label>();
            for (const label of mergedLabels) {
                deduped.set(label.id, label);
            }
            setLabels([...deduped.values()]);
        } else {
            setLabels([]);
        }
    } catch (e) {
        console.error('Failed to load columns/tasks', e);
    }
}
