// src/lib/api/labelsApi.ts
import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';
import type { Label } from '$lib/types';

export async function getWorkspaceLabels(workspaceId: string): Promise<Label[]> {
    const res = await authFetch(`${API_URL}/api/workspaces/${workspaceId}/labels`);
    if (!res?.ok) throw new Error('Failed to fetch workspace labels');
    return await res.json();
}

export async function createWorkspaceLabel(workspaceId: string, payload: { name: string; color?: string }): Promise<Label> {
    const res = await authFetch(`${API_URL}/api/workspaces/${workspaceId}/labels`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error('Failed to create workspace label');
    return await res.json();
}

export async function getBoardLabels(boardId: string): Promise<Label[]> {
    const res = await authFetch(`${API_URL}/api/boards/${boardId}/labels`);
    if (!res?.ok) throw new Error('Failed to fetch labels');
    return await res.json();
}

export async function createBoardLabel(boardId: string, payload: { name: string; color?: string }): Promise<Label> {
    const res = await authFetch(`${API_URL}/api/boards/${boardId}/labels`, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error('Failed to create label');
    return await res.json();
}

export async function updateBoardLabel(labelId: string, payload: { name?: string; color?: string }): Promise<Label> {
    const res = await authFetch(`${API_URL}/api/labels/${labelId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error('Failed to update label');
    return await res.json();
}

export async function deleteBoardLabel(labelId: string): Promise<void> {
    const res = await authFetch(`${API_URL}/api/labels/${labelId}`, { method: 'DELETE' });
    if (!res?.ok) throw new Error('Failed to delete label');
}

export async function bulkCreateBoardLabels(boardId: string, labels: { name: string; color?: string }[]): Promise<Label[]> {
    const res = await authFetch(`${API_URL}/api/boards/${boardId}/labels/bulk`, {
        method: 'POST',
        body: JSON.stringify({ labels }),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error('Failed bulk create');
    return await res.json();
}

export async function bulkDeleteBoardLabels(boardId: string, labelIds: string[]): Promise<{ ok: boolean; deleted_count: number }> {
    const res = await authFetch(`${API_URL}/api/boards/${boardId}/labels/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ label_ids: labelIds }),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res?.ok) throw new Error('Failed bulk delete');
    return await res.json();
}
