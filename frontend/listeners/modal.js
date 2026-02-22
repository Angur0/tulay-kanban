export function bindModalListeners({
    elements,
    showCreateBoardModal,
    hideCreateBoardModal,
    createBoard,
    hideCreateListModal,
    showCreateListModal,
    createColumn,
    hideEditBoardModal,
    updateBoard,
    getCurrentContextBoardId,
    showEditBoardModal,
    hideBoardContextMenu,
    getBoards,
    showDeleteBoardModal,
    hideColumnContextMenu,
    getCurrentContextColumnId,
    scrollToAddCard,
    editColumnTitle,
    moveColumnLeft,
    moveColumnRight,
    deleteColumn,
    hideDeleteBoardModal,
    getBoardToDeleteId,
    deleteBoard,
    hideDeleteListModal,
    hideTaskContextMenu,
    closeTaskPanel,
    hideDeleteModal,
    closeLabelManager,
    hideInlineAddForm
}) {
    elements.createBoardBtn.addEventListener('click', showCreateBoardModal);
    elements.cancelCreateBoardBtn.addEventListener('click', hideCreateBoardModal);

    elements.confirmCreateBoardBtn.addEventListener('click', () => {
        const name = elements.newBoardName.value.trim();
        if (name) {
            const iconValue = elements.newBoardIcon?.value || 'dashboard';
            const colorValue = elements.newBoardIconColor?.value || '#3b82f6';
            createBoard(name, iconValue, colorValue);
        }
    });

    elements.cancelCreateListBtn.addEventListener('click', hideCreateListModal);
    elements.confirmCreateListBtn.addEventListener('click', createColumn);

    elements.cancelEditBoardBtn.addEventListener('click', hideEditBoardModal);
    elements.confirmEditBoardBtn.addEventListener('click', () => {
        const boardId = elements.editBoardModal.dataset.boardId;
        const name = elements.editBoardName.value.trim();
        if (boardId && name) {
            const icon = elements.editBoardIcon?.value || 'dashboard';
            const iconColor = elements.editBoardIconColor?.value || '#3b82f6';
            updateBoard(boardId, { name, icon, icon_color: iconColor });
            hideEditBoardModal();
        }
    });

    if (elements.editIconDropdownButton && elements.editIconDropdownMenu) {
        elements.editIconDropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.editIconDropdownMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('.edit-icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.dataset.icon;
                elements.editBoardIcon.value = icon;
                elements.editSelectedIconPreview.textContent = icon;
                document.querySelectorAll('.edit-icon-option').forEach(b => b.classList.remove('bg-blue-100', 'dark:bg-blue-900/30'));
                btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
                elements.editIconDropdownMenu.classList.add('hidden');
            });
        });
    }

    document.querySelectorAll('.edit-color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            elements.editBoardIconColor.value = color;
            elements.editSelectedIconPreview.style.color = color;
            document.querySelectorAll('.edit-color-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    elements.editBoardName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.confirmEditBoardBtn.click();
        }
    });

    elements.editBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.editBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideEditBoardModal();
        }
    });

    if (elements.contextEditBoard) {
        elements.contextEditBoard.addEventListener('click', () => {
            const currentContextBoardId = getCurrentContextBoardId();
            if (currentContextBoardId) {
                showEditBoardModal(currentContextBoardId);
                hideBoardContextMenu();
            }
        });
    }

    if (elements.contextDeleteBoard) {
        elements.contextDeleteBoard.addEventListener('click', () => {
            const currentContextBoardId = getCurrentContextBoardId();
            if (currentContextBoardId) {
                const board = getBoards().find(b => b.id === currentContextBoardId);
                if (board) {
                    showDeleteBoardModal(currentContextBoardId, board.name);
                }
                hideBoardContextMenu();
            }
        });
    }

    if (elements.contextColumnAddTask) {
        elements.contextColumnAddTask.addEventListener('click', () => {
            const currentContextColumnId = getCurrentContextColumnId();
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                scrollToAddCard(id);
            }
        });
    }

    if (elements.contextColumnRename) {
        elements.contextColumnRename.addEventListener('click', () => {
            const currentContextColumnId = getCurrentContextColumnId();
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                editColumnTitle(id);
            }
        });
    }

    if (elements.contextColumnMoveLeft) {
        elements.contextColumnMoveLeft.addEventListener('click', () => {
            const currentContextColumnId = getCurrentContextColumnId();
            if (currentContextColumnId && !elements.contextColumnMoveLeft.disabled) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                moveColumnLeft(id);
            }
        });
    }

    if (elements.contextColumnMoveRight) {
        elements.contextColumnMoveRight.addEventListener('click', () => {
            const currentContextColumnId = getCurrentContextColumnId();
            if (currentContextColumnId && !elements.contextColumnMoveRight.disabled) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                moveColumnRight(id);
            }
        });
    }

    if (elements.contextColumnDelete) {
        elements.contextColumnDelete.addEventListener('click', () => {
            const currentContextColumnId = getCurrentContextColumnId();
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                deleteColumn(id);
            }
        });
    }

    elements.newListTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createColumn();
        }
    });

    elements.cancelDeleteBoardBtn.addEventListener('click', hideDeleteBoardModal);
    elements.deleteBoardConfirmInput.addEventListener('input', () => {
        const boardName = elements.deleteBoardConfirmInput.dataset.boardName;
        elements.confirmDeleteBoardBtn.disabled = elements.deleteBoardConfirmInput.value !== boardName;
    });
    elements.confirmDeleteBoardBtn.addEventListener('click', async () => {
        const boardToDeleteId = getBoardToDeleteId();
        if (boardToDeleteId) {
            await deleteBoard(boardToDeleteId);
        }
    });

    elements.cancelDeleteListBtn.addEventListener('click', hideDeleteListModal);

    elements.createBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.createBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideCreateBoardModal();
        }
    });

    if (elements.iconDropdownButton && elements.iconDropdownMenu) {
        elements.iconDropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.iconDropdownMenu.classList.toggle('hidden');
        });

        const iconOptions = document.querySelectorAll('.icon-option');
        iconOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const icon = option.dataset.icon;

                elements.newBoardIcon.value = icon;
                elements.selectedIconPreview.textContent = icon;
                if (elements.newBoardIconColor) {
                    elements.selectedIconPreview.style.color = elements.newBoardIconColor.value;
                }
                elements.iconDropdownMenu.classList.add('hidden');
            });
        });

        document.addEventListener('click', (e) => {
            if (!elements.iconDropdownButton?.contains(e.target) && !elements.iconDropdownMenu?.contains(e.target)) {
                elements.iconDropdownMenu?.classList.add('hidden');
            }
        });
    }

    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const color = option.dataset.color;

            elements.newBoardIconColor.value = color;

            if (elements.selectedIconPreview) {
                elements.selectedIconPreview.style.color = color;
            }

            colorOptions.forEach(btn => btn.classList.remove('active'));
            option.classList.add('active');
        });
    });

    elements.createListModal.addEventListener('click', (e) => {
        if (e.target === elements.createListModal || e.target.classList.contains('bg-gray-900/50')) {
            hideCreateListModal();
        }
    });

    elements.deleteBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideDeleteBoardModal();
        }
    });

    elements.newBoardName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = elements.newBoardName.value.trim();
            if (name) {
                const iconValue = elements.newBoardIcon?.value || 'dashboard';
                const colorValue = elements.newBoardIconColor?.value || '#3b82f6';
                createBoard(name, iconValue, colorValue);
            }
        } else if (e.key === 'Escape') {
            hideCreateBoardModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.boardContextMenu && !elements.boardContextMenu.classList.contains('hidden')) {
                hideBoardContextMenu();
            } else if (elements.columnContextMenu && !elements.columnContextMenu.classList.contains('hidden')) {
                hideColumnContextMenu();
            } else if (elements.taskContextMenu && !elements.taskContextMenu.classList.contains('hidden')) {
                hideTaskContextMenu();
            } else if (!elements.editBoardModal.classList.contains('hidden')) {
                hideEditBoardModal();
            } else if (!elements.taskPanel.classList.contains('hidden')) {
                closeTaskPanel();
            } else if (!elements.deleteModal.classList.contains('hidden')) {
                hideDeleteModal();
            } else if (!elements.deleteBoardModal.classList.contains('hidden')) {
                hideDeleteBoardModal();
            } else if (!elements.deleteListModal.classList.contains('hidden')) {
                hideDeleteListModal();
            } else if (!elements.createListModal.classList.contains('hidden')) {
                hideCreateListModal();
            } else if (!elements.createBoardModal.classList.contains('hidden')) {
                hideCreateBoardModal();
            } else if (document.getElementById('labelManagerModal') && !document.getElementById('labelManagerModal').classList.contains('hidden')) {
                closeLabelManager();
            } else {
                hideInlineAddForm();
            }
        }
    });
}
