import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';
import { activeBoardId } from '$lib/stores/board';
import { get } from 'svelte/store';
import type { TaskComment } from '$lib/types';

export function resolveImageUrl(url: string): string {
    if (!url) return url;
    if (/^https?:\/\//i.test(url) || /^data:/i.test(url) || /^blob:/i.test(url)) {
        return url;
    }
    if (url.startsWith('/')) {
        return `${API_URL}${url}`;
    }
    return `${API_URL}/${url}`;
}

export async function createTask(
    columnId: string,
    title: string,
    options?: {
        description?: string;
        priority?: 'low' | 'medium' | 'high';
        labelIds?: string[];
    }
) {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    try {
        const response = await authFetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            body: JSON.stringify({
                board_id: boardId,
                column_id: columnId,
                title,
                description: options?.description ?? '',
                status: 'todo',
                priority: options?.priority ?? 'medium',
                label_ids: options?.labelIds ?? [],
                images: []
            })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to create task');
        }
    } catch (e) {
        console.error('Failed to create task', e);
        throw e;
    }
}

export async function updateTask(
    taskId: string,
    updates: Record<string, unknown>,
    options?: { reload?: boolean }
) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to update task');
        }

        return options?.reload !== false;
    } catch (e) {
        console.error('Failed to update task', e);
        throw e;
    }
}

export async function deleteTask(taskId: string) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'DELETE',
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to delete task');
        }
    } catch (e) {
        console.error('Failed to delete task', e);
        throw e;
    }
}

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
    const response = await authFetch(`${API_URL}/api/tasks/${taskId}/comments`);
    if (!response?.ok) return [];
    return (await response.json()) as TaskComment[];
}

export async function createTaskComment(
    taskId: string,
    payload: { content: string; images?: string[] }
): Promise<TaskComment | null> {
    const response = await authFetch(`${API_URL}/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (!response?.ok) {
        const err = await response?.json().catch(() => ({}));
        throw new Error(err?.detail || 'Failed to add comment');
    }

    return (await response.json()) as TaskComment;
}

export async function deleteTaskComment(commentId: string): Promise<void> {
    const response = await authFetch(`${API_URL}/api/comments/${commentId}`, {
        method: 'DELETE',
    });

    if (!response?.ok) {
        const err = await response?.json().catch(() => ({}));
        throw new Error(err?.detail || 'Failed to delete comment');
    }
}

export async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch(`${API_URL}/api/upload-image`, {
        method: 'POST',
        body: formData,
    });

    if (!response?.ok) {
        const err = await response?.json().catch(() => ({}));
        throw new Error(err?.detail || 'Failed to upload image');
    }

    const data = (await response.json()) as { url: string };
    return resolveImageUrl(data.url);
}

export async function getMyTasks(): Promise<import('$lib/types').Task[]> {
    const response = await authFetch(`${API_URL}/api/tasks/my`);
    if (!response?.ok) return [];
    return (await response.json()) as import('$lib/types').Task[];
}
