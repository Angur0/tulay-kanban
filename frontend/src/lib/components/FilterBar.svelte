<script lang="ts">
    import {
        taskFilters,
        setPriorityFilter,
        toggleLabelFilter,
        setSortBy,
        resetFilters,
        hasActiveFilters,
        type PriorityFilter,
        type SortOption,
    } from "$lib/stores/filter";
    import { labels } from "$lib/stores/board";

    const priorities: { value: PriorityFilter; label: string; color: string; icon: string }[] = [
        { value: "all",    label: "All",    color: "#6b7280", icon: "filter_list" },
        { value: "high",   label: "High",   color: "#ef4444", icon: "keyboard_double_arrow_up" },
        { value: "medium", label: "Medium", color: "#f97316", icon: "drag_handle" },
        { value: "low",    label: "Low",    color: "#22c55e", icon: "keyboard_double_arrow_down" },
    ];

    const sortOptions: { value: SortOption; label: string; icon: string }[] = [
        { value: "default",       label: "Board Order",     icon: "view_kanban" },
        { value: "priority-desc", label: "Priority (High→Low)", icon: "arrow_downward" },
        { value: "priority-asc",  label: "Priority (Low→High)", icon: "arrow_upward" },
        { value: "due-date",      label: "Due Date",        icon: "calendar_today" },
        { value: "title",         label: "Title (A–Z)",     icon: "sort_by_alpha" },
    ];

    let showLabelDropdown = false;
    let showSortDropdown = false;

    function handleLabelToggle(labelId: string) {
        toggleLabelFilter(labelId);
    }

    $: currentSort = sortOptions.find(s => s.value === $taskFilters.sortBy) || sortOptions[0];
    $: activeLabelCount = $taskFilters.labelIds.length;
</script>

<!-- Click-away to close dropdowns -->
<svelte:window
    on:mousedown={(e) => {
        const target = e.target as Element;
        if (!target.closest(".label-dropdown-root")) showLabelDropdown = false;
        if (!target.closest(".sort-dropdown-root"))  showSortDropdown  = false;
    }}
    on:keydown={(e) => {
        if (e.key === "Escape") {
            showLabelDropdown = false;
            showSortDropdown  = false;
        }
    }}
/>

<div
    class="filter-bar flex items-center gap-3 px-8 py-2 bg-[#fbfcfd] dark:bg-[#151e29] overflow-x-auto flex-shrink-0"
>
    <!-- Priority Chips -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
        <span class="text-[10px] font-bold uppercase tracking-widest text-[#8a98a8] mr-1">Priority</span>
        {#each priorities as p}
            <button
                class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all {$taskFilters.priority === p.value
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-transparent text-[#5c6b7f] dark:text-gray-400 border-[#e5e7eb] dark:border-[#2a3a4a] hover:border-[#93c5fd] dark:hover:border-[#3b82f6]'}"
                style={$taskFilters.priority === p.value
                    ? `background-color: ${p.color}; border-color: ${p.color};`
                    : ""}
                on:click={() => setPriorityFilter(p.value)}
                title="Filter by {p.label} priority"
            >
                <span class="material-symbols-outlined text-[12px]">{p.icon}</span>
                {p.label}
            </button>
        {/each}
    </div>

    <div class="h-4 w-px bg-[#e5e7eb] dark:bg-[#1e2936] flex-shrink-0"></div>

    <!-- Label Filter -->
    <div class="label-dropdown-root relative flex-shrink-0">
        <button
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all {activeLabelCount > 0
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-transparent text-[#5c6b7f] dark:text-gray-400 border-[#e5e7eb] dark:border-[#2a3a4a] hover:border-[#93c5fd]'}"
            on:click={() => { showLabelDropdown = !showLabelDropdown; showSortDropdown = false; }}
        >
            <span class="material-symbols-outlined text-[12px]">label</span>
            Labels{activeLabelCount > 0 ? ` (${activeLabelCount})` : ""}
            <span class="material-symbols-outlined text-[12px]">{showLabelDropdown ? "expand_less" : "expand_more"}</span>
        </button>

        {#if showLabelDropdown}
            <div
                class="absolute top-9 left-0 z-30 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl shadow-2xl py-2 min-w-[180px] max-h-64 overflow-y-auto custom-scrollbar"
            >
                {#if $labels.length === 0}
                    <p class="text-xs text-[#8a98a8] px-4 py-3">No labels yet</p>
                {:else}
                    {#each $labels as label}
                        <button
                            class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors"
                            on:click={() => handleLabelToggle(label.id)}
                        >
                            <!-- Checkbox indicator -->
                            <span
                                class="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors {$taskFilters.labelIds.includes(label.id)
                                    ? 'bg-primary border-primary'
                                    : 'border-gray-400'}"
                            >
                                {#if $taskFilters.labelIds.includes(label.id)}
                                    <span class="material-symbols-outlined text-white text-[10px]">check</span>
                                {/if}
                            </span>
                            <span
                                class="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                                style="background-color: {label.color || '#93c5fd'}"
                            ></span>
                            <span class="text-[#111418] dark:text-white text-xs font-medium truncate">{label.name}</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>

    <div class="h-4 w-px bg-[#e5e7eb] dark:bg-[#1e2936] flex-shrink-0"></div>

    <!-- Sort -->
    <div class="sort-dropdown-root relative flex-shrink-0">
        <button
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all {$taskFilters.sortBy !== 'default'
                ? 'bg-primary text-white border-primary shadow-sm'
                : 'bg-transparent text-[#5c6b7f] dark:text-gray-400 border-[#e5e7eb] dark:border-[#2a3a4a] hover:border-[#93c5fd]'}"
            on:click={() => { showSortDropdown = !showSortDropdown; showLabelDropdown = false; }}
        >
            <span class="material-symbols-outlined text-[12px]">{currentSort.icon}</span>
            {currentSort.label}
            <span class="material-symbols-outlined text-[12px]">{showSortDropdown ? "expand_less" : "expand_more"}</span>
        </button>

        {#if showSortDropdown}
            <div
                class="absolute top-9 left-0 z-30 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl shadow-2xl py-2 min-w-[200px]"
            >
                {#each sortOptions as opt}
                    <button
                        class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors {$taskFilters.sortBy === opt.value
                            ? 'text-primary font-semibold'
                            : 'text-[#111418] dark:text-white'}"
                        on:click={() => { setSortBy(opt.value); showSortDropdown = false; }}
                    >
                        <span class="material-symbols-outlined text-[16px]">{opt.icon}</span>
                        {opt.label}
                        {#if $taskFilters.sortBy === opt.value}
                            <span class="material-symbols-outlined text-[14px] ml-auto">check</span>
                        {/if}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Spacer -->
    <div class="flex-1 min-w-0"></div>

    <!-- Reset button (shown only when filters are active) -->
    {#if $hasActiveFilters}
        <button
            class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-red-500 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
            on:click={resetFilters}
            title="Clear all filters"
        >
            <span class="material-symbols-outlined text-[13px]">filter_list_off</span>
            Clear filters
        </button>
    {/if}
</div>
