<script lang="ts">
    import type { Column } from "$lib/types";
    import { tasksByColumn } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { columnColorClasses } from "$lib/constants";
    import TaskCard from "./TaskCard.svelte";
    import { openModal } from "$lib/stores/ui";

    export let column: Column;
    export let index: number;

    let isMenuOpen = false;

    $: columnTasks = $tasksByColumn[column.id] || [];
    $: colorClass = columnColorClasses[index % columnColorClasses.length];
    $: canManage = ["owner", "moderator"].includes($currentBoardRole);
    $: canAdd = ["owner", "moderator", "member"].includes($currentBoardRole);

    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
    }

    // Handlers
    function moveLeft() {
        /* Implement */
    }
    function moveRight() {
        /* Implement */
    }
    function rename() {
        /* Implement */
    }
    function requestDelete() {
        // Implementation logic
        openModal("deleteListModal");
    }
</script>

<div
    class="column flex flex-col w-80 flex-shrink-0 h-full rounded-xl transition-colors"
    data-column-id={column.id}
>
    <div
        class="column-drag-handle flex items-center justify-between mb-3 px-1"
        draggable={canManage}
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
            <h3
                class="text-sm font-semibold text-[#111418] dark:text-white {canManage
                    ? 'editable-title'
                    : ''}"
            >
                {column.title}
            </h3>
        </div>

        {#if canAdd}
            <div class="flex items-center gap-1 relative">
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
                                on:click={rename}
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
        class="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 pr-1"
    >
        {#each columnTasks as task (task.id)}
            <TaskCard {task} />
        {/each}
    </div>

    {#if canAdd}
        <button
            class="add-card-btn flex items-center justify-center px-2 py-2 mt-2 text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Add Card"
        >
            <span class="material-symbols-outlined text-[20px]">add</span>
        </button>
    {/if}
</div>
