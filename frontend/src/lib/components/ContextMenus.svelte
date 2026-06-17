<script lang="ts">
    import { contextMenu, closeContextMenu } from "$lib/stores/context-menu";
    import {
        boards,
        columns,
        setActiveTask,
        setDeleteBoardTarget,
        setDeleteListTarget,
        setEditListTarget,
        setEditBoardTarget,
    } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { openModal } from "$lib/stores/ui";
    import { updateColumn } from "$lib/api/listsApi";
    import { createTask, deleteTask, updateTask } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";

    $: canManageColumns = ["owner", "moderator"].includes($currentBoardRole);

    function clampLeft(x: number, width: number) {
        return Math.max(8, Math.min(x, window.innerWidth - width - 8));
    }

    function clampTop(y: number, height: number) {
        return Math.max(8, Math.min(y, window.innerHeight - height - 8));
    }

    function onEditBoard() {
        if (!$contextMenu?.boardId) return;

        const board = $boards.find((item) => item.id === $contextMenu.boardId);
        if (!board) return;

        setEditBoardTarget(board);
        openModal("editBoardModal");
        closeContextMenu();
    }

    function onDeleteBoard() {
        if (!$contextMenu?.boardId) return;

        const board = $boards.find((item) => item.id === $contextMenu.boardId);
        if (!board) return;

        setDeleteBoardTarget(board);
        openModal("deleteBoardModal");
        closeContextMenu();
    }

    async function onColumnAddTask() {
        if (!$contextMenu?.columnId) return;
        const title = prompt("Task title");
        if (!title?.trim()) return;
        await createTask($contextMenu.columnId, title.trim());
        await loadColumnsAndTasks();
        closeContextMenu();
    }

    async function onColumnRename() {
        if (!$contextMenu?.columnId) return;
        const col = $columns.find(
            (column) => column.id === $contextMenu?.columnId,
        );
        if (!col) return;
        setEditListTarget(col);
        openModal("editListModal");
        closeContextMenu();
    }

    async function onColumnMove(direction: "left" | "right") {
        if (!$contextMenu?.columnId || !canManageColumns) return;

        const ordered = [...$columns].sort((a, b) => a.order - b.order);
        const index = ordered.findIndex(
            (column) => column.id === $contextMenu?.columnId,
        );
        if (index < 0) return;

        const targetIndex = direction === "left" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= ordered.length) return;

        [ordered[index], ordered[targetIndex]] = [
            ordered[targetIndex],
            ordered[index],
        ];
        await Promise.all(
            ordered.map((column, position) =>
                updateColumn(column.id, {
                    position,
                }),
            ),
        );
        await loadColumnsAndTasks();

        closeContextMenu();
    }

    async function onColumnDelete() {
        if (!$contextMenu?.columnId || !canManageColumns) return;

        const column = $columns.find(
            (item) => item.id === $contextMenu.columnId,
        );
        if (!column) return;

        setDeleteListTarget({ id: column.id, title: column.title });
        openModal("deleteListModal");
        closeContextMenu();
    }

    function onOpenTask() {
        if (!$contextMenu?.task) return;
        setActiveTask($contextMenu.task);
        openModal("taskPanel");
        closeContextMenu();
    }

    async function onMoveTask(columnId: string) {
        if (!$contextMenu?.task || $contextMenu.task.column_id === columnId)
            return;
        await updateTask($contextMenu.task.id, { column_id: columnId });
        await loadColumnsAndTasks();
        closeContextMenu();
    }

    async function onPriority(priority: "low" | "medium" | "high") {
        if (!$contextMenu?.task) return;
        await updateTask($contextMenu.task.id, { priority });
        await loadColumnsAndTasks();
        closeContextMenu();
    }

    async function onDeleteTask() {
        if (!$contextMenu?.task) return;
        if (!confirm("Delete this task?")) return;
        await deleteTask($contextMenu.task.id);
        await loadColumnsAndTasks();
        closeContextMenu();
    }
</script>

<svelte:window
    on:mousedown={(e) => {
        if (!$contextMenu) return;
        if (!(e.target as Element).closest("[data-context-menu]")) {
            closeContextMenu();
        }
    }}
    on:keydown={(e) => {
        if (e.key === "Escape") closeContextMenu();
    }}
/>

{#if $contextMenu?.type === "task" && $contextMenu.task}
    <div
        data-context-menu
        class="fixed z-[80] bg-white dark:bg-[#151e29] rounded-lg shadow-2xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-56"
        style="left: {clampLeft($contextMenu.x, 224)}px; top: {clampTop(
            $contextMenu.y,
            420,
        )}px;"
    >
        <button
            on:click={onOpenTask}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px]"
                >open_in_new</span
            >
            Open Details
        </button>
        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>

        <div class="px-3 py-1">
            <p
                class="text-[10px] font-semibold text-[#8a98a8] uppercase tracking-wider"
            >
                Move to
            </p>
        </div>
        {#each $columns as column}
            <button
                on:click={() => onMoveTask(column.id)}
                class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left {$contextMenu
                    .task.column_id === column.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : ''}"
            >
                <span class="material-symbols-outlined text-[18px]"
                    >{$contextMenu.task.column_id === column.id
                        ? "check"
                        : "arrow_forward"}</span
                >
                {column.title}
            </button>
        {/each}

        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
        <div class="px-3 py-1">
            <p
                class="text-[10px] font-semibold text-[#8a98a8] uppercase tracking-wider"
            >
                Priority
            </p>
        </div>
        <button
            on:click={() => onPriority("low")}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px] icon-filled"
                >flag</span
            >
            Low Priority
        </button>
        <button
            on:click={() => onPriority("medium")}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px] icon-filled"
                >flag</span
            >
            Medium Priority
        </button>
        <button
            on:click={() => onPriority("high")}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px] icon-filled"
                >flag</span
            >
            High Priority
        </button>

        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
        <button
            on:click={onDeleteTask}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Delete Task
        </button>
    </div>
{/if}

{#if $contextMenu?.type === "board" && $contextMenu.boardId}
    <div
        data-context-menu
        class="fixed z-[80] bg-white dark:bg-[#151e29] rounded-lg shadow-2xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-48"
        style="left: {clampLeft($contextMenu.x, 192)}px; top: {clampTop(
            $contextMenu.y,
            140,
        )}px;"
    >
        <button
            on:click={onEditBoard}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px]">edit</span>
            Edit Board
        </button>
        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
        <button
            on:click={onDeleteBoard}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Delete Board
        </button>
    </div>
{/if}

{#if $contextMenu?.type === "column" && $contextMenu.columnId}
    <div
        data-context-menu
        class="fixed z-[80] bg-white dark:bg-[#151e29] rounded-lg shadow-2xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-52"
        style="left: {clampLeft($contextMenu.x, 208)}px; top: {clampTop(
            $contextMenu.y,
            260,
        )}px;"
    >
        <button
            on:click={onColumnAddTask}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
        >
            <span class="material-symbols-outlined text-[18px]">add</span>
            Add task
        </button>
        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
        <button
            on:click={onColumnRename}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
            disabled={!canManageColumns}
        >
            <span class="material-symbols-outlined text-[18px]">settings</span>
            List settings
        </button>
        <button
            on:click={() => onColumnMove("left")}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left disabled:opacity-40"
            disabled={!canManageColumns ||
                $columns.findIndex(
                    (column) => column.id === $contextMenu.columnId,
                ) <= 0}
        >
            <span class="material-symbols-outlined text-[18px]">arrow_back</span
            >
            Move left
        </button>
        <button
            on:click={() => onColumnMove("right")}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left disabled:opacity-40"
            disabled={!canManageColumns ||
                $columns.findIndex(
                    (column) => column.id === $contextMenu.columnId,
                ) >=
                    $columns.length - 1}
        >
            <span class="material-symbols-outlined text-[18px]"
                >arrow_forward</span
            >
            Move right
        </button>
        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
        <button
            on:click={onColumnDelete}
            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left disabled:opacity-40"
            disabled={!canManageColumns}
        >
            <span class="material-symbols-outlined text-[18px]">delete</span>
            Delete list
        </button>
    </div>
{/if}
