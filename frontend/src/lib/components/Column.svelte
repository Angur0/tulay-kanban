<script lang="ts">
    import type { Column } from "$lib/types";
    import {
        columns,
        labels,
        setColumns,
        setDeleteListTarget,
        filteredTasksByColumn,
    } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { columnColorClasses } from "$lib/constants";
    import TaskCard from "./TaskCard.svelte";
    import { openModal, createTaskInitialData } from "$lib/stores/ui";
    import { updateColumn } from "$lib/api/listsApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import { openContextMenu } from "$lib/stores/context-menu";
    import { createEventDispatcher, onMount, onDestroy } from "svelte";
    import { touchDrag } from "$lib/stores/touch-drag";
    import { authFetch } from "$lib/api";
    import { API_URL } from "$lib/constants";

    const dispatch = createEventDispatcher<{
        taskDrop: {
            taskId: string;
            fromColumnId: string | null;
            toColumnId: string;
            beforeTaskId: string | null;
        };
        columnDragStart: { columnId: string };
        columnDragEnd: undefined;
    }>();

    export let column: Column;
    export let index: number;

    let isMenuOpen = false;

    let isTaskDragOver = false;
    let taskDropIndex: number | null = null;
    let isRenaming = false;
    let editingTitle = "";
    let menuContainerEl: HTMLElement | null = null;
    let columnEl: HTMLElement | null = null;

    let isBulkCreating = false;
    let bulkCreateText = "";
    let isBulkMoving = false;
    let bulkMoveDestColumnId = "";
    let isBulkDeleting = false;

    function handleBulkCreate() {
        isBulkCreating = true;
        isMenuOpen = false;
    }

    async function submitBulkCreate() {
        const titles = bulkCreateText
            .split("\n")
            .map(t => t.trim())
            .filter(t => t.length > 0);
        if (titles.length === 0) {
            isBulkCreating = false;
            return;
        }

        try {
            const res = await authFetch(`${API_URL}/api/columns/${column.id}/tasks/bulk-create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ titles })
            });
            if (res && res.ok) {
                await loadColumnsAndTasks();
            }
        } catch (e) {
            console.error("Failed bulk create", e);
        }

        isBulkCreating = false;
        bulkCreateText = "";
    }

    function handleBulkMove() {
        isBulkMoving = true;
        isMenuOpen = false;
    }

    async function submitBulkMove() {
        if (!bulkMoveDestColumnId) return;
        try {
            const res = await authFetch(`${API_URL}/api/columns/${column.id}/tasks/bulk-move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ destination_column_id: bulkMoveDestColumnId })
            });
            if (res && res.ok) {
                await loadColumnsAndTasks();
            }
        } catch (e) {
            console.error("Failed bulk move", e);
        }
        isBulkMoving = false;
        bulkMoveDestColumnId = "";
    }

    function handleBulkDelete() {
        if (!canDeleteTasks) return;
        isBulkDeleting = true;
        isMenuOpen = false;
    }

    async function submitBulkDelete() {
        try {
            const res = await authFetch(`${API_URL}/api/columns/${column.id}/tasks/bulk-delete`, {
                method: "POST"
            });
            if (res && res.ok) {
                await loadColumnsAndTasks();
            }
        } catch (e) {
            console.error("Failed bulk delete", e);
        }
        isBulkDeleting = false;
    }

    // Touch drag state — computed from the global touch-drag store
    let touchDropIndex: number | null = null;
    let isTouchDragOver = false;

    $: {
        const td = $touchDrag;
        if (td.active && columnEl) {
            const rect = columnEl.getBoundingClientRect();
            const inside =
                td.x >= rect.left &&
                td.x <= rect.right &&
                td.y >= rect.top &&
                td.y <= rect.bottom;
            isTouchDragOver = inside;
            if (inside) {
                // Figure out which task slot the pointer is hovering over
                const cards = Array.from(
                    columnEl.querySelectorAll<HTMLElement>(".task-card")
                );
                let found = false;
                for (let i = 0; i < cards.length; i++) {
                    const r = cards[i].getBoundingClientRect();
                    if (td.y < r.top + r.height / 2) {
                        touchDropIndex = i;
                        found = true;
                        break;
                    }
                }
                if (!found) touchDropIndex = columnTasks.length;
            } else {
                touchDropIndex = null;
            }
        } else {
            isTouchDragOver = false;
            touchDropIndex = null;
        }
    }

    // We track the last known drag info before commitTouchDrop() clears the store.
    // Using $: here so Svelte auto-manages the subscription lifetime.
    let _lastTouchDragSnapshot = { taskId: "", fromColumnId: "" };
    $: if ($touchDrag.active) {
        _lastTouchDragSnapshot = {
            taskId: $touchDrag.taskId ?? "",
            fromColumnId: $touchDrag.fromColumnId ?? "",
        };
    }

    function handleTouchDrop(x: number, y: number) {
        if (!isTouchDragOver || !columnEl) return;
        const { taskId, fromColumnId } = _lastTouchDragSnapshot;
        if (!taskId) return;

        const beforeTaskId =
            touchDropIndex !== null &&
            touchDropIndex >= 0 &&
            touchDropIndex < columnTasks.length
                ? columnTasks[touchDropIndex].id
                : null;

        dispatch("taskDrop", {
            taskId,
            fromColumnId: fromColumnId || null,
            toColumnId: column.id,
            beforeTaskId,
        });
        isTouchDragOver = false;
        touchDropIndex = null;
    }

    function onWindowTouchDrop(event: Event) {
        const e = event as CustomEvent<{ x: number; y: number }>;
        handleTouchDrop(e.detail.x, e.detail.y);
    }

    onMount(() => {
        window.addEventListener("touch-task-drop", onWindowTouchDrop);
    });
    onDestroy(() => {
        window.removeEventListener("touch-task-drop", onWindowTouchDrop);
    });

    $: columnTasks = $filteredTasksByColumn[column.id] || [];
    $: colorClass = columnColorClasses[index % columnColorClasses.length];
    $: canManage = ["owner", "moderator"].includes($currentBoardRole);
    $: canAdd = ["owner", "editor", "moderator", "member"].includes($currentBoardRole);
    $: canDeleteTasks = ["owner", "editor"].includes($currentBoardRole);

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    $: orderedColumns = [...$columns].sort((a, b) => {
        const aPos = typeof a.position === "number" ? a.position : a.order ?? 0;
        const bPos = typeof b.position === "number" ? b.position : b.order ?? 0;
        return aPos - bPos;
    });

    async function persistColumnOrder(nextColumns: Column[]) {
        const normalized = nextColumns.map((col, idx) => ({
            ...col,
            position: idx,
            order: idx,
        }));

        setColumns(normalized);
        try {
            await Promise.all(
                normalized.map((col, idx) =>
                    updateColumn(col.id, { position: idx }, { reload: false })
                )
            );
        } catch (e) {
            console.error("Failed to persist column order", e);
        }
    }

    async function moveLeft() {
        if (!canManage) return;

        const index = orderedColumns.findIndex((col) => col.id === column.id);
        if (index <= 0) return;

        const nextColumns = [...orderedColumns];
        [nextColumns[index - 1], nextColumns[index]] = [
            nextColumns[index],
            nextColumns[index - 1],
        ];

        await persistColumnOrder(nextColumns);
        isMenuOpen = false;
    }

    async function moveRight() {
        if (!canManage) return;

        const index = orderedColumns.findIndex((col) => col.id === column.id);
        if (index < 0 || index >= orderedColumns.length - 1) return;

        const nextColumns = [...orderedColumns];
        [nextColumns[index], nextColumns[index + 1]] = [
            nextColumns[index + 1],
            nextColumns[index],
        ];

        await persistColumnOrder(nextColumns);
        isMenuOpen = false;
    }

    function startRename() {
        if (!canManage) return;

        editingTitle = column.title;
        isRenaming = true;
        isMenuOpen = false;
    }

    function cancelRename() {
        isRenaming = false;
        editingTitle = "";
    }

    async function commitRename() {
        if (!isRenaming) return;

        const nextTitle = editingTitle.trim();
        if (!nextTitle) {
            cancelRename();
            return;
        }

        if (nextTitle === column.title) {
            cancelRename();
            return;
        }

        try {
            await updateColumn(column.id, { title: nextTitle }, { reload: false });
            setColumns(
                $columns.map((col) =>
                    col.id === column.id ? { ...col, title: nextTitle } : col
                )
            );
        } catch (e) {
            console.error("Failed to rename column", e);
        }

        cancelRename();
    }

    async function requestDelete() {
        if (!canManage) return;

        setDeleteListTarget({ id: column.id, title: column.title });
        openModal("deleteListModal");

        isMenuOpen = false;
    }

    function handleAddCard() {
        if (!canAdd) return;
        createTaskInitialData.set({ columnId: column.id });
        openModal("createTaskModal");
        isMenuOpen = false;
    }

    function handleColumnContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({
            type: "column",
            x: event.clientX,
            y: event.clientY,
            columnId: column.id,
        });
        isMenuOpen = false;
    }

    function getDragTypes(event: DragEvent): string[] {
        return event.dataTransfer ? Array.from(event.dataTransfer.types || []) : [];
    }

    function isColumnDrag(event: DragEvent): boolean {
        return getDragTypes(event).includes("application/x-column-id");
    }

    function isTaskDrag(event: DragEvent): boolean {
        return getDragTypes(event).includes("application/x-task-id");
    }

    function handleTaskDragOver(event: DragEvent) {
        if (isColumnDrag(event)) return;
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
        isTaskDragOver = true;

        const target = event.target as Element;
        const card = target.closest(".task-card") as HTMLElement | null;

        if (!card) {
            taskDropIndex = columnTasks.length;
            return;
        }

        const targetTaskId = card.dataset.taskId;
        const cardIndex = targetTaskId
            ? columnTasks.findIndex((task) => task.id === targetTaskId)
            : -1;

        if (cardIndex < 0) {
            taskDropIndex = columnTasks.length;
            return;
        }

        const rect = card.getBoundingClientRect();
        const isBefore = event.clientY < rect.top + rect.height / 2;
        taskDropIndex = isBefore ? cardIndex : cardIndex + 1;
    }

    function handleTaskDragLeave(event: DragEvent) {
        const relatedTarget = event.relatedTarget as Node | null;
        const currentTarget = event.currentTarget as HTMLElement;
        if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
            isTaskDragOver = false;
            taskDropIndex = null;
        }
    }

    function handleTaskDrop(event: DragEvent) {
        if (isColumnDrag(event) || !isTaskDrag(event)) {
            isTaskDragOver = false;
            taskDropIndex = null;
            return;
        }

        const taskId =
            event.dataTransfer?.getData("application/x-task-id") ||
            event.dataTransfer?.getData("text/plain");
        const fromColumnId = event.dataTransfer?.getData("application/x-source-column-id") || null;
        if (!taskId) return;

        const beforeTaskId =
            taskDropIndex !== null && taskDropIndex >= 0 && taskDropIndex < columnTasks.length
                ? columnTasks[taskDropIndex].id
                : null;

        event.preventDefault();
        event.stopPropagation();
        isTaskDragOver = false;
        taskDropIndex = null;
        dispatch("taskDrop", {
            taskId,
            fromColumnId,
            toColumnId: column.id,
            beforeTaskId,
        });
    }

    function handleColumnDragStart(event: DragEvent) {
        if (!canManage || !event.dataTransfer) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-column-id", column.id);
        event.dataTransfer.setData("text/plain", column.id);
        dispatch("columnDragStart", { columnId: column.id });
    }

    function handleColumnDragEnd() {
        dispatch("columnDragEnd", undefined);
    }
</script>

<svelte:window
    on:mousedown={(event) => {
        if (!isMenuOpen) return;
        const target = event.target as Node;
        if (menuContainerEl && !menuContainerEl.contains(target)) {
            isMenuOpen = false;
        }
    }}
    on:keydown={(event) => {
        if (event.key === "Escape") {
            isMenuOpen = false;
        }
    }}
/>

<div
    class="column flex flex-col w-[min(20rem,calc(100vw-2rem))] md:w-80 flex-shrink-0 h-full rounded-xl transition-colors"
    data-column-id={column.id}
    bind:this={columnEl}
    on:contextmenu={handleColumnContextMenu}
    on:dragover={handleTaskDragOver}
    on:dragleave={handleTaskDragLeave}
    on:drop={handleTaskDrop}
>
    <div
        class="column-drag-handle flex items-center justify-between mb-3 px-1"
        draggable={canManage && !isRenaming}
        on:dragstart={handleColumnDragStart}
        on:dragend={handleColumnDragEnd}
    >
        <div
            class="flex items-center gap-2 {canManage
                ? 'cursor-grab active:cursor-grabbing'
                : ''}"
        >
            {#if canManage}
                <span
                    class="material-symbols-outlined text-[#8a98a8] text-[18px]"
                    >drag_indicator</span
                >
            {/if}
            <span
                class="flex items-center justify-center size-5 rounded text-[10px] font-bold text-white {colorClass}"
                >{columnTasks.length}</span
            >
            {#if isRenaming}
                <input
                    type="text"
                    bind:value={editingTitle}
                    class="text-sm font-semibold text-[#111418] dark:text-white bg-transparent border border-primary/40 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    autofocus
                    on:click|stopPropagation
                    on:keydown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename();
                        }
                        if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRename();
                        }
                    }}
                    on:blur={commitRename}
                />
            {:else}
                <div class="flex items-center gap-1.5">
                    <h3
                        class="text-sm font-semibold text-[#111418] dark:text-white {canManage
                            ? 'editable-title'
                            : ''}"
                    >
                        {column.title}
                    </h3>
                    {#if column.is_hidden}
                        <span class="material-symbols-outlined text-gray-400 dark:text-gray-500 text-[14px]" title="Hidden list">visibility_off</span>
                    {/if}
                    {#if column.is_archive}
                        <span class="material-symbols-outlined text-gray-400 dark:text-gray-500 text-[14px]" title="Archive list">archive</span>
                    {/if}
                </div>
            {/if}
        </div>

        {#if canAdd}
            <div class="flex items-center gap-1 relative" bind:this={menuContainerEl}>
                <button
                    on:click={toggleMenu}
                    class="column-menu-btn text-[#8a98a8] hover:text-[#111418] dark:hover:text-white"
                >
                    <span class="material-symbols-outlined text-[18px]"
                        >more_horiz</span
                    >
                </button>

                {#if isMenuOpen}
                    <!-- Click away overlay logic would go here in full implementation -->
                    <div
                        class="absolute right-0 top-8 bg-white dark:bg-[#151e29] rounded-lg shadow-xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-48 z-10"
                    >
                        <button
                            on:click={handleAddCard}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]"
                                >add</span
                            >Add card
                        </button>
                        <button
                            on:click={handleBulkCreate}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]">playlist_add</span>
                            Bulk create tasks
                        </button>
                        <button
                            on:click={handleBulkMove}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]">move_down</span>
                            Bulk move tasks
                        </button>
                        {#if canDeleteTasks}
                        <button
                            on:click={handleBulkDelete}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]">delete_sweep</span>
                            Bulk delete tasks
                        </button>
                        {/if}
                        <div
                            class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"
                        ></div>
                        <button
                            on:click={moveLeft}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]"
                                >arrow_back</span
                            >Move left
                        </button>
                        <button
                            on:click={moveRight}
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                        >
                            <span class="material-symbols-outlined text-[18px]"
                                >arrow_forward</span
                            >Move right
                        </button>
                        {#if canManage}
                            <div
                                class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"
                            ></div>
                            <button
                                on:click={startRename}
                                class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >edit</span
                                >Rename list
                            </button>
                            <button
                                on:click={requestDelete}
                                class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"
                            >
                                <span
                                    class="material-symbols-outlined text-[18px]"
                                    >delete</span
                                >Delete list
                            </button>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    </div>

    {#if isBulkCreating}
        <div class="mb-3 bg-white dark:bg-[#151e29] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col gap-2">
            <textarea
                bind:value={bulkCreateText}
                placeholder="Enter tasks (one per line)..."
                class="w-full text-xs p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                rows="4"
                autofocus
            ></textarea>
            <div class="flex justify-end gap-2">
                <button on:click={() => { isBulkCreating = false; bulkCreateText = ''; }} class="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button on:click={submitBulkCreate} class="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-blue-600">Create</button>
            </div>
        </div>
    {/if}

    {#if isBulkMoving}
        <div class="mb-3 bg-white dark:bg-[#151e29] border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex flex-col gap-2">
            <p class="text-xs font-semibold">Move all tasks to:</p>
            <select bind:value={bulkMoveDestColumnId} class="w-full text-xs p-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">-- Select list --</option>
                {#each $columns.filter(c => c.id !== column.id) as destCol}
                    <option value={destCol.id}>{destCol.title}</option>
                {/each}
            </select>
            <div class="flex justify-end gap-2">
                <button on:click={() => { isBulkMoving = false; bulkMoveDestColumnId = ''; }} class="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button on:click={submitBulkMove} disabled={!bulkMoveDestColumnId} class="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-blue-600 disabled:opacity-50">Move All</button>
            </div>
        </div>
    {/if}

    {#if isBulkDeleting}
        <div class="mb-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-3 flex flex-col gap-2">
            <p class="text-xs text-red-600 dark:text-red-400 font-semibold">
                {#if $columns.some(col => col.is_archive) && !column.is_archive}
                    Move all tasks in this list to Archive?
                {:else}
                    Permanently delete all tasks in this list?
                {/if}
            </p>
            <div class="flex justify-end gap-2">
                <button on:click={() => isBulkDeleting = false} class="px-2 py-1 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                <button on:click={submitBulkDelete} class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">Yes, proceed</button>
            </div>
        </div>
    {/if}

    <!-- Task List Area -->
    <div
        class="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 pr-1 overscroll-y-contain"
    >
        {#each columnTasks as task, taskIndex (task.id)}
            {#if (isTaskDragOver && taskDropIndex === taskIndex) || (isTouchDragOver && touchDropIndex === taskIndex)}
                <div class="h-1 bg-primary rounded-full my-1"></div>
            {/if}
            <TaskCard {task} />
        {/each}

        {#if (isTaskDragOver && taskDropIndex === columnTasks.length) || (isTouchDragOver && touchDropIndex === columnTasks.length)}
            <div class="h-1 bg-primary rounded-full my-1"></div>
        {/if}

        {#if canAdd}
            <button
                on:click={handleAddCard}
                class="add-card-btn flex items-center justify-center px-2 py-2 mt-2 text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Add Card"
            >
                <span class="material-symbols-outlined text-[20px]">add</span>
            </button>
        {/if}
    </div>
</div>
