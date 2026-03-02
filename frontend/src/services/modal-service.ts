import type { AppElements, Column } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface ElemCtx { elements: AppElements; }

export function showCreateListModalService({ elements }: ElemCtx): void {
    elements.createListModal!.classList.remove('hidden');
    (elements.newListTitle as HTMLInputElement).value = '';
    (elements.newListTitle as HTMLInputElement).focus();
}

export function hideCreateListModalService({ elements }: ElemCtx): void {
    elements.createListModal!.classList.add('hidden');
    (elements.newListTitle as HTMLInputElement).value = '';
}

interface CreateColumnCtx {
    elements: AppElements;
    activeBoardId: string | null;
    columns: Column[];
    authFetch: AnyFn;
    API_URL: string;
    hideCreateListModal: () => void;
    loadColumns: () => Promise<void>;
    renderBoard: () => void;
    showToast: AnyFn;
}
export async function createColumnService(ctx: CreateColumnCtx): Promise<void> {
    const { elements, activeBoardId, columns, authFetch, API_URL, hideCreateListModal, loadColumns, renderBoard, showToast } = ctx;
    const title = (elements.newListTitle as HTMLInputElement).value.trim();
    if (!title) return;
    hideCreateListModal();
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/columns`, {
            method: 'POST',
            body: JSON.stringify({ title, position: columns.length, color: 'blue-100' }),
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

interface ShowDeleteListCtx {
    columns: Column[];
    confirmDeleteList: (columnId: string) => Promise<void>;
    hideDeleteListModal: () => void;
}
export function showDeleteListModalService(ctx: ShowDeleteListCtx, columnId: string): void {
    const { columns, confirmDeleteList, hideDeleteListModal } = ctx;
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const modal = document.getElementById('deleteListModal');
    const listNameEl = document.getElementById('deleteListName');
    const confirmInput = document.getElementById('deleteListConfirmInput') as HTMLInputElement;
    const confirmBtn = document.getElementById('confirmDeleteListBtn') as HTMLButtonElement;

    listNameEl!.textContent = column.title;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    modal!.classList.remove('hidden');

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

export function hideDeleteListModalService(): void {
    const modal = document.getElementById('deleteListModal');
    const confirmInput = document.getElementById('deleteListConfirmInput') as HTMLInputElement;
    const confirmBtn = document.getElementById('confirmDeleteListBtn') as HTMLButtonElement;

    modal!.classList.add('hidden');
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmBtn.onclick = null;
}

interface ConfirmDeleteListCtx {
    authFetch: AnyFn;
    API_URL: string;
    loadColumns: () => Promise<void>;
    renderBoard: () => void;
    showToast: AnyFn;
}
export async function confirmDeleteListService(ctx: ConfirmDeleteListCtx, columnId: string): Promise<void> {
    const { authFetch, API_URL, loadColumns, renderBoard, showToast } = ctx;
    try {
        const response = await authFetch(`${API_URL}/api/columns/${columnId}`, { method: 'DELETE' });
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
