import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';
import { activeBoardId } from '$lib/stores/board';
import { get } from 'svelte/store';
import type { TaskComment, Subtask } from '$lib/types';

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
        start_date?: string;
        due_date?: string;
        assignee_id?: string;
        images?: string[];
    }
): Promise<import('$lib/types').Task | undefined> {
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
                start_date: options?.start_date,
                due_date: options?.due_date,
                assignee_id: options?.assignee_id,
                images: options?.images ?? []
            })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to create task');
        }

        return (await response.json()) as import('$lib/types').Task;
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
    // Return the raw path (e.g. /uploads/foo.jpg) so it's stored device-agnostically.
    // resolveImageUrl() will prepend the correct host at display time.
    return data.url;
}

export async function getMyTasks(): Promise<import('$lib/types').Task[]> {
    const response = await authFetch(`${API_URL}/api/tasks/my`);
    if (!response?.ok) return [];
    return (await response.json()) as import('$lib/types').Task[];
}

export async function createSubtask(
    taskId: string,
    title: string,
    percentage?: number
): Promise<Subtask | null> {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                percentage: percentage !== undefined ? percentage : null
            })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to create subtask');
        }

        return (await response.json()) as Subtask;
    } catch (e) {
        console.error('Failed to create subtask', e);
        throw e;
    }
}

export async function updateSubtask(
    subtaskId: string,
    updates: Record<string, unknown>
): Promise<Subtask | null> {
    try {
        const response = await authFetch(`${API_URL}/api/subtasks/${subtaskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to update subtask');
        }

        return (await response.json()) as Subtask;
    } catch (e) {
        console.error('Failed to update subtask', e);
        throw e;
    }
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
    try {
        const response = await authFetch(`${API_URL}/api/subtasks/${subtaskId}`, {
            method: 'DELETE'
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to delete subtask');
        }
    } catch (e) {
        console.error('Failed to delete subtask', e);
        throw e;
    }
}

export async function bulkUpdateTasksOrder(items: { id: string; column_id: string; order: number }[]): Promise<void> {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/reorder`, {
            method: 'PUT',
            body: JSON.stringify({ items })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            throw new Error(err?.detail || 'Failed to bulk update tasks');
        }
    } catch (e) {
        console.error('Failed to bulk update tasks', e);
        throw e;
    }
}
