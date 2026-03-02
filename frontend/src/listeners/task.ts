import type { AppElements, Task } from '../types.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

interface TaskListenerCtx {
    elements: AppElements;
    closeTaskPanel: () => void;
    saveTaskFromPanel: () => void;
    getCurrentEditingTask: () => Task | null;
    showDeleteModal: (task: Task) => void;
    showToast: AnyFn;
    uploadTaskImage: (file: File) => Promise<string | null>;
    renderTaskImages: (images: string[]) => void;
    postComment: () => void;
    uploadCommentImage: (file: File) => Promise<string | null>;
    getCurrentCommentImages: () => string[];
    renderCommentImages: () => void;
    getTaskToDeleteId: () => string | null;
    deleteTask: (id: string) => Promise<void>;
    hideDeleteModal: () => void;
    getActiveInlineForm: () => HTMLElement | null;
    hideInlineAddForm: () => void;
    closeAllColumnMenus: () => void;
    hideTaskContextMenu: () => void;
    hideBoardContextMenu: () => void;
    hideColumnContextMenu: () => void;
    getCurrentContextTask: () => Task | null;
    openTaskPanel: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
}

export function bindTaskListeners(ctx: TaskListenerCtx): void {
    const {
        elements, closeTaskPanel, saveTaskFromPanel, getCurrentEditingTask, showDeleteModal,
        showToast, uploadTaskImage, renderTaskImages, postComment, uploadCommentImage,
        getCurrentCommentImages, renderCommentImages, getTaskToDeleteId, deleteTask,
        hideDeleteModal, getActiveInlineForm, hideInlineAddForm, closeAllColumnMenus,
        hideTaskContextMenu, hideBoardContextMenu, hideColumnContextMenu,
        getCurrentContextTask, openTaskPanel, updateTask,
    } = ctx;

    const isOutsideModalContent = (modalEl: Element | null, target: EventTarget | null): boolean => {
        const modalContent = modalEl?.querySelector('[data-modal-content]');
        if (!modalContent) return false;
        return !modalContent.contains(target as Node);
    };

    elements.closePanelBtn!.addEventListener('click', closeTaskPanel);
    elements.cancelPanelBtn!.addEventListener('click', closeTaskPanel);
    elements.panelOverlay!.addEventListener('click', closeTaskPanel);
    elements.savePanelBtn!.addEventListener('click', saveTaskFromPanel);

    elements.deleteTaskBtn!.addEventListener('click', () => {
        const task = getCurrentEditingTask();
        if (task) showDeleteModal(task);
    });

    elements.panelAddImageBtn!.addEventListener('click', () => elements.panelImageUpload!.click());

    elements.panelImageUpload!.addEventListener('change', async (e) => {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { showToast('Image must be smaller than 5MB', 'error'); input.value = ''; return; }
        const imageUrl = await uploadTaskImage(file);
        const task = getCurrentEditingTask();
        if (imageUrl && task) {
            if (!task.images) task.images = [];
            task.images.push(imageUrl);
            renderTaskImages(task.images);
        }
        input.value = '';
    });

    elements.submitCommentBtn!.addEventListener('click', postComment);
    elements.commentInput!.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) postComment();
    });

    elements.addCommentImageBtn!.addEventListener('click', () => elements.commentImageUpload!.click());
    elements.commentImageUpload!.addEventListener('change', async (e) => {
        const input = e.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length === 0) return;
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) { showToast('Each image must be smaller than 5MB', 'error'); input.value = ''; return; }
        }
        const currentCommentImages = getCurrentCommentImages();
        for (const file of files) {
            const imageUrl = await uploadCommentImage(file);
            if (imageUrl) currentCommentImages.push(imageUrl);
        }
        renderCommentImages();
        input.value = '';
    });

    elements.cancelDeleteBtn!.addEventListener('click', hideDeleteModal);
    elements.confirmDeleteBtn!.addEventListener('click', async () => {
        const taskToDeleteId = getTaskToDeleteId();
        if (taskToDeleteId) { hideDeleteModal(); closeTaskPanel(); await deleteTask(taskToDeleteId); }
    });

    elements.deleteModal!.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); (elements.confirmDeleteBtn as HTMLButtonElement).click(); }
    });
    elements.deleteModal!.addEventListener('click', (e) => {
        if (isOutsideModalContent(elements.deleteModal, e.target)) hideDeleteModal();
    });

    document.addEventListener('click', (e) => {
        const target = e.target as Element;
        const activeInlineForm = getActiveInlineForm();
        if (activeInlineForm && !target.closest('.inline-add-form') && !target.closest('.add-card-btn') && !target.closest('#addTaskBtn')) hideInlineAddForm();
        if (!target.closest('.column-menu') && !target.closest('.column-menu-btn')) closeAllColumnMenus();
        if (!target.closest('#taskContextMenu') && !target.closest('.task-card')) hideTaskContextMenu();
        if (!target.closest('#boardContextMenu')) hideBoardContextMenu();
        if (!target.closest('#columnContextMenu')) hideColumnContextMenu();
    });

    if (elements.contextOpenTask) {
        elements.contextOpenTask.addEventListener('click', () => {
            const task = getCurrentContextTask();
            if (task) { openTaskPanel(task); hideTaskContextMenu(); }
        });
    }
    if (elements.contextPriorityLow) {
        elements.contextPriorityLow.addEventListener('click', () => {
            const task = getCurrentContextTask();
            if (task) { updateTask(task.id, { priority: 'low' }); hideTaskContextMenu(); }
        });
    }
    if (elements.contextPriorityMedium) {
        elements.contextPriorityMedium.addEventListener('click', () => {
            const task = getCurrentContextTask();
            if (task) { updateTask(task.id, { priority: 'medium' }); hideTaskContextMenu(); }
        });
    }
    if (elements.contextPriorityHigh) {
        elements.contextPriorityHigh.addEventListener('click', () => {
            const task = getCurrentContextTask();
            if (task) { updateTask(task.id, { priority: 'high' }); hideTaskContextMenu(); }
        });
    }
    if (elements.contextDeleteTask) {
        elements.contextDeleteTask.addEventListener('click', () => {
            const task = getCurrentContextTask();
            if (task) { showDeleteModal(task); hideTaskContextMenu(); }
        });
    }

    elements.boardView!.addEventListener('wheel', (e) => {
        const target = e.target as Element;
        const taskList = target.closest('.task-list') as HTMLElement | null;
        if (taskList) {
            const canScrollUp = taskList.scrollTop > 0;
            const canScrollDown = taskList.scrollTop < (taskList.scrollHeight - taskList.clientHeight);
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;
            if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) return;
            if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return;
        }
        if (Math.abs(e.deltaX) > 0) { e.preventDefault(); (elements.boardView as HTMLElement).scrollLeft += e.deltaX; }
        else if (Math.abs(e.deltaY) > 0) { e.preventDefault(); (elements.boardView as HTMLElement).scrollLeft += e.deltaY; }
    }, { passive: false });
}
