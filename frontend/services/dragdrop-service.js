export function cleanupDragStateService(state) {
    if (state.draggedTask) {
        state.draggedTask.classList.remove('dragging');
        state.draggedTask.style.opacity = '';
    }
    state.draggedTask = null;
    state.draggedTaskId = null;
    state.isDragging = false;
    state.isDragInProgress = false;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
}

export function handleDragStartService({ state, TASK_DRAG_KEY }, e) {
    const card = e.currentTarget;
    if (!card || !card.classList.contains('task-card')) return;

    cleanupDragStateService(state);

    state.draggedTask = card;
    state.draggedTaskId = card.dataset.taskId;
    state.isDragging = true;
    state.isDragInProgress = true;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(TASK_DRAG_KEY, state.draggedTaskId);
    e.dataTransfer.setData('text/plain', state.draggedTaskId);

    setTimeout(() => {
        if (state.draggedTask) {
            state.draggedTask.classList.add('dragging');
            state.draggedTask.style.opacity = '0.4';
        }
    }, 0);
}

export function handleDragEndService(state) {
    cleanupDragStateService(state);
}

export function getDragAfterElementService(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        }
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

export function handleDragOverService({ state }, e) {
    if (!state.isDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    let taskList = e.target.closest('.task-list');
    if (!taskList) {
        const column = e.target.closest('.column');
        if (column) taskList = column.querySelector('.task-list');
    }
    if (!taskList) return;

    const afterElement = getDragAfterElementService(taskList, e.clientY);

    document.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove());

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator h-1 bg-primary rounded-full my-1 transition-all';

    if (afterElement == null) {
        taskList.appendChild(indicator);
    } else {
        taskList.insertBefore(indicator, afterElement);
    }
}

export function handleDragEnterService({ state }, e) {
    if (!state.isDragging) return;
    e.preventDefault();
    const column = e.target.closest('.column');
    if (column) {
        column.classList.add('drag-over');
    }
}

export function handleDragLeaveService({ state }, e) {
    if (!state.isDragging) return;
    const column = e.target.closest('.column');
    const relatedColumn = e.relatedTarget?.closest('.column');

    if (column && column !== relatedColumn) {
        column.classList.remove('drag-over');
        column.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }
}

export function handleDropService({
    state,
    TASK_DRAG_KEY,
    tasks,
    setTasks,
    renderBoard,
    persistTaskDrop,
    notifyKafkaEvent
}, e) {
    if (!state.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const taskId = e.dataTransfer.getData(TASK_DRAG_KEY) || e.dataTransfer.getData('text/plain');
    const column = e.target.closest('.column');

    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));

    if (!column || !taskId) {
        cleanupDragStateService(state);
        return;
    }

    const newColumnId = column.dataset.columnId;
    const taskList = column.querySelector('.task-list');
    if (!newColumnId || !taskList) {
        cleanupDragStateService(state);
        return;
    }

    const afterElement = getDragAfterElementService(taskList, e.clientY);
    const afterTaskId = afterElement ? afterElement.dataset.taskId : null;

    const nextTasks = [...tasks];
    const taskIndex = nextTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        cleanupDragStateService(state);
        return;
    }

    const task = nextTasks[taskIndex];
    const oldColumnId = task.column_id;
    const columnChanged = oldColumnId !== newColumnId;

    nextTasks.splice(taskIndex, 1);
    task.column_id = newColumnId;
    task.updated_at = new Date().toISOString();

    if (afterTaskId) {
        const afterIndex = nextTasks.findIndex(t => t.id === afterTaskId);
        if (afterIndex !== -1) {
            nextTasks.splice(afterIndex, 0, task);
        } else {
            nextTasks.push(task);
        }
    } else {
        const lastIndexOfColumn = nextTasks.reduce((last, t, i) => t.column_id === newColumnId ? i : last, -1);
        if (lastIndexOfColumn === -1) {
            nextTasks.push(task);
        } else {
            nextTasks.splice(lastIndexOfColumn + 1, 0, task);
        }
    }

    setTasks(nextTasks);
    cleanupDragStateService(state);
    renderBoard();

    if (columnChanged) {
        persistTaskDrop(taskId, { column_id: newColumnId });
    } else {
        notifyKafkaEvent(`Task reordered: ${task.title}`);
    }
}

export async function persistTaskDropService({
    authFetch,
    API_URL,
    tasks,
    setTasks,
    elements,
    renderActivityLog,
    notifyKafkaEvent,
    showToast
}, taskId, updates) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        if (!response || !response.ok) throw new Error('Failed to update task');
        const updatedTask = await response.json();

        const nextTasks = [...tasks];
        const index = nextTasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            nextTasks[index] = { ...nextTasks[index], ...updatedTask };
            setTasks(nextTasks);
        }
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        notifyKafkaEvent('Task moved: ' + updatedTask.title, 'success');
    } catch (err) {
        console.error('Error persisting task drop:', err);
        showToast('Failed to save task move', 'error');
    }
}

export function handleColumnDragStartService({ state, COLUMN_DRAG_KEY }, e) {
    const handle = e.target.closest('.column-drag-handle');
    if (!handle) {
        e.preventDefault();
        return;
    }

    state.draggedColumn = handle.closest('.column');
    if (!state.draggedColumn) {
        e.preventDefault();
        return;
    }

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData(COLUMN_DRAG_KEY, state.draggedColumn.dataset.columnId);

    setTimeout(() => {
        if (state.draggedColumn) state.draggedColumn.classList.add('dragging');
    }, 0);
}

export function handleColumnDragEndService(state) {
    if (state.draggedColumn) {
        state.draggedColumn.classList.remove('dragging');
        state.draggedColumn = null;
    }
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
}

export function handleColumnDragOverService({ state }, e) {
    if (!state.draggedColumn) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const board = document.getElementById('board');
    const targetColumn = e.target.closest('.column');
    if (!targetColumn || targetColumn === state.draggedColumn || !board) return;

    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());

    const rect = targetColumn.getBoundingClientRect();
    const insertBefore = e.clientX < rect.left + rect.width / 2;

    const indicator = document.createElement('div');
    indicator.className = 'column-drop-indicator';

    if (insertBefore) {
        board.insertBefore(indicator, targetColumn);
    } else {
        board.insertBefore(indicator, targetColumn.nextSibling);
    }
}

export function handleColumnDropService({
    state,
    columns,
    setColumns,
    updateColumnPositions,
    renderBoard,
    showToast
}, e) {
    if (!state.draggedColumn) return;

    e.preventDefault();

    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());

    const targetColumn = e.target.closest('.column');
    if (!targetColumn || targetColumn === state.draggedColumn) {
        handleColumnDragEndService(state);
        return;
    }

    const draggedId = state.draggedColumn.dataset.columnId;
    const targetId = targetColumn.dataset.columnId;

    const nextColumns = [...columns];
    const draggedIndex = nextColumns.findIndex(c => c.id === draggedId);
    const targetIndex = nextColumns.findIndex(c => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
        handleColumnDragEndService(state);
        return;
    }

    const rect = targetColumn.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const dropBefore = e.clientX < midpoint;

    const [movedColumn] = nextColumns.splice(draggedIndex, 1);

    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) {
        newIndex = dropBefore ? targetIndex - 1 : targetIndex;
    } else {
        newIndex = dropBefore ? targetIndex : targetIndex + 1;
    }

    nextColumns.splice(newIndex, 0, movedColumn);
    setColumns(nextColumns);

    updateColumnPositions().then(() => {
        renderBoard();
        showToast('Column moved', 'success');
    });

    handleColumnDragEndService(state);
}
