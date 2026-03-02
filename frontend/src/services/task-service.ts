import type { AppElements, Task } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface SaveTaskFromPanelCtx {
    getCurrentEditingTask: () => Task | null;
    elements: AppElements;
    columns: { id: string; title: string }[];
    getSelectedLabelIds: () => string[];
    showToast: AnyFn;
    updateTask: (id: string, updates: Partial<Task>) => void;
    closeTaskPanel: () => void;
}
export function saveTaskFromPanelService(ctx: SaveTaskFromPanelCtx): void {
    const { getCurrentEditingTask, elements, columns, getSelectedLabelIds, showToast, updateTask, closeTaskPanel } = ctx;
    const currentEditingTask = getCurrentEditingTask();
    if (!currentEditingTask) return;

    const dueDateValue = (elements.panelDueDate as HTMLInputElement).value;
    if (dueDateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dueDateValue);
        if (selectedDate < today) {
            showToast('Due date cannot be in the past', 'error');
            (elements.panelDueDate as HTMLInputElement).focus();
            return;
        }
    }

    const newColumnId = (elements.panelStatusSelect as HTMLSelectElement).value;
    const newColumn = columns.find(c => c.id === newColumnId);

    const updates: Partial<Task> = {
        title: (elements.panelTitle as HTMLInputElement).value.trim(),
        description: (elements.panelDescription as HTMLTextAreaElement).value.trim(),
        column_id: newColumnId,
        status: newColumn ? newColumn.title.toLowerCase().replace(/\s+/g, '') : currentEditingTask.status,
        priority: (elements.panelPrioritySelect as HTMLSelectElement).value as Task['priority'],
        label_ids: getSelectedLabelIds(),
        due_date: dueDateValue || null,
        assignee_id: (elements.panelAssigneeSelect as HTMLSelectElement).value || null,
        images: currentEditingTask.images || [],
    };

    if (!updates.title) {
        (elements.panelTitle as HTMLInputElement).focus();
        return;
    }

    updateTask(currentEditingTask.id, updates);
    closeTaskPanel();
}

interface AddTaskCtx {
    activeBoardId: string | null;
    authFetch: AnyFn;
    API_URL: string;
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    renderBoard: () => void;
    notifyKafkaEvent: AnyFn;
    elements: AppElements;
    renderActivityLog: () => void;
    showToast: AnyFn;
}
export async function addTaskService(
    ctx: AddTaskCtx,
    title: string,
    description: string,
    priority: string,
    status: string,
    labelIds: string[] = []
): Promise<void> {
    const { activeBoardId, authFetch, API_URL, tasks, setTasks, renderBoard, notifyKafkaEvent, elements, renderActivityLog, showToast } = ctx;
    if (!activeBoardId) return;
    const taskData = { title, description, priority, status, label_ids: labelIds, board_id: activeBoardId };
    try {
        const response = await authFetch(`${API_URL}/api/tasks`, { method: 'POST', body: JSON.stringify(taskData) });
        if (!response) return;
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }
        const newTask = await response.json() as Task;
        setTasks([...tasks, newTask]);
        renderBoard();
        notifyKafkaEvent('Task created: ' + newTask.title, 'success');
        if (!elements.activityView!.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

export async function addTaskToColumnService(
    ctx: AddTaskCtx,
    title: string,
    description: string,
    priority: string,
    columnId: string,
    labelIds: string[] = []
): Promise<void> {
    const { activeBoardId, authFetch, API_URL, tasks, setTasks, renderBoard, notifyKafkaEvent, elements, renderActivityLog, showToast } = ctx;
    if (!activeBoardId) return;
    const taskData = { title, description, priority, label_ids: labelIds, board_id: activeBoardId, column_id: columnId };
    try {
        const response = await authFetch(`${API_URL}/api/tasks`, { method: 'POST', body: JSON.stringify(taskData) });
        if (!response) return;
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }
        const newTask = await response.json() as Task;
        setTasks([...tasks, newTask]);
        renderBoard();
        notifyKafkaEvent('Task created: ' + newTask.title, 'success');
        if (!elements.activityView!.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

interface UpdateTaskCtx {
    authFetch: AnyFn;
    API_URL: string;
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    renderBoard: () => void;
    elements: AppElements;
    renderActivityLog: () => void;
    notifyKafkaEvent: AnyFn;
    showToast: AnyFn;
}
export async function updateTaskService(ctx: UpdateTaskCtx, id: string, updates: Partial<Task>): Promise<void> {
    const { authFetch, API_URL, tasks, setTasks, renderBoard, elements, renderActivityLog, notifyKafkaEvent, showToast } = ctx;
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) });
        if (!response.ok) throw new Error('Failed to update task');
        const updatedTask = await response.json() as Task;
        const nextTasks = [...tasks];
        const index = nextTasks.findIndex(t => t.id === id);
        if (index !== -1) { nextTasks[index] = { ...nextTasks[index], ...updatedTask }; setTasks(nextTasks); }
        renderBoard();
        if (!elements.activityView!.classList.contains('hidden')) renderActivityLog();
        notifyKafkaEvent('Task updated: ' + updatedTask.title, 'success');
    } catch (e) {
        console.error('Error updating task:', e);
        showToast('Failed to update task', 'error');
    }
}

interface ShowDeleteModalCtx {
    elements: AppElements;
    setTaskToDeleteId: (id: string | null) => void;
}
export function showDeleteModalService(ctx: ShowDeleteModalCtx, task: Task): void {
    const { elements, setTaskToDeleteId } = ctx;
    setTaskToDeleteId(task.id);
    elements.deleteTaskTitle!.textContent = task.title;
    elements.deleteModal!.classList.remove('hidden');
}

export function hideDeleteModalService({ elements, setTaskToDeleteId }: ShowDeleteModalCtx): void {
    elements.deleteModal!.classList.add('hidden');
    setTaskToDeleteId(null);
}

interface DeleteTaskCtx {
    tasks: Task[];
    setTasks: (tasks: Task[]) => void;
    authFetch: AnyFn;
    API_URL: string;
    renderBoard: () => void;
    elements: AppElements;
    renderActivityLog: () => void;
    closeTaskPanel: () => void;
    notifyKafkaEvent: AnyFn;
    showToast: AnyFn;
}
export async function deleteTaskService(ctx: DeleteTaskCtx, id: string): Promise<void> {
    const { tasks, setTasks, authFetch, API_URL, renderBoard, elements, renderActivityLog, closeTaskPanel, notifyKafkaEvent, showToast } = ctx;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete task');
        setTasks(tasks.filter(t => t.id !== id));
        renderBoard();
        if (!elements.activityView!.classList.contains('hidden')) renderActivityLog();
        closeTaskPanel();
        notifyKafkaEvent('Task deleted: ' + task.title, 'success');
    } catch (e) {
        console.error('Error deleting task:', e);
        showToast('Failed to delete task', 'error');
    }
}
