import type { AppElements, Board, Task } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface ModalListenerCtx {
    elements: AppElements;
    showCreateBoardModal: () => void;
    hideCreateBoardModal: () => void;
    createBoard: (name: string, icon: string, color: string) => void;
    hideCreateListModal: () => void;
    showCreateListModal: () => void;
    createColumn: () => void;
    hideEditBoardModal: () => void;
    updateBoard: (id: string, data: Record<string, unknown>) => void;
    getCurrentContextBoardId: () => string | null;
    showEditBoardModal: (id: string) => void;
    hideBoardContextMenu: () => void;
    getBoards: () => Board[];
    showDeleteBoardModal: (id: string, name: string) => void;
    hideColumnContextMenu: () => void;
    getCurrentContextColumnId: () => string | null;
    scrollToAddCard: (id: string) => void;
    editColumnTitle: (id: string) => void;
    moveColumnLeft: (id: string) => void;
    moveColumnRight: (id: string) => void;
    deleteColumn: (id: string) => void;
    hideDeleteBoardModal: () => void;
    getBoardToDeleteId: () => string | null;
    deleteBoard: (id: string) => Promise<void>;
    hideDeleteListModal: () => void;
    hideTaskContextMenu: () => void;
    closeTaskPanel: () => void;
    hideDeleteModal: () => void;
    closeLabelManager: () => void;
    hideInlineAddForm: () => void;
}

export function bindModalListeners(ctx: ModalListenerCtx): void {
    const {
        elements, showCreateBoardModal, hideCreateBoardModal, createBoard,
        hideCreateListModal, createColumn, hideEditBoardModal, updateBoard,
        getCurrentContextBoardId, showEditBoardModal, hideBoardContextMenu, getBoards,
        showDeleteBoardModal, hideColumnContextMenu, getCurrentContextColumnId,
        scrollToAddCard, editColumnTitle, moveColumnLeft, moveColumnRight, deleteColumn,
        hideDeleteBoardModal, getBoardToDeleteId, deleteBoard, hideDeleteListModal,
        hideTaskContextMenu, closeTaskPanel, hideDeleteModal, closeLabelManager, hideInlineAddForm,
    } = ctx;

    const isOutsideModalContent = (modalEl: Element | null, target: EventTarget | null): boolean => {
        const modalContent = modalEl?.querySelector('[data-modal-content]');
        if (!modalContent) return false;
        return !modalContent.contains(target as Node);
    };

    elements.createBoardBtn!.addEventListener('click', showCreateBoardModal);
    elements.cancelCreateBoardBtn!.addEventListener('click', hideCreateBoardModal);

    elements.confirmCreateBoardBtn!.addEventListener('click', () => {
        const name = (elements.newBoardName as HTMLInputElement).value.trim();
        if (name) {
            const iconValue = (elements.newBoardIcon as HTMLInputElement)?.value || 'dashboard';
            const colorValue = (elements.newBoardIconColor as HTMLInputElement)?.value || '#3b82f6';
            hideCreateBoardModal();
            createBoard(name, iconValue, colorValue);
        }
    });

    elements.cancelCreateListBtn!.addEventListener('click', hideCreateListModal);
    elements.confirmCreateListBtn!.addEventListener('click', createColumn);

    elements.cancelEditBoardBtn!.addEventListener('click', hideEditBoardModal);
    elements.confirmEditBoardBtn!.addEventListener('click', () => {
        const boardId = (elements.editBoardModal as HTMLElement).dataset.boardId;
        const name = (elements.editBoardName as HTMLInputElement).value.trim();
        if (boardId && name) {
            const icon = (elements.editBoardIcon as HTMLInputElement)?.value || 'dashboard';
            const iconColor = (elements.editBoardIconColor as HTMLInputElement)?.value || '#3b82f6';
            updateBoard(boardId, { name, icon, icon_color: iconColor });
            hideEditBoardModal();
        }
    });

    if (elements.editIconDropdownButton && elements.editIconDropdownMenu) {
        elements.editIconDropdownButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            elements.editIconDropdownMenu!.classList.toggle('hidden');
        });
        document.querySelectorAll<HTMLElement>('.edit-icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.dataset.icon!;
                (elements.editBoardIcon as HTMLInputElement).value = icon;
                elements.editSelectedIconPreview!.textContent = icon;
                document.querySelectorAll('.edit-icon-option').forEach(b => b.classList.remove('bg-blue-100', 'dark:bg-blue-900/30'));
                btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
                elements.editIconDropdownMenu!.classList.add('hidden');
            });
        });
    }

    document.querySelectorAll<HTMLElement>('.edit-color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color!;
            (elements.editBoardIconColor as HTMLInputElement).value = color;
            (elements.editSelectedIconPreview as HTMLElement).style.color = color;
            document.querySelectorAll('.edit-color-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    (elements.editBoardName as HTMLInputElement).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') (elements.confirmEditBoardBtn as HTMLButtonElement).click();
    });
    elements.editBoardModal!.addEventListener('click', (e) => {
        if (isOutsideModalContent(elements.editBoardModal, e.target)) hideEditBoardModal();
    });

    if (elements.contextEditBoard) {
        elements.contextEditBoard.addEventListener('click', () => {
            const id = getCurrentContextBoardId();
            if (id) { showEditBoardModal(id); hideBoardContextMenu(); }
        });
    }
    if (elements.contextDeleteBoard) {
        elements.contextDeleteBoard.addEventListener('click', () => {
            const id = getCurrentContextBoardId();
            if (id) {
                const board = getBoards().find(b => b.id === id);
                if (board) showDeleteBoardModal(id, board.name);
                hideBoardContextMenu();
            }
        });
    }

    if (elements.contextColumnAddTask) {
        elements.contextColumnAddTask.addEventListener('click', () => {
            const id = getCurrentContextColumnId();
            if (id) { hideColumnContextMenu(); scrollToAddCard(id); }
        });
    }
    if (elements.contextColumnRename) {
        elements.contextColumnRename.addEventListener('click', () => {
            const id = getCurrentContextColumnId();
            if (id) { hideColumnContextMenu(); editColumnTitle(id); }
        });
    }
    if (elements.contextColumnMoveLeft) {
        elements.contextColumnMoveLeft.addEventListener('click', () => {
            const id = getCurrentContextColumnId();
            if (id && !(elements.contextColumnMoveLeft as HTMLButtonElement).disabled) { hideColumnContextMenu(); moveColumnLeft(id); }
        });
    }
    if (elements.contextColumnMoveRight) {
        elements.contextColumnMoveRight.addEventListener('click', () => {
            const id = getCurrentContextColumnId();
            if (id && !(elements.contextColumnMoveRight as HTMLButtonElement).disabled) { hideColumnContextMenu(); moveColumnRight(id); }
        });
    }
    if (elements.contextColumnDelete) {
        elements.contextColumnDelete.addEventListener('click', () => {
            const id = getCurrentContextColumnId();
            if (id) { hideColumnContextMenu(); deleteColumn(id); }
        });
    }

    (elements.newListTitle as HTMLInputElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') createColumn();
    });

    elements.cancelDeleteBoardBtn!.addEventListener('click', hideDeleteBoardModal);
    (elements.deleteBoardConfirmInput as HTMLInputElement).addEventListener('input', () => {
        const boardName = (elements.deleteBoardConfirmInput as HTMLInputElement).dataset.boardName;
        (elements.confirmDeleteBoardBtn as HTMLButtonElement).disabled = (elements.deleteBoardConfirmInput as HTMLInputElement).value !== boardName;
    });
    (elements.deleteBoardConfirmInput as HTMLInputElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !(elements.confirmDeleteBoardBtn as HTMLButtonElement).disabled) { e.preventDefault(); (elements.confirmDeleteBoardBtn as HTMLButtonElement).click(); }
    });
    elements.confirmDeleteBoardBtn!.addEventListener('click', async () => {
        const id = getBoardToDeleteId();
        if (id) { hideDeleteBoardModal(); await deleteBoard(id); }
    });

    elements.cancelDeleteListBtn!.addEventListener('click', hideDeleteListModal);
    (elements.deleteListConfirmInput as HTMLInputElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !(elements.confirmDeleteListBtn as HTMLButtonElement).disabled) { e.preventDefault(); (elements.confirmDeleteListBtn as HTMLButtonElement).click(); }
    });

    elements.createBoardModal!.addEventListener('click', (e) => { if (isOutsideModalContent(elements.createBoardModal, e.target)) hideCreateBoardModal(); });
    if (elements.iconDropdownButton && elements.iconDropdownMenu) {
        elements.iconDropdownButton.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); elements.iconDropdownMenu!.classList.toggle('hidden'); });
        document.querySelectorAll<HTMLElement>('.icon-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const icon = option.dataset.icon!;
                (elements.newBoardIcon as HTMLInputElement).value = icon;
                elements.selectedIconPreview!.textContent = icon;
                if (elements.newBoardIconColor) (elements.selectedIconPreview as HTMLElement).style.color = (elements.newBoardIconColor as HTMLInputElement).value;
                elements.iconDropdownMenu!.classList.add('hidden');
            });
        });
        document.addEventListener('click', (e) => {
            const target = e.target as Node;
            if (!elements.iconDropdownButton?.contains(target) && !elements.iconDropdownMenu?.contains(target)) elements.iconDropdownMenu?.classList.add('hidden');
        });
    }

    document.querySelectorAll<HTMLElement>('.color-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const color = option.dataset.color!;
            (elements.newBoardIconColor as HTMLInputElement).value = color;
            if (elements.selectedIconPreview) (elements.selectedIconPreview as HTMLElement).style.color = color;
            document.querySelectorAll('.color-option').forEach(btn => btn.classList.remove('active'));
            option.classList.add('active');
        });
    });

    elements.createListModal!.addEventListener('click', (e) => { if (isOutsideModalContent(elements.createListModal, e.target)) hideCreateListModal(); });
    elements.deleteBoardModal!.addEventListener('click', (e) => { if (isOutsideModalContent(elements.deleteBoardModal, e.target)) hideDeleteBoardModal(); });
    elements.deleteListModal!.addEventListener('click', (e) => { if (isOutsideModalContent(elements.deleteListModal, e.target)) hideDeleteListModal(); });

    (elements.newBoardName as HTMLInputElement).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = (elements.newBoardName as HTMLInputElement).value.trim();
            if (name) { const icon = (elements.newBoardIcon as HTMLInputElement)?.value || 'dashboard'; const color = (elements.newBoardIconColor as HTMLInputElement)?.value || '#3b82f6'; hideCreateBoardModal(); createBoard(name, icon, color); }
        } else if (e.key === 'Escape') { hideCreateBoardModal(); }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.boardContextMenu && !elements.boardContextMenu.classList.contains('hidden')) { hideBoardContextMenu(); }
            else if (elements.columnContextMenu && !elements.columnContextMenu.classList.contains('hidden')) { hideColumnContextMenu(); }
            else if (elements.taskContextMenu && !elements.taskContextMenu.classList.contains('hidden')) { hideTaskContextMenu(); }
            else if (!elements.editBoardModal!.classList.contains('hidden')) { hideEditBoardModal(); }
            else if (!elements.taskPanel!.classList.contains('hidden')) { closeTaskPanel(); }
            else if (!elements.deleteModal!.classList.contains('hidden')) { hideDeleteModal(); }
            else if (!elements.deleteBoardModal!.classList.contains('hidden')) { hideDeleteBoardModal(); }
            else if (!elements.deleteListModal!.classList.contains('hidden')) { hideDeleteListModal(); }
            else if (!elements.createListModal!.classList.contains('hidden')) { hideCreateListModal(); }
            else if (!elements.createBoardModal!.classList.contains('hidden')) { hideCreateBoardModal(); }
            else {
                const lm = document.getElementById('labelManagerModal');
                if (lm && !lm.classList.contains('hidden')) { closeLabelManager(); }
                else { hideInlineAddForm(); }
            }
        }
    });
}
