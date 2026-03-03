import { authFetch, sendKafkaEventRequest } from '$lib/api';
import { API_URL } from '$lib/constants';
import { activeBoardId, columns, setColumns, tasks, setTasks } from '$lib/stores/board';
import { get } from 'svelte/store';
import type { Column, Task } from '$lib/types';

export async function loadColumnsAndTasks() {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    try {
        const [colsRes, tasksRes] = await Promise.all([
            authFetch(`${API_URL}/api/boards/${boardId}/columns`),
            authFetch(`${API_URL}/api/boards/${boardId}/tasks`)
        ]);

        if (colsRes) {
            const loadedCols = await colsRes.json();
            setColumns(loadedCols.sort((a: Column, b: Column) => a.order - b.order));
        }

        if (tasksRes) {
            const loadedTasks = await tasksRes.json();
            setTasks(loadedTasks.sort((a: Task, b: Task) => a.order - b.order));
        }
    } catch (e) {
        console.error('Failed to load columns/tasks', e);
    }
}

export async function createColumn(title: string) {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    const currentCols = get(columns);
    const mockId = `temp-${Date.now()}`;
    const newCol: Column = {
        id: mockId,
        board_id: boardId,
        title,
        order: currentCols.length * 10
    };

    // Optimistic UI update
    setColumns([...currentCols, newCol]);

    try {
        await sendKafkaEventRequest(API_URL, {
            type: 'COLUMN_CREATED',
            board_id: boardId,
            column_id: mockId,
            payload: { title, order: newCol.order }
        });
        // Real object comes back via Kafka websocket to update store
    } catch (e) {
        console.error('Failed to create column', e);
        // Revert UI on failure
        setColumns(currentCols);
        throw e;
    }
}

export async function createTask(columnId: string, title: string) {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    const currentTasks = get(tasks);
    const columnTasks = currentTasks.filter(t => t.column_id === columnId);
    const mockId = `temp-${Date.now()}`;

    const newTask: Task = {
        id: mockId,
        board_id: boardId,
        column_id: columnId,
        title,
        description: '',
        status: 'todo',
        priority: 'low',
        order: columnTasks.length * 10
    };

    // Optimistic UI update
    setTasks([...currentTasks, newTask]);

    try {
        await sendKafkaEventRequest(API_URL, {
            type: 'TASK_CREATED',
            board_id: boardId,
            task_id: mockId, // Usually backend handles standard ID gen if omitted or accepts client gen
            payload: {
                column_id: columnId,
                title,
                description: '',
                status: 'todo',
                priority: 'low',
                order: newTask.order
            }
        });
    } catch (e) {
        console.error('Failed to create task', e);
        setTasks(currentTasks);
        throw e;
    }
}
