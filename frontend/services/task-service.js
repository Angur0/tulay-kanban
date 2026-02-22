export function saveTaskFromPanelService({
    getCurrentEditingTask,
    elements,
    columns,
    getSelectedLabelIds,
    showToast,
    updateTask,
    closeTaskPanel
}) {
    const currentEditingTask = getCurrentEditingTask();
    if (!currentEditingTask) return;

    const dueDateValue = elements.panelDueDate.value;
    if (dueDateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dueDateValue);
        if (selectedDate < today) {
            showToast('Due date cannot be in the past', 'error');
            elements.panelDueDate.focus();
            return;
        }
    }

    const newColumnId = elements.panelStatusSelect.value;
    const newColumn = columns.find(c => c.id === newColumnId);

    const updates = {
        title: elements.panelTitle.value.trim(),
        description: elements.panelDescription.value.trim(),
        column_id: newColumnId,
        status: newColumn ? newColumn.title.toLowerCase().replace(/\s+/g, '') : currentEditingTask.status,
        priority: elements.panelPrioritySelect.value,
        label_ids: getSelectedLabelIds(),
        due_date: dueDateValue || null,
        assignee_id: elements.panelAssigneeSelect.value || null,
        images: currentEditingTask.images || []
    };

    if (!updates.title) {
        elements.panelTitle.focus();
        return;
    }

    updateTask(currentEditingTask.id, updates);
    closeTaskPanel();
}

export async function addTaskService({
    activeBoardId,
    authFetch,
    API_URL,
    tasks,
    setTasks,
    renderBoard,
    notifyKafkaEvent,
    elements,
    renderActivityLog,
    showToast
}, title, description, priority, status, labelIds = []) {
    if (!activeBoardId) return;

    const taskData = {
        title,
        description,
        priority,
        status,
        label_ids: labelIds,
        board_id: activeBoardId
    };

    try {
        const response = await authFetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (!response) return;

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }

        const newTask = await response.json();
        setTasks([...tasks, newTask]);
        renderBoard();
        notifyKafkaEvent('Task created: ' + newTask.title, 'success');

        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

export async function addTaskToColumnService({
    activeBoardId,
    authFetch,
    API_URL,
    tasks,
    setTasks,
    renderBoard,
    notifyKafkaEvent,
    elements,
    renderActivityLog,
    showToast
}, title, description, priority, columnId, labelIds = []) {
    if (!activeBoardId) return;

    const taskData = {
        title,
        description,
        priority,
        label_ids: labelIds,
        board_id: activeBoardId,
        column_id: columnId
    };

    try {
        const response = await authFetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (!response) return;

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }

        const newTask = await response.json();
        setTasks([...tasks, newTask]);
        renderBoard();
        notifyKafkaEvent('Task created: ' + newTask.title, 'success');

        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

export async function updateTaskService({
    authFetch,
    API_URL,
    tasks,
    setTasks,
    renderBoard,
    elements,
    renderActivityLog,
    notifyKafkaEvent,
    showToast
}, id, updates) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update task');

        const updatedTask = await response.json();

        const nextTasks = [...tasks];
        const index = nextTasks.findIndex(t => t.id === id);
        if (index !== -1) {
            nextTasks[index] = { ...nextTasks[index], ...updatedTask };
            setTasks(nextTasks);
        }

        renderBoard();
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        notifyKafkaEvent('Task updated: ' + updatedTask.title, 'success');
    } catch (e) {
        console.error('Error updating task:', e);
        showToast('Failed to update task', 'error');
    }
}

export function showDeleteModalService({
    elements,
    setTaskToDeleteId
}, task) {
    setTaskToDeleteId(task.id);
    elements.deleteTaskTitle.textContent = task.title;
    elements.deleteModal.classList.remove('hidden');
}

export function hideDeleteModalService({
    elements,
    setTaskToDeleteId
}) {
    elements.deleteModal.classList.add('hidden');
    setTaskToDeleteId(null);
}

export async function deleteTaskService({
    tasks,
    setTasks,
    authFetch,
    API_URL,
    renderBoard,
    elements,
    renderActivityLog,
    closeTaskPanel,
    notifyKafkaEvent,
    showToast
}, id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete task');

        setTasks(tasks.filter(t => t.id !== id));
        renderBoard();
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        closeTaskPanel();
        notifyKafkaEvent('Task deleted: ' + task.title, 'success');
    } catch (e) {
        console.error('Error deleting task:', e);
        showToast('Failed to delete task', 'error');
    }
}
