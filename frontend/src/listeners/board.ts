import type { AppElements, Task } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface BoardListenerCtx {
    elements: AppElements;
    showCreateListModal: () => void;
    switchBoard: (id: string) => void;
    showDeleteBoardModal: (id: string, name: string) => void;
    toggleBoardsPopout: (e: Event) => void;
    scrollToAddCard: (columnId: string) => void;
    moveColumnLeft: (columnId: string) => void;
    moveColumnRight: (columnId: string) => void;
    editColumnTitle: (columnId: string) => void;
    deleteColumn: (columnId: string) => void;
    openImageModal: (url: string) => void;
    removeTaskImage: (index: number) => void;
    deleteComment: (commentId: string) => void;
    removeCommentImage: (index: number) => void;
    deleteLabel: (labelId: string) => void;
    showBoardContextMenu: (e: MouseEvent, boardId: string) => void;
    switchView: (view: string) => void;
    toggleTheme: () => void;
    toggleSidebar: () => void;
    openLabelManager: (scope: string) => void;
    closeLabelManager: () => void;
    createLabel: () => void;
}
export function bindBoardListeners(ctx: BoardListenerCtx): void {
    const {
        elements, showCreateListModal, switchBoard, showDeleteBoardModal,
        toggleBoardsPopout, scrollToAddCard, moveColumnLeft, moveColumnRight,
        editColumnTitle, deleteColumn, openImageModal, removeTaskImage, deleteComment,
        removeCommentImage, deleteLabel, showBoardContextMenu, switchView,
        toggleTheme, toggleSidebar, openLabelManager, closeLabelManager, createLabel,
    } = ctx;

    document.addEventListener('click', (event) => {
        const target = event.target as Element;
        const actionElement = target.closest('[data-action]') as HTMLElement | null;
        if (!actionElement) return;
        const action = actionElement.dataset.action;

        if (action === 'open-create-board') { (document.getElementById('createBoardBtn') as HTMLButtonElement)?.click(); return; }
        if (action === 'open-create-list') { showCreateListModal(); return; }
        if (action === 'switch-board') { event.preventDefault(); switchBoard(actionElement.dataset.boardId!); return; }
        if (action === 'delete-board') { event.preventDefault(); event.stopPropagation(); showDeleteBoardModal(actionElement.dataset.boardId!, actionElement.dataset.boardName || ''); return; }
        if (action === 'toggle-boards-popout') { event.preventDefault(); toggleBoardsPopout(event); return; }
        if (action === 'column-add-card') { scrollToAddCard(actionElement.dataset.columnId!); return; }
        if (action === 'column-move-left') { if (!(actionElement as HTMLButtonElement).disabled) moveColumnLeft(actionElement.dataset.columnId!); return; }
        if (action === 'column-move-right') { if (!(actionElement as HTMLButtonElement).disabled) moveColumnRight(actionElement.dataset.columnId!); return; }
        if (action === 'column-rename') { editColumnTitle(actionElement.dataset.columnId!); return; }
        if (action === 'column-delete') { deleteColumn(actionElement.dataset.columnId!); return; }
        if (action === 'open-image-modal') { const url = actionElement.dataset.imageUrl; if (url) openImageModal(url); return; }
        if (action === 'remove-task-image') { removeTaskImage(Number(actionElement.dataset.imageIndex)); return; }
        if (action === 'delete-comment') { deleteComment(actionElement.dataset.commentId!); return; }
        if (action === 'remove-comment-image') { removeCommentImage(Number(actionElement.dataset.imageIndex)); return; }
        if (action === 'label-delete') { deleteLabel(actionElement.dataset.labelId!); return; }
        if (action === 'dismiss-toast') { const toast = actionElement.closest('div'); if (toast) toast.remove(); }
    });

    document.addEventListener('contextmenu', (event) => {
        const target = event.target as Element;
        const boardItem = target.closest('[data-board-context="1"]') as HTMLElement | null;
        if (!boardItem) return;
        event.preventDefault();
        const boardId = boardItem.dataset.boardId;
        if (boardId) showBoardContextMenu(event as MouseEvent, boardId);
    });

    elements.navBoard!.addEventListener('click', (e) => { e.preventDefault(); switchView('board'); });
    elements.navActivity!.addEventListener('click', (e) => { e.preventDefault(); switchView('activity'); });
    elements.navMyTasks!.addEventListener('click', (e) => { e.preventDefault(); switchView('my-tasks'); });
    elements.themeToggle!.addEventListener('click', toggleTheme);
    elements.sidebarToggle!.addEventListener('click', toggleSidebar);

    (document.getElementById('logoutBtn') as HTMLButtonElement).addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });

    const labelManagerBtn = document.getElementById('labelManagerBtn');
    if (labelManagerBtn) labelManagerBtn.addEventListener('click', (e) => { e.preventDefault(); openLabelManager('global'); });
    const labelCloseBtn = document.getElementById('labelCloseBtn');
    if (labelCloseBtn) labelCloseBtn.addEventListener('click', closeLabelManager);
    const labelCreateBtn = document.getElementById('labelCreateBtn');
    if (labelCreateBtn) labelCreateBtn.addEventListener('click', createLabel);

    document.addEventListener('click', (e) => {
        const target = e.target as Node;
        const popout = document.getElementById('boardsPopout');
        const moreBtn = document.getElementById('boardsMoreBtn');
        if (popout && popout.style.display === 'block' && !popout.contains(target) && (!moreBtn || !moreBtn.contains(target))) {
            popout.style.display = 'none';
        }
    });

    const panelLabelNew = document.getElementById('panelLabelNew');
    if (panelLabelNew) panelLabelNew.addEventListener('click', () => openLabelManager('board'));

    const labelManagerModal = document.getElementById('labelManagerModal');
    if (labelManagerModal) {
        labelManagerModal.addEventListener('click', (e) => {
            const target = e.target as Element;
            if (e.target === labelManagerModal || target.classList.contains('bg-gray-900/50')) closeLabelManager();
        });
    }
}
