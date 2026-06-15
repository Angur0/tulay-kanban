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
    import InlineCreateTaskForm from "./InlineCreateTaskForm.svelte";
    import { openModal } from "$lib/stores/ui";
    import { updateColumn } from "$lib/api/listsApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import { openContextMenu } from "$lib/stores/context-menu";
    import { createEventDispatcher } from "svelte";

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
    let showInlineAddForm = false;
    let isTaskDragOver = false;
    let taskDropIndex: number | null = null;
    let isRenaming = false;
    let editingTitle = "";
    let menuContainerEl: HTMLElement | null = null;

    $: columnTasks = $filteredTasksByColumn[column.id] || [];
    $: colorClass = columnColorClasses[index % columnColorClasses.length];
    $: canManage = ["owner", "moderator"].includes($currentBoardRole);
    $: canAdd = ["owner", "moderator", "member"].includes($currentBoardRole);

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
        showInlineAddForm = true;
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
                <h3
                    class="text-sm font-semibold text-[#111418] dark:text-white {canManage
                        ? 'editable-title'
                        : ''}"
                >
                    {column.title}
                </h3>
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

    <!-- Task List Area -->
    <div
        class="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 pr-1 overscroll-contain"
    >
        {#each columnTasks as task, taskIndex (task.id)}
            {#if isTaskDragOver && taskDropIndex === taskIndex}
                <div class="h-1 bg-primary rounded-full my-1"></div>
            {/if}
            <TaskCard {task} />
        {/each}

        {#if isTaskDragOver && taskDropIndex === columnTasks.length}
            <div class="h-1 bg-primary rounded-full my-1"></div>
        {/if}

        {#if showInlineAddForm && canAdd}
            <InlineCreateTaskForm columnId={column.id} on:close={() => (showInlineAddForm = false)} />
        {/if}
    </div>

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
