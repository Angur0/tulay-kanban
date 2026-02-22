export function showCreateListModalService({ elements }) {
    elements.createListModal.classList.remove('hidden');
    elements.newListTitle.value = '';
    elements.newListTitle.focus();
}

export function hideCreateListModalService({ elements }) {
    elements.createListModal.classList.add('hidden');
    elements.newListTitle.value = '';
}

export async function createColumnService({
    elements,
    activeBoardId,
    columns,
    authFetch,
    API_URL,
    hideCreateListModal,
    loadColumns,
    renderBoard,
    showToast
}) {
    const title = elements.newListTitle.value.trim();
    if (!title) return;

    hideCreateListModal();

    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/columns`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                position: columns.length,
                color: 'blue-100'
            })
        });

        if (!response) return;
        await loadColumns();
        renderBoard();
        showToast('List created', 'success');
    } catch (e) {
        console.error('Error creating column:', e);
        showToast('Failed to create list', 'error');
    }
}

export function showDeleteListModalService({
    columns,
    confirmDeleteList,
    hideDeleteListModal
}, columnId) {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const modal = document.getElementById('deleteListModal');
    const listNameEl = document.getElementById('deleteListName');
    const confirmInput = document.getElementById('deleteListConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteListBtn');

    listNameEl.textContent = column.title;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    modal.classList.remove('hidden');

    const inputHandler = () => {
        confirmBtn.disabled = confirmInput.value !== column.title;
    };

    confirmInput.addEventListener('input', inputHandler);

    confirmBtn.onclick = async () => {
        await confirmDeleteList(columnId);
        hideDeleteListModal();
    };

    setTimeout(() => confirmInput.focus(), 100);
}

export function hideDeleteListModalService() {
    const modal = document.getElementById('deleteListModal');
    const confirmInput = document.getElementById('deleteListConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteListBtn');

    modal.classList.add('hidden');
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmBtn.onclick = null;
}

export async function confirmDeleteListService({
    authFetch,
    API_URL,
    loadColumns,
    renderBoard,
    showToast
}, columnId) {
    try {
        const response = await authFetch(`${API_URL}/api/columns/${columnId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadColumns();
            renderBoard();
            showToast('List deleted', 'success');
        } else {
            const data = await response.json();
            showToast(data.detail || 'Failed to delete list', 'error');
        }
    } catch (e) {
        console.error('Error deleting column:', e);
        showToast('Make sure list is empty before deleting', 'error');
    }
}
