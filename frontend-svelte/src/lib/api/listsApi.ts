import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';
import { activeBoardId, columns } from '$lib/stores/board';
import { get } from 'svelte/store';

export async function createColumn(title: string) {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    try {
        const currentCols = get(columns);
        const nextPosition = currentCols.length;

        const response = await authFetch(`${API_URL}/api/boards/${boardId}/columns`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                position: nextPosition,
                color: null
            })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to create column');
        }
    } catch (e) {
        console.error('Failed to create column', e);
        throw e;
    }
}

export async function updateColumn(
    columnId: string,
    updates: Record<string, unknown>,
    options?: { reload?: boolean }
) {
    try {
        const response = await authFetch(`${API_URL}/api/columns/${columnId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to update column');
        }

        return options?.reload !== false;
    } catch (e) {
        console.error('Failed to update column', e);
        throw e;
    }
}

export async function deleteColumn(columnId: string) {
    try {
        const response = await authFetch(`${API_URL}/api/columns/${columnId}`, {
            method: 'DELETE',
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to delete column');
        }
    } catch (e) {
        console.error('Failed to delete column', e);
        throw e;
    }
}
