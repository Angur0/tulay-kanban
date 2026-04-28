<script lang="ts">
    import { columns, setColumns, setTasks, tasks } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { openModal } from "$lib/stores/ui";
    import ColumnComponent from "./Column.svelte";
    import { updateColumn } from "$lib/api/listsApi";
    import { updateTask } from "$lib/api/tasksApi";
    import type { Task } from "$lib/types";

    function showCreateListModal() {
        openModal("createListModal");
    }

    let draggedColumnId: string | null = null;
    let columnDropTargetId: string | null = null;
    let columnDropBefore = false;

    $: canManageColumns = ["owner", "moderator"].includes($currentBoardRole);
    $: orderedColumns = [...$columns].sort((a, b) => {
        const aPos =
            typeof a.position === "number" ? a.position : (a.order ?? 0);
        const bPos =
            typeof b.position === "number" ? b.position : (b.order ?? 0);
        return aPos - bPos;
    });

    async function handleTaskDrop(
        event: CustomEvent<{
            taskId: string;
            fromColumnId: string | null;
            toColumnId: string;
            beforeTaskId: string | null;
        }>,
    ) {
        const { taskId, fromColumnId, toColumnId, beforeTaskId } = event.detail;
        if (!taskId || !toColumnId) return;

        const movingTask = $tasks.find((task) => task.id === taskId);
        if (!movingTask) return;

        const normalizeBeforeTaskId =
            beforeTaskId && beforeTaskId !== taskId ? beforeTaskId : null;

        const sortByOrder = (list: Task[]) =>
            [...list].sort((a, b) => {
                const orderDelta = (a.order ?? 0) - (b.order ?? 0);
                if (orderDelta !== 0) return orderDelta;
                const aCreated = a.created_at
                    ? new Date(a.created_at).getTime()
                    : 0;
                const bCreated = b.created_at
                    ? new Date(b.created_at).getTime()
                    : 0;
                return aCreated - bCreated;
            });

        const pool = $tasks.filter((task) => task.id !== taskId);
        const movedTask = { ...movingTask, column_id: toColumnId };

        const targetList = sortByOrder(
            pool.filter((task) => task.column_id === toColumnId),
        );
        const insertIndex = normalizeBeforeTaskId
            ? targetList.findIndex((task) => task.id === normalizeBeforeTaskId)
            : -1;

        if (insertIndex >= 0) {
            targetList.splice(insertIndex, 0, movedTask);
        } else {
            targetList.push(movedTask);
        }

        const sourceList =
            fromColumnId && fromColumnId !== toColumnId
                ? sortByOrder(
                      pool.filter((task) => task.column_id === fromColumnId),
                  )
                : [];

        const affectedColumnIds = new Set<string>();
        if (fromColumnId) affectedColumnIds.add(fromColumnId);
        affectedColumnIds.add(toColumnId);

        const orderByTaskId = new Map<string, number>();
        for (let index = 0; index < targetList.length; index++) {
            orderByTaskId.set(targetList[index].id, index);
        }
        for (let index = 0; index < sourceList.length; index++) {
            orderByTaskId.set(sourceList[index].id, index);
        }

        const updatedById = new Map<string, Task>();
        for (const task of $tasks) {
            if (task.id === taskId) {
                updatedById.set(task.id, {
                    ...task,
                    column_id: toColumnId,
                    order: orderByTaskId.get(task.id) ?? task.order,
                });
                continue;
            }

            if (
                task.column_id &&
                affectedColumnIds.has(task.column_id) &&
                orderByTaskId.has(task.id)
            ) {
                updatedById.set(task.id, {
                    ...task,
                    order: orderByTaskId.get(task.id) ?? task.order,
                });
                continue;
            }

            updatedById.set(task.id, task);
        }

        const columnIndexById = new Map(
            orderedColumns.map((column, idx) => [column.id, idx]),
        );
        const orderedTasks = [...updatedById.values()].sort((a, b) => {
            const aCol = a.column_id
                ? (columnIndexById.get(a.column_id) ?? Number.MAX_SAFE_INTEGER)
                : Number.MAX_SAFE_INTEGER;
            const bCol = b.column_id
                ? (columnIndexById.get(b.column_id) ?? Number.MAX_SAFE_INTEGER)
                : Number.MAX_SAFE_INTEGER;
            if (aCol !== bCol) return aCol - bCol;
            const orderDelta = (a.order ?? 0) - (b.order ?? 0);
            if (orderDelta !== 0) return orderDelta;
            const aCreated = a.created_at
                ? new Date(a.created_at).getTime()
                : 0;
            const bCreated = b.created_at
                ? new Date(b.created_at).getTime()
                : 0;
            return aCreated - bCreated;
        });

        setTasks(orderedTasks);

        try {
            const updates = orderedTasks
                .filter(
                    (task) =>
                        task.column_id && affectedColumnIds.has(task.column_id),
                )
                .map((task) =>
                    updateTask(
                        task.id,
                        {
                            column_id: task.column_id,
                            order: task.order,
                        },
                        { reload: false },
                    ),
                );
            await Promise.all(updates);
        } catch (e) {
            console.error("Failed to persist task reorder", e);
        }
    }

    function handleColumnDragStart(event: CustomEvent<{ columnId: string }>) {
        draggedColumnId = event.detail.columnId;
    }

    function handleColumnDragEnd() {
        draggedColumnId = null;
        columnDropTargetId = null;
        columnDropBefore = false;
    }

    function handleColumnDragOver(event: DragEvent, targetColumnId: string) {
        const movingColumnId =
            event.dataTransfer?.getData("application/x-column-id") ||
            draggedColumnId;
        if (
            !movingColumnId ||
            movingColumnId === targetColumnId ||
            !canManageColumns
        ) {
            return;
        }

        event.preventDefault();
        const targetRect = (
            event.currentTarget as HTMLElement
        ).getBoundingClientRect();
        columnDropTargetId = targetColumnId;
        columnDropBefore =
            event.clientX < targetRect.left + targetRect.width / 2;
    }

    async function handleColumnDrop(event: DragEvent, targetColumnId: string) {
        const movingColumnId =
            event.dataTransfer?.getData("application/x-column-id") ||
            draggedColumnId;
        if (
            !movingColumnId ||
            movingColumnId === targetColumnId ||
            !canManageColumns
        ) {
            handleColumnDragEnd();
            return;
        }

        event.preventDefault();

        const nextColumns = [...orderedColumns];
        const draggedIndex = nextColumns.findIndex(
            (column) => column.id === movingColumnId,
        );
        const targetIndex = nextColumns.findIndex(
            (column) => column.id === targetColumnId,
        );
        if (draggedIndex === -1 || targetIndex === -1) {
            handleColumnDragEnd();
            return;
        }

        const [moved] = nextColumns.splice(draggedIndex, 1);
        let insertIndex = targetIndex;

        if (!columnDropBefore) {
            insertIndex = targetIndex + 1;
        }
        if (draggedIndex < targetIndex && columnDropBefore) {
            insertIndex = targetIndex - 1;
        }
        if (draggedIndex < targetIndex && !columnDropBefore) {
            insertIndex = targetIndex;
        }

        nextColumns.splice(Math.max(0, insertIndex), 0, moved);
        const normalized = nextColumns.map((column, index) => ({
            ...column,
            position: index,
            order: index,
        }));
        setColumns(normalized);

        try {
            await Promise.all(
                normalized.map((column, index) =>
                    updateColumn(
                        column.id,
                        { position: index },
                        { reload: false },
                    ),
                ),
            );
        } catch (e) {
            console.error("Failed to persist column order", e);
        }

        handleColumnDragEnd();
    }
</script>

<div
    class="flex-1 overflow-x-auto overflow-y-hidden bg-[#f0f2f5] dark:bg-[#0d141c] p-8 custom-scrollbar rounded-tl-2xl"
>
    <div class="flex h-full gap-6 min-w-[900px]" id="board">
        {#if $columns.length === 0}
            <div
                class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]"
            >
                <span class="material-symbols-outlined text-5xl mb-4 opacity-30"
                    >view_week</span
                >
                <p class="text-base font-medium mb-2">No lists yet</p>
                <button
                    on:click={showCreateListModal}
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                    <span class="material-symbols-outlined text-[18px]"
                        >add</span
                    >
                    Create List
                </button>
            </div>
        {/if}

        {#each orderedColumns as col, index}
            <div
                class="relative"
                on:dragover={(event) => handleColumnDragOver(event, col.id)}
                on:drop={(event) => handleColumnDrop(event, col.id)}
            >
                {#if columnDropTargetId === col.id}
                    <div
                        class="absolute top-0 bottom-0 z-10 w-1 bg-primary rounded-full"
                        style={columnDropBefore ? "left:-12px" : "right:-12px"}
                    ></div>
                {/if}
                <ColumnComponent
                    column={col}
                    {index}
                    on:taskDrop={handleTaskDrop}
                    on:columnDragStart={handleColumnDragStart}
                    on:columnDragEnd={handleColumnDragEnd}
                />
            </div>
        {/each}

        <!-- Add List Button -->
        {#if $columns.length > 0 && ["owner", "moderator", "member"].includes($currentBoardRole)}
            <div class="flex-shrink-0 h-full flex items-stretch">
                <button
                    on:click={showCreateListModal}
                    class="flex flex-col items-center justify-center px-4 w-16 bg-white dark:bg-[#1a232e] hover:bg-[#f3f4f6] dark:hover:bg-[#253040] rounded-xl text-[#5c6b7f] dark:text-gray-400 font-medium transition-all shadow-sm border border-transparent hover:border-[#e5e7eb] dark:border-transparent dark:hover:border-[#374151]"
                >
                    <span class="material-symbols-outlined text-2xl">add</span>
                </button>
            </div>
        {/if}
    </div>
</div>
