import type { AppElements, Board } from '../types.ts';

// rome-ignore: context objects use any for broad service compatibility
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface LoadBoardsCtx {
    activeWorkspaceId: string | null;
    authFetch: AnyFn;
    API_URL: string;
    setBoards: (boards: Board[]) => void;
    getActiveBoardId: () => string | null;
    setActiveBoardId: (id: string) => void;
    renderBoardList: () => void;
    showToast: AnyFn;
}
export async function loadBoardsService(ctx: LoadBoardsCtx): Promise<void> {
    const { activeWorkspaceId, authFetch, API_URL, setBoards, getActiveBoardId, setActiveBoardId, renderBoardList, showToast } = ctx;
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

interface CreateBoardCtx {
    activeWorkspaceId: string | null;
    normalizeBoardIcon: (icon?: string | null) => string;
    authFetch: AnyFn;
    API_URL: string;
    setActiveBoardId: (id: string) => void;
    loadBoards: () => Promise<void>;
    renderBoardList: () => void;
    loadColumns: () => Promise<void>;
    loadTasks: () => Promise<void>;
    loadActivities: () => void;
    loadLabels: () => void;
    switchView: (view: string) => void;
    showToast: AnyFn;
    hideCreateBoardModal: () => void;
}
export async function createBoardService(
    ctx: CreateBoardCtx,
    name: string,
    icon = 'dashboard',
    iconColor = '#3b82f6'
): Promise<void> {
    const { activeWorkspaceId, normalizeBoardIcon, authFetch, API_URL, setActiveBoardId, loadBoards, renderBoardList, loadColumns, loadTasks, loadActivities, loadLabels, switchView, showToast, hideCreateBoardModal } = ctx;
    if (!activeWorkspaceId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards`, {
            method: 'POST',
            body: JSON.stringify({ name, icon: normalizeBoardIcon(icon), icon_color: iconColor, workspace_id: activeWorkspaceId }),
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

interface DeleteBoardCtx {
    authFetch: AnyFn;
    API_URL: string;
    getBoards: () => Board[];
    setBoards: (boards: Board[]) => void;
    getActiveBoardId: () => string | null;
    closeTaskPanel: () => void;
    switchBoard: (id: string) => void;
    getWebsocket: () => WebSocket | null;
    setWebsocket: (ws: WebSocket | null) => void;
    setActiveBoardId: (id: string | null) => void;
    setTasks: (tasks: unknown[]) => void;
    setColumns: (columns: unknown[]) => void;
    setKafkaConnected: (connected: boolean) => void;
    updateKafkaStatusUI: () => void;
    renderBoard: () => void;
    renderBoardList: () => void;
    showToast: AnyFn;
    hideDeleteBoardModal: () => void;
}
export async function deleteBoardService(ctx: DeleteBoardCtx, boardId: string): Promise<void> {
    const { authFetch, API_URL, getBoards, setBoards, getActiveBoardId, closeTaskPanel, switchBoard, getWebsocket, setWebsocket, setActiveBoardId, setTasks, setColumns, setKafkaConnected, updateKafkaStatusUI, renderBoard, renderBoardList, showToast, hideDeleteBoardModal } = ctx;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, { method: 'DELETE' });
        if (!response || !response.ok) {
            const errorData = await response?.json().catch(() => ({}));
            throw new Error((errorData as { detail?: string })?.detail || 'Failed to delete board');
        }
        const nextBoards = getBoards().filter(b => b.id !== boardId);
        setBoards(nextBoards);
        if (getActiveBoardId() === boardId) {
            closeTaskPanel();
            if (nextBoards.length > 0) {
                switchBoard(nextBoards[0].id);
            } else {
                const websocket = getWebsocket();
                if (websocket) { websocket.onclose = null; websocket.close(); setWebsocket(null); }
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
        showToast((e as Error).message || 'Failed to delete board', 'error');
    }
}

interface ShowDeleteBoardCtx {
    elements: AppElements;
    setBoardToDeleteId: (id: string | null) => void;
}
export function showDeleteBoardModalService(ctx: ShowDeleteBoardCtx, boardId: string, boardName: string): void {
    const { elements, setBoardToDeleteId } = ctx;
    setBoardToDeleteId(boardId);
    elements.deleteBoardName!.textContent = boardName;
    (elements.deleteBoardConfirmInput as HTMLInputElement).value = '';
    (elements.confirmDeleteBoardBtn as HTMLButtonElement).disabled = true;
    elements.deleteBoardModal!.classList.remove('hidden');
    (elements.deleteBoardConfirmInput as HTMLInputElement).dataset.boardName = boardName;
    setTimeout(() => (elements.deleteBoardConfirmInput as HTMLInputElement).focus(), 100);
}

export function hideDeleteBoardModalService(ctx: ShowDeleteBoardCtx): void {
    const { elements, setBoardToDeleteId } = ctx;
    elements.deleteBoardModal!.classList.add('hidden');
    (elements.deleteBoardConfirmInput as HTMLInputElement).value = '';
    (elements.confirmDeleteBoardBtn as HTMLButtonElement).disabled = true;
    setBoardToDeleteId(null);
}

interface SwitchBoardCtx {
    getActiveBoardId: () => string | null;
    setActiveBoardId: (id: string) => void;
    renderBoardList: () => void;
    loadColumns: () => Promise<void>;
    loadTasks: () => Promise<void>;
    loadActivities: () => void;
    loadLabels: () => void;
    switchView: (view: string) => void;
}
export function switchBoardService(ctx: SwitchBoardCtx, boardId: string): void {
    const { getActiveBoardId, setActiveBoardId, renderBoardList, loadColumns, loadTasks, loadActivities, loadLabels, switchView } = ctx;
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

interface ElemCtx { elements: AppElements; }
export function showCreateBoardModalService({ elements }: ElemCtx): void {
    (elements.newBoardName as HTMLInputElement).value = '';
    if (elements.newBoardIcon) {
        (elements.newBoardIcon as HTMLInputElement).value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            (elements.selectedIconPreview as HTMLElement).style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) {
        (elements.newBoardIconColor as HTMLInputElement).value = '#3b82f6';
        document.querySelectorAll<HTMLElement>('.color-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === '#3b82f6') btn.classList.add('active');
        });
    }
    if (elements.iconDropdownMenu) elements.iconDropdownMenu.classList.add('hidden');
    elements.createBoardModal!.classList.remove('hidden');
    setTimeout(() => (elements.newBoardName as HTMLInputElement).focus(), 50);
}

export function hideCreateBoardModalService({ elements }: ElemCtx): void {
    elements.createBoardModal!.classList.add('hidden');
    if (elements.iconDropdownMenu) elements.iconDropdownMenu.classList.add('hidden');
    (elements.newBoardName as HTMLInputElement).value = '';
    if (elements.newBoardIcon) {
        (elements.newBoardIcon as HTMLInputElement).value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            (elements.selectedIconPreview as HTMLElement).style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) (elements.newBoardIconColor as HTMLInputElement).value = '#3b82f6';
}

interface ShowEditBoardCtx {
    elements: AppElements;
    getBoards: () => Board[];
    normalizeBoardIcon: (icon?: string | null) => string;
}
export function showEditBoardModalService(ctx: ShowEditBoardCtx, boardId: string): void {
    const { elements, getBoards, normalizeBoardIcon } = ctx;
    const board = getBoards().find(b => b.id === boardId) as (Board & { icon_color?: string }) | undefined;
    if (!board) return;
    (elements.editBoardName as HTMLInputElement).value = board.name;
    (elements.editBoardIcon as HTMLInputElement).value = board.icon || 'dashboard';
    (elements.editBoardIconColor as HTMLInputElement).value = board.icon_color || '#3b82f6';
    if (elements.editSelectedIconPreview) {
        elements.editSelectedIconPreview.textContent = normalizeBoardIcon(board.icon || 'dashboard');
        (elements.editSelectedIconPreview as HTMLElement).style.color = board.icon_color || '#3b82f6';
    }
    document.querySelectorAll<HTMLElement>('.edit-icon-option').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
        if (btn.dataset.icon === (board.icon || 'dashboard')) btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
    });
    document.querySelectorAll<HTMLElement>('.edit-color-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === (board.icon_color || '#3b82f6')) btn.classList.add('active');
    });
    if (elements.editIconDropdownMenu) elements.editIconDropdownMenu.classList.add('hidden');
    elements.editBoardModal!.classList.remove('hidden');
    elements.editBoardModal!.dataset.boardId = boardId;
    setTimeout(() => (elements.editBoardName as HTMLInputElement).focus(), 50);
}

export function hideEditBoardModalService({ elements }: ElemCtx): void {
    elements.editBoardModal!.classList.add('hidden');
    if (elements.editIconDropdownMenu) elements.editIconDropdownMenu.classList.add('hidden');
    (elements.editBoardName as HTMLInputElement).value = '';
    elements.editBoardModal!.dataset.boardId = '';
}

interface UpdateBoardCtx {
    authFetch: AnyFn;
    API_URL: string;
    getBoards: () => Board[];
    setBoards: (boards: Board[]) => void;
    renderBoardList: () => void;
    getActiveBoardId: () => string | null;
    renderBoard: () => void;
    showToast: AnyFn;
}
export async function updateBoardService(ctx: UpdateBoardCtx, boardId: string, data: Record<string, unknown>): Promise<void> {
    const { authFetch, API_URL, getBoards, setBoards, renderBoardList, getActiveBoardId, renderBoard, showToast } = ctx;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, { method: 'PUT', body: JSON.stringify(data) });
        if (!response || !response.ok) throw new Error('Failed to update board');
        const updated = await response.json();
        const nextBoards = [...getBoards()];
        const idx = nextBoards.findIndex(b => b.id === boardId);
        if (idx !== -1) { nextBoards[idx] = { ...nextBoards[idx], ...updated }; setBoards(nextBoards); }
        renderBoardList();
        if (getActiveBoardId() === boardId) renderBoard();
        showToast('Board updated successfully', 'success');
    } catch (e) {
        console.error('Error updating board:', e);
        showToast('Failed to update board', 'error');
    }
}
