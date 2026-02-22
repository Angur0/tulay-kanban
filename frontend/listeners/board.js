export function bindBoardListeners({
    elements,
    showCreateListModal,
    switchBoard,
    showDeleteBoardModal,
    toggleBoardsPopout,
    scrollToAddCard,
    moveColumnLeft,
    moveColumnRight,
    editColumnTitle,
    deleteColumn,
    openImageModal,
    removeTaskImage,
    deleteComment,
    removeCommentImage,
    deleteLabel,
    showBoardContextMenu,
    switchView,
    toggleTheme,
    toggleSidebar,
    openLabelManager,
    closeLabelManager,
    createLabel
}) {
    document.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-action]');
        if (!actionElement) return;

        const { action } = actionElement.dataset;

        if (action === 'open-create-board') {
            const createBoardButton = document.getElementById('createBoardBtn');
            if (createBoardButton) {
                createBoardButton.click();
            }
            return;
        }

        if (action === 'open-create-list') {
            showCreateListModal();
            return;
        }

        if (action === 'switch-board') {
            event.preventDefault();
            switchBoard(actionElement.dataset.boardId);
            return;
        }

        if (action === 'delete-board') {
            event.preventDefault();
            event.stopPropagation();
            showDeleteBoardModal(actionElement.dataset.boardId, actionElement.dataset.boardName || '');
            return;
        }

        if (action === 'toggle-boards-popout') {
            event.preventDefault();
            toggleBoardsPopout(event);
            return;
        }

        if (action === 'column-add-card') {
            scrollToAddCard(actionElement.dataset.columnId);
            return;
        }

        if (action === 'column-move-left') {
            if (!actionElement.disabled) {
                moveColumnLeft(actionElement.dataset.columnId);
            }
            return;
        }

        if (action === 'column-move-right') {
            if (!actionElement.disabled) {
                moveColumnRight(actionElement.dataset.columnId);
            }
            return;
        }

        if (action === 'column-rename') {
            editColumnTitle(actionElement.dataset.columnId);
            return;
        }

        if (action === 'column-delete') {
            deleteColumn(actionElement.dataset.columnId);
            return;
        }

        if (action === 'open-image-modal') {
            const imageUrl = actionElement.dataset.imageUrl;
            if (imageUrl) {
                openImageModal(imageUrl);
            }
            return;
        }

        if (action === 'remove-task-image') {
            removeTaskImage(Number(actionElement.dataset.imageIndex));
            return;
        }

        if (action === 'delete-comment') {
            deleteComment(actionElement.dataset.commentId);
            return;
        }

        if (action === 'remove-comment-image') {
            removeCommentImage(Number(actionElement.dataset.imageIndex));
            return;
        }

        if (action === 'label-delete') {
            deleteLabel(actionElement.dataset.labelId);
            return;
        }

        if (action === 'dismiss-toast') {
            const toast = actionElement.closest('div');
            if (toast) {
                toast.remove();
            }
        }
    });

    document.addEventListener('contextmenu', (event) => {
        const boardItem = event.target.closest('[data-board-context="1"]');
        if (!boardItem) return;

        event.preventDefault();
        const boardId = boardItem.dataset.boardId;
        if (boardId) {
            showBoardContextMenu(event, boardId);
        }
    });

    elements.navBoard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('board');
    });

    elements.navActivity.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('activity');
    });

    elements.navMyTasks.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('my-tasks');
    });

    elements.themeToggle.addEventListener('click', toggleTheme);
    elements.sidebarToggle.addEventListener('click', toggleSidebar);

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });

    const labelManagerBtn = document.getElementById('labelManagerBtn');
    if (labelManagerBtn) {
        labelManagerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLabelManager('global');
        });
    }

    const labelCloseBtn = document.getElementById('labelCloseBtn');
    if (labelCloseBtn) {
        labelCloseBtn.addEventListener('click', closeLabelManager);
    }

    const labelCreateBtn = document.getElementById('labelCreateBtn');
    if (labelCreateBtn) {
        labelCreateBtn.addEventListener('click', createLabel);
    }

    document.addEventListener('click', (e) => {
        const popout = document.getElementById('boardsPopout');
        const moreBtn = document.getElementById('boardsMoreBtn');
        if (popout && popout.style.display === 'block' &&
            !popout.contains(e.target) &&
            (!moreBtn || !moreBtn.contains(e.target))) {
            popout.style.display = 'none';
        }
    });

    const panelLabelNew = document.getElementById('panelLabelNew');
    if (panelLabelNew) {
        panelLabelNew.addEventListener('click', () => {
            openLabelManager('board');
        });
    }

    const labelManagerModal = document.getElementById('labelManagerModal');
    if (labelManagerModal) {
        labelManagerModal.addEventListener('click', (e) => {
            if (e.target === labelManagerModal || e.target.classList.contains('bg-gray-900/50')) {
                closeLabelManager();
            }
        });
    }
}
