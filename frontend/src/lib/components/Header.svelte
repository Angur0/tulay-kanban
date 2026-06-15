<script lang="ts">
    import { activeBoard, columns, tasks } from "$lib/stores/board";
    import { isWsConnected } from "$lib/stores/realtime";
    import { activeView, openModal, boardViewMode, setBoardViewMode, toggleMobileSidebar } from "$lib/stores/ui";
    import { normalizeBoardIcon, columnColorClasses } from "$lib/constants";
    import { openSearch, isFilterBarOpen, hasActiveFilters } from "$lib/stores/filter";
    import FilterBar from "./FilterBar.svelte";

    // Calculate header stats
    $: stats = $columns.map((col, index) => {
        return {
            title: col.title,
            count: $tasks.filter((t) => t.column_id === col.id).length,
            colorClass: columnColorClasses[index % columnColorClasses.length],
        };
    });

    function toggleFilterBar() {
        isFilterBarOpen.update(v => !v);
    }
</script>

<div class="flex-shrink-0 flex flex-col bg-[#fbfcfd] dark:bg-[#151e29]">
    <header
        class="responsive-header min-h-12 px-4 md:px-8 py-2 flex items-center justify-between gap-3"
    >
        <div class="flex items-center gap-3 min-w-0">
            <button
                type="button"
                on:click={toggleMobileSidebar}
                class="md:hidden flex items-center justify-center size-9 rounded-xl bg-primary text-white shadow-sm"
                aria-label="Open navigation"
            >
                <span class="material-symbols-outlined text-[20px]">menu</span>
            </button>
            <div
                class="hidden sm:flex items-center gap-2 text-[#5c6b7f] dark:text-gray-400 text-xs font-medium uppercase tracking-wider"
            >
                <span class="material-symbols-outlined text-sm"
                    >{normalizeBoardIcon($activeBoard?.icon)}</span
                >
                <span>Task Board</span>
            </div>
            <h2
                class="text-[#111418] dark:text-white text-sm font-bold tracking-tight truncate"
            >
                {$activeBoard
                    ? $activeBoard.name
                    : $activeView === "board"
                      ? "Select a Board"
                      : "Tulay Kanban"}
            </h2>
        </div>

        <div class="header-actions flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar">
            <!-- Task Stats (board view only) -->
            {#if $activeBoard}
                <div class="hidden xl:flex items-center gap-4 text-xs overflow-x-auto">
                    {#each stats as stat}
                        <div class="flex items-center gap-1.5">
                            <span class="size-2 rounded-full {stat.colorClass}"></span>
                            <span class="text-[#5c6b7f] dark:text-gray-400"
                                >{stat.title}:
                                <span
                                    class="font-semibold text-[#111418] dark:text-white"
                                    >{stat.count}</span
                                ></span
                            >
                        </div>
                    {/each}
                </div>

                <div class="h-4 w-px bg-[#e5e7eb] dark:bg-[#1e2936]"></div>

                <!-- Members Button -->
                <button
                    on:click={() => openModal("manageMembersModal")}
                    class="flex items-center gap-1.5 text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
                >
                    <span class="material-symbols-outlined text-[16px]">group</span>
                    <span class="header-action-label">Members</span>
                </button>

                <!-- Filter Toggle -->
                <button
                    on:click={toggleFilterBar}
                    class="flex items-center gap-1.5 text-xs font-medium transition-colors relative {$isFilterBarOpen || $hasActiveFilters
                        ? 'text-primary'
                        : 'text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white'}"
                    title="Filter & Sort tasks"
                >
                    <span class="material-symbols-outlined text-[16px]">filter_list</span>
                    <span class="header-action-label">Filter</span>
                    {#if $hasActiveFilters}
                        <span class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary"></span>
                    {/if}
                </button>
            {/if}

                <!-- View mode toggle (Kanban / Gantt) -->
                {#if $activeBoard}
                <div class="flex items-center bg-[#eff1f3] dark:bg-[#1e2936] rounded-lg p-0.5 ml-1">
                    <button
                        id="view-toggle-kanban"
                        class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors {$boardViewMode === 'kanban' ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary' : 'text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white'}"
                        on:click={() => setBoardViewMode('kanban')}
                        title="Kanban view"
                    >
                        <span class="material-symbols-outlined text-[16px] align-middle">view_kanban</span>
                    </button>
                    <button
                        id="view-toggle-gantt"
                        class="px-2.5 py-1 rounded-md text-xs font-medium transition-colors {$boardViewMode === 'gantt' ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary' : 'text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white'}"
                        on:click={() => setBoardViewMode('gantt')}
                        title="Gantt / Timeline view"
                    >
                        <span class="material-symbols-outlined text-[16px] align-middle">calendar_view_week</span>
                    </button>
                </div>
                {/if}

            <!-- Global Search Button -->
            <button
                on:click={openSearch}
                class="flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors border border-[#e5e7eb] dark:border-[#2a3a4a]"
                title="Search (Ctrl+K)"
                id="search-btn"
            >
                <span class="material-symbols-outlined text-[16px]">search</span>
                <span class="hidden sm:inline">Search</span>
                <kbd class="hidden sm:inline-flex items-center gap-0.5 px-1 rounded bg-[#f0f2f5] dark:bg-[#0d141c] text-[9px] font-mono border border-[#e5e7eb] dark:border-[#2a3a4a]">⌘K</kbd>
            </button>


        </div>
    </header>

    <!-- Filter bar (collapsible, only on board view) -->
    {#if $isFilterBarOpen && $activeView === "board" && $activeBoard}
        <FilterBar />
    {/if}
</div>
