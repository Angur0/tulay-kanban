export async function loadBoardsService({
    activeWorkspaceId,
    authFetch,
    API_URL,
    setBoards,
    getActiveBoardId,
    setActiveBoardId,
    renderBoardList,
    showToast
}) {
    if (!activeWorkspaceId) return;
    try {
        const response = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/boards`);
        if (!response) return;
        const loadedBoards = await response.json();
        setBoards(loadedBoards);

        if (!getActiveBoardId() && loadedBoards.length > 0) {
            setActiveBoardId(loadedBoards[0].id);
        }
        renderBoardList();
    } catch (e) {
        console.error('Error loading boards:', e);
        showToast('Failed to load boards', 'error');
    }
}

export async function createBoardService({
    activeWorkspaceId,
    normalizeBoardIcon,
    authFetch,
    API_URL,
    setActiveBoardId,
    loadBoards,
    renderBoardList,
    loadColumns,
    loadTasks,
    loadActivities,
    loadLabels,
    switchView,
    showToast,
    hideCreateBoardModal
}, name, icon = 'dashboard', iconColor = '#3b82f6') {
    if (!activeWorkspaceId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                icon: normalizeBoardIcon(icon),
                icon_color: iconColor,
                workspace_id: activeWorkspaceId
            })
        });

        if (!response) return;
        const newBoard = await response.json();
        setActiveBoardId(newBoard.id);
        await loadBoards();
        renderBoardList();
        await loadColumns();
        await loadTasks();
        loadActivities();
        loadLabels();
        switchView('board');
        showToast('Board created successfully', 'success');
        hideCreateBoardModal();
    } catch (e) {
        console.error('Error creating board:', e);
        showToast('Failed to create board', 'error');
    }
}

export async function deleteBoardService({
    authFetch,
    API_URL,
    getBoards,
    setBoards,
    getActiveBoardId,
    closeTaskPanel,
    switchBoard,
    getWebsocket,
    setWebsocket,
    setActiveBoardId,
    setTasks,
    setColumns,
    setKafkaConnected,
    updateKafkaStatusUI,
    renderBoard,
    renderBoardList,
    showToast,
    hideDeleteBoardModal
}, boardId) {
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'DELETE'
        });

        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to delete board');
        }

        const nextBoards = getBoards().filter(b => b.id !== boardId);
        setBoards(nextBoards);

        if (getActiveBoardId() === boardId) {
            closeTaskPanel();
            if (nextBoards.length > 0) {
                switchBoard(nextBoards[0].id);
            } else {
                const websocket = getWebsocket();
                if (websocket) {
                    websocket.onclose = null;
                    websocket.close();
                    setWebsocket(null);
                }

                setActiveBoardId(null);
                setTasks([]);
                setColumns([]);
                setKafkaConnected(false);
                updateKafkaStatusUI();
                renderBoard();
            }
        }

        renderBoardList();
        showToast('Board deleted successfully', 'success');
        hideDeleteBoardModal();
    } catch (e) {
        console.error('Error deleting board:', e);
        showToast(e.message || 'Failed to delete board', 'error');
    }
}

export function showDeleteBoardModalService({
    elements,
    setBoardToDeleteId
}, boardId, boardName) {
    setBoardToDeleteId(boardId);
    elements.deleteBoardName.textContent = boardName;
    elements.deleteBoardConfirmInput.value = '';
    elements.confirmDeleteBoardBtn.disabled = true;
    elements.deleteBoardModal.classList.remove('hidden');
    elements.deleteBoardConfirmInput.dataset.boardName = boardName;
    setTimeout(() => elements.deleteBoardConfirmInput.focus(), 100);
}

export function hideDeleteBoardModalService({
    elements,
    setBoardToDeleteId
}) {
    elements.deleteBoardModal.classList.add('hidden');
    elements.deleteBoardConfirmInput.value = '';
    elements.confirmDeleteBoardBtn.disabled = true;
    setBoardToDeleteId(null);
}

export function switchBoardService({
    getActiveBoardId,
    setActiveBoardId,
    renderBoardList,
    loadColumns,
    loadTasks,
    loadActivities,
    loadLabels,
    switchView
}, boardId) {
    if (getActiveBoardId() === boardId) return;
    setActiveBoardId(boardId);

    const popout = document.getElementById('boardsPopout');
    if (popout) popout.style.display = 'none';

    renderBoardList();
    loadColumns().then(loadTasks);
    loadActivities();
    loadLabels();
    switchView('board');
}

export function showCreateBoardModalService({ elements }) {
    elements.newBoardName.value = '';
    if (elements.newBoardIcon) {
        elements.newBoardIcon.value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            elements.selectedIconPreview.style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) {
        elements.newBoardIconColor.value = '#3b82f6';
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === '#3b82f6') {
                btn.classList.add('active');
            }
        });
    }
    if (elements.iconDropdownMenu) {
        elements.iconDropdownMenu.classList.add('hidden');
    }
    elements.createBoardModal.classList.remove('hidden');
    setTimeout(() => elements.newBoardName.focus(), 50);
}

export function hideCreateBoardModalService({ elements }) {
    elements.createBoardModal.classList.add('hidden');
    if (elements.iconDropdownMenu) {
        elements.iconDropdownMenu.classList.add('hidden');
    }
    elements.newBoardName.value = '';
    if (elements.newBoardIcon) {
        elements.newBoardIcon.value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            elements.selectedIconPreview.style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) {
        elements.newBoardIconColor.value = '#3b82f6';
    }
}

export function showEditBoardModalService({
    elements,
    getBoards,
    normalizeBoardIcon
}, boardId) {
    const board = getBoards().find(b => b.id === boardId);
    if (!board) return;

    elements.editBoardName.value = board.name;
    elements.editBoardIcon.value = board.icon || 'dashboard';
    elements.editBoardIconColor.value = board.icon_color || '#3b82f6';

    if (elements.editSelectedIconPreview) {
        elements.editSelectedIconPreview.textContent = normalizeBoardIcon(board.icon || 'dashboard');
        elements.editSelectedIconPreview.style.color = board.icon_color || '#3b82f6';
    }

    document.querySelectorAll('.edit-icon-option').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
        if (btn.dataset.icon === (board.icon || 'dashboard')) {
            btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
        }
    });

    document.querySelectorAll('.edit-color-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === (board.icon_color || '#3b82f6')) {
            btn.classList.add('active');
        }
    });

    if (elements.editIconDropdownMenu) {
        elements.editIconDropdownMenu.classList.add('hidden');
    }

    elements.editBoardModal.classList.remove('hidden');
    elements.editBoardModal.dataset.boardId = boardId;
    setTimeout(() => elements.editBoardName.focus(), 50);
}

export function hideEditBoardModalService({ elements }) {
    elements.editBoardModal.classList.add('hidden');
    if (elements.editIconDropdownMenu) {
        elements.editIconDropdownMenu.classList.add('hidden');
    }
    elements.editBoardName.value = '';
    elements.editBoardModal.dataset.boardId = '';
}

export async function updateBoardService({
    authFetch,
    API_URL,
    getBoards,
    setBoards,
    renderBoardList,
    getActiveBoardId,
    renderBoard,
    showToast
}, boardId, data) {
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        if (!response || !response.ok) {
            throw new Error('Failed to update board');
        }
        const updated = await response.json();
        const nextBoards = [...getBoards()];
        const idx = nextBoards.findIndex(b => b.id === boardId);
        if (idx !== -1) {
            nextBoards[idx] = { ...nextBoards[idx], ...updated };
            setBoards(nextBoards);
        }
        renderBoardList();
        if (getActiveBoardId() === boardId) {
            renderBoard();
        }
        showToast('Board updated successfully', 'success');
    } catch (e) {
        console.error('Error updating board:', e);
        showToast('Failed to update board', 'error');
    }
}
