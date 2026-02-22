export function bindTaskListeners({
    elements,
    closeTaskPanel,
    saveTaskFromPanel,
    getCurrentEditingTask,
    showDeleteModal,
    showToast,
    uploadTaskImage,
    renderTaskImages,
    postComment,
    uploadCommentImage,
    getCurrentCommentImages,
    renderCommentImages,
    getTaskToDeleteId,
    deleteTask,
    hideDeleteModal,
    getActiveInlineForm,
    hideInlineAddForm,
    closeAllColumnMenus,
    hideTaskContextMenu,
    hideBoardContextMenu,
    hideColumnContextMenu,
    getCurrentContextTask,
    openTaskPanel,
    updateTask
}) {
    const isOutsideModalContent = (modalEl, target) => {
        const modalContent = modalEl?.querySelector('[data-modal-content]');
        if (!modalContent) return false;
        return !modalContent.contains(target);
    };

    elements.closePanelBtn.addEventListener('click', closeTaskPanel);
    elements.cancelPanelBtn.addEventListener('click', closeTaskPanel);
    elements.panelOverlay.addEventListener('click', closeTaskPanel);

    elements.savePanelBtn.addEventListener('click', saveTaskFromPanel);

    elements.deleteTaskBtn.addEventListener('click', () => {
        const currentEditingTask = getCurrentEditingTask();
        if (currentEditingTask) {
            showDeleteModal(currentEditingTask);
        }
    });

    elements.panelAddImageBtn.addEventListener('click', () => {
        elements.panelImageUpload.click();
    });

    elements.panelImageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be smaller than 5MB', 'error');
            e.target.value = '';
            return;
        }

        const imageUrl = await uploadTaskImage(file);
        const currentEditingTask = getCurrentEditingTask();
        if (imageUrl && currentEditingTask) {
            if (!currentEditingTask.images) {
                currentEditingTask.images = [];
            }
            currentEditingTask.images.push(imageUrl);
            renderTaskImages(currentEditingTask.images);
        }

        e.target.value = '';
    });

    elements.submitCommentBtn.addEventListener('click', postComment);

    elements.commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            postComment();
        }
    });

    elements.addCommentImageBtn.addEventListener('click', () => {
        elements.commentImageUpload.click();
    });

    elements.commentImageUpload.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                showToast('Each image must be smaller than 5MB', 'error');
                e.target.value = '';
                return;
            }
        }

        const currentCommentImages = getCurrentCommentImages();
        for (const file of files) {
            const imageUrl = await uploadCommentImage(file);
            if (imageUrl) {
                currentCommentImages.push(imageUrl);
            }
        }

        renderCommentImages();
        e.target.value = '';
    });

    elements.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', async () => {
        const taskToDeleteId = getTaskToDeleteId();
        if (taskToDeleteId) {
            hideDeleteModal();
            closeTaskPanel();
            await deleteTask(taskToDeleteId);
        }
    });
    elements.deleteModal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            elements.confirmDeleteBtn.click();
        }
    });

    elements.deleteModal.addEventListener('click', (e) => {
        if (isOutsideModalContent(elements.deleteModal, e.target)) {
            hideDeleteModal();
        }
    });

    document.addEventListener('click', (e) => {
        const activeInlineForm = getActiveInlineForm();
        if (activeInlineForm && !e.target.closest('.inline-add-form') && !e.target.closest('.add-card-btn') && !e.target.closest('#addTaskBtn')) {
            hideInlineAddForm();
        }

        if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-btn')) {
            closeAllColumnMenus();
        }

        if (!e.target.closest('#taskContextMenu') && !e.target.closest('.task-card')) {
            hideTaskContextMenu();
        }

        if (!e.target.closest('#boardContextMenu')) {
            hideBoardContextMenu();
        }

        if (!e.target.closest('#columnContextMenu')) {
            hideColumnContextMenu();
        }
    });

    if (elements.contextOpenTask) {
        elements.contextOpenTask.addEventListener('click', () => {
            const currentContextTask = getCurrentContextTask();
            if (currentContextTask) {
                openTaskPanel(currentContextTask);
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityLow) {
        elements.contextPriorityLow.addEventListener('click', () => {
            const currentContextTask = getCurrentContextTask();
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'low' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityMedium) {
        elements.contextPriorityMedium.addEventListener('click', () => {
            const currentContextTask = getCurrentContextTask();
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'medium' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityHigh) {
        elements.contextPriorityHigh.addEventListener('click', () => {
            const currentContextTask = getCurrentContextTask();
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'high' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextDeleteTask) {
        elements.contextDeleteTask.addEventListener('click', () => {
            const currentContextTask = getCurrentContextTask();
            if (currentContextTask) {
                showDeleteModal(currentContextTask);
                hideTaskContextMenu();
            }
        });
    }

    elements.boardView.addEventListener('wheel', (e) => {
        const taskList = e.target.closest('.task-list');

        if (taskList) {
            const canScrollUp = taskList.scrollTop > 0;
            const canScrollDown = taskList.scrollTop < (taskList.scrollHeight - taskList.clientHeight);
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
                return;
            }

            if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
                return;
            }
        }

        if (Math.abs(e.deltaX) > 0) {
            e.preventDefault();
            elements.boardView.scrollLeft += e.deltaX;
        } else if (Math.abs(e.deltaY) > 0) {
            e.preventDefault();
            elements.boardView.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}
