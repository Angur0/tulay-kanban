export function bindDragDropListeners({
    showInlineAddForm,
    isTaskDragging,
    isColumnDragging,
    handleDragOver,
    handleColumnDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleColumnDrop,
    showColumnContextMenu,
    handleColumnDragStart,
    handleColumnDragEnd
}) {
    document.querySelectorAll('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showInlineAddForm(btn.dataset.columnId);
        });
    });

    document.querySelectorAll('.column-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const columnId = btn.dataset.columnId;
            const menu = document.querySelector(`.column-menu[data-column-id="${columnId}"]`);

            document.querySelectorAll('.column-menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });

            menu.classList.toggle('hidden');
        });
    });

    document.querySelectorAll('.column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            if (isTaskDragging()) {
                handleDragOver(e);
            } else if (isColumnDragging()) {
                handleColumnDragOver(e);
            } else {
                e.preventDefault();
            }
        });
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', (e) => {
            if (isTaskDragging()) {
                handleDrop(e);
            } else if (isColumnDragging()) {
                handleColumnDrop(e);
            }
        });

        column.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.task-card')) return;
            const columnId = column.dataset.columnId;
            if (columnId) showColumnContextMenu(e, columnId);
        });
    });

    document.querySelectorAll('.column-drag-handle').forEach(handle => {
        handle.addEventListener('dragstart', handleColumnDragStart);
        handle.addEventListener('dragend', handleColumnDragEnd);
    });
}
