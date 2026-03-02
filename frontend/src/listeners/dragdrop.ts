interface DragDropListenerCtx {
    showInlineAddForm: (columnId: string) => void;
    isTaskDragging: () => boolean;
    isColumnDragging: () => boolean;
    handleDragOver: (e: DragEvent) => void;
    handleColumnDragOver: (e: DragEvent) => void;
    handleDragEnter: (e: DragEvent) => void;
    handleDragLeave: (e: DragEvent) => void;
    handleDrop: (e: DragEvent) => void;
    handleColumnDrop: (e: DragEvent) => void;
    showColumnContextMenu: (e: MouseEvent, columnId: string) => void;
    handleColumnDragStart: (e: DragEvent) => void;
    handleColumnDragEnd: () => void;
}

export function bindDragDropListeners(ctx: DragDropListenerCtx): void {
    const {
        showInlineAddForm, isTaskDragging, isColumnDragging,
        handleDragOver, handleColumnDragOver, handleDragEnter, handleDragLeave,
        handleDrop, handleColumnDrop, showColumnContextMenu,
        handleColumnDragStart, handleColumnDragEnd,
    } = ctx;

    document.querySelectorAll<HTMLButtonElement>('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', () => showInlineAddForm(btn.dataset.columnId!));
    });

    document.querySelectorAll<HTMLButtonElement>('.column-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const columnId = btn.dataset.columnId;
            const menu = document.querySelector<HTMLElement>(`.column-menu[data-column-id="${columnId}"]`);
            document.querySelectorAll('.column-menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
            menu?.classList.toggle('hidden');
        });
    });

    document.querySelectorAll<HTMLElement>('.column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            if (isTaskDragging()) handleDragOver(e as DragEvent);
            else if (isColumnDragging()) handleColumnDragOver(e as DragEvent);
            else e.preventDefault();
        });
        column.addEventListener('dragenter', (e) => handleDragEnter(e as DragEvent));
        column.addEventListener('dragleave', (e) => handleDragLeave(e as DragEvent));
        column.addEventListener('drop', (e) => {
            if (isTaskDragging()) handleDrop(e as DragEvent);
            else if (isColumnDragging()) handleColumnDrop(e as DragEvent);
        });
        column.addEventListener('contextmenu', (e) => {
            const target = e.target as Element;
            if (target.closest('.task-card')) return;
            const columnId = column.dataset.columnId;
            if (columnId) showColumnContextMenu(e as MouseEvent, columnId);
        });
    });

    document.querySelectorAll<HTMLElement>('.column-drag-handle').forEach(handle => {
        handle.addEventListener('dragstart', (e) => handleColumnDragStart(e as DragEvent));
        handle.addEventListener('dragend', () => handleColumnDragEnd());
    });
}
