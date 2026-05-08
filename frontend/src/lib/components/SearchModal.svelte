<script lang="ts">
    import { boards, tasks, columns } from "$lib/stores/board";
    import { setActiveBoardId } from "$lib/stores/board";
    import { closeSearch } from "$lib/stores/filter";
    import { openModal, switchView } from "$lib/stores/ui";
    import { setActiveTask } from "$lib/stores/board";
    import type { Task, Board } from "$lib/types";

    let query = "";
    let inputEl: HTMLInputElement;

    // ---- Search logic ----
    type TaskResult  = Task  & { _type: "task";  columnTitle: string; boardName: string };
    type BoardResult = Board & { _type: "board" };
    type SearchResult = TaskResult | BoardResult;

    $: results = search(query);

    function search(q: string): SearchResult[] {
        const term = q.trim().toLowerCase();
        if (!term || term.length < 2) return [];

        const out: SearchResult[] = [];

        // Board matches
        for (const board of $boards) {
            if (board.name.toLowerCase().includes(term)) {
                out.push({ ...board, _type: "board" });
            }
        }

        // Task matches
        for (const task of $tasks) {
            const titleMatch       = task.title.toLowerCase().includes(term);
            const descriptionMatch = (task.description || "").toLowerCase().includes(term);
            if (titleMatch || descriptionMatch) {
                const col   = $columns.find(c => c.id === task.column_id);
                const board = $boards.find(b => b.id === task.board_id);
                out.push({
                    ...task,
                    _type:       "task",
                    columnTitle: col?.title   || "Unknown List",
                    boardName:   board?.name  || "Unknown Board",
                });
            }
        }

        return out.slice(0, 30);
    }

    function highlightMatch(text: string, q: string): string {
        if (!q.trim()) return text;
        const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return text.replace(
            new RegExp(`(${escaped})`, "gi"),
            '<mark class="search-highlight">$1</mark>'
        );
    }

    function handleBoardSelect(board: Board) {
        setActiveBoardId(board.id);
        switchView("board");
        closeSearch();
        query = "";
    }

    function handleTaskSelect(task: Task) {
        // Switch to the correct board first
        if (task.board_id) {
            setActiveBoardId(task.board_id);
            switchView("board");
        }
        setActiveTask(task);
        openModal("taskPanel");
        closeSearch();
        query = "";
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            closeSearch();
            query = "";
        }
    }

    // Focus input when opened
    import { onMount, tick } from "svelte";
    onMount(async () => {
        await tick();
        inputEl?.focus();
    });

    const priorityColors: Record<string, string> = {
        low:    "#22c55e",
        medium: "#f97316",
        high:   "#ef4444",
    };
    const priorityIcons: Record<string, string> = {
        low:    "keyboard_double_arrow_down",
        medium: "drag_handle",
        high:   "keyboard_double_arrow_up",
    };
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Backdrop -->
<div
    class="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4"
    role="dialog"
    aria-modal="true"
    aria-label="Global Search"
    on:mousedown|self={() => { closeSearch(); query = ""; }}
>
    <!-- Blur backdrop -->
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true"></div>

    <!-- Search Panel -->
    <div
        class="search-panel relative w-full max-w-2xl bg-white dark:bg-[#151e29] rounded-2xl shadow-2xl border border-[#e5e7eb] dark:border-[#1e2936] overflow-hidden flex flex-col max-h-[70vh]"
        on:mousedown|stopPropagation
    >
        <!-- Input Row -->
        <div class="flex items-center gap-3 px-5 py-4 border-b border-[#e5e7eb] dark:border-[#1e2936]">
            <span class="material-symbols-outlined text-[22px] text-[#8a98a8] flex-shrink-0">search</span>
            <input
                bind:this={inputEl}
                bind:value={query}
                type="text"
                placeholder="Search tasks and boards..."
                class="flex-1 bg-transparent text-[#111418] dark:text-white text-base placeholder-[#8a98a8] focus:outline-none"
                autocomplete="off"
                spellcheck="false"
            />
            {#if query}
                <button
                    class="text-[#8a98a8] hover:text-[#5c6b7f] transition-colors"
                    on:click={() => (query = "")}
                    title="Clear"
                >
                    <span class="material-symbols-outlined text-[18px]">close</span>
                </button>
            {/if}
            <kbd class="hidden sm:flex items-center gap-0.5 px-2 py-0.5 rounded bg-[#f0f2f5] dark:bg-[#1e2936] text-[10px] font-mono text-[#8a98a8] border border-[#e5e7eb] dark:border-[#2a3a4a] flex-shrink-0">
                ESC
            </kbd>
        </div>

        <!-- Results -->
        <div class="overflow-y-auto custom-scrollbar flex-1">
            {#if query.trim().length > 0 && query.trim().length < 2}
                <p class="px-6 py-10 text-center text-sm text-[#8a98a8]">Type at least 2 characters…</p>
            {:else if results.length === 0 && query.trim().length >= 2}
                <div class="px-6 py-12 text-center">
                    <span class="material-symbols-outlined text-4xl text-[#d1d5db] dark:text-[#2a3a4a] mb-3 block">search_off</span>
                    <p class="text-sm text-[#8a98a8]">No results for "<strong class="text-[#5c6b7f] dark:text-gray-300">{query}</strong>"</p>
                </div>
            {:else if results.length > 0}
                <!-- Group: Boards -->
                {@const boardResults = results.filter(r => r._type === "board")}
                {@const taskResults  = results.filter(r => r._type === "task")}

                {#if boardResults.length > 0}
                    <div class="px-5 pt-4 pb-1">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-[#8a98a8] mb-2">Boards</p>
                        <div class="flex flex-col gap-0.5">
                            {#each boardResults as result}
                                {@const board = result as Board & { _type: "board" }}
                                <button
                                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-left transition-colors group"
                                    on:click={() => handleBoardSelect(board)}
                                >
                                    <span
                                        class="material-symbols-outlined text-[20px] flex-shrink-0"
                                        style="color: {board.icon_color || '#3b82f6'}"
                                    >{board.icon || "dashboard"}</span>
                                    <span class="text-sm font-medium text-[#111418] dark:text-white group-hover:text-primary transition-colors">
                                        {@html highlightMatch(board.name, query)}
                                    </span>
                                    <span class="material-symbols-outlined text-[16px] text-[#8a98a8] ml-auto opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if taskResults.length > 0}
                    <div class="px-5 pt-4 pb-4">
                        <p class="text-[10px] font-bold uppercase tracking-widest text-[#8a98a8] mb-2">Tasks</p>
                        <div class="flex flex-col gap-0.5">
                            {#each taskResults as result}
                                {@const task = result as Task & { _type: "task"; columnTitle: string; boardName: string }}
                                <button
                                    class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-left transition-colors group w-full"
                                    on:click={() => handleTaskSelect(task)}
                                >
                                    <!-- Priority dot -->
                                    <span
                                        class="material-symbols-outlined text-[16px] flex-shrink-0"
                                        style="color: {priorityColors[task.priority] || '#6b7280'}"
                                        title="{task.priority} priority"
                                    >{priorityIcons[task.priority] || "circle"}</span>

                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-medium text-[#111418] dark:text-white truncate">
                                            {@html highlightMatch(task.title, query)}
                                        </p>
                                        {#if task.description && task.description.toLowerCase().includes(query.trim().toLowerCase())}
                                            <p class="text-xs text-[#8a98a8] truncate mt-0.5">
                                                {@html highlightMatch(task.description.slice(0, 120), query)}
                                            </p>
                                        {/if}
                                        <div class="flex items-center gap-1.5 mt-1">
                                            <span class="text-[10px] text-[#8a98a8]">{task.boardName}</span>
                                            <span class="text-[10px] text-[#8a98a8]">›</span>
                                            <span class="text-[10px] text-[#8a98a8]">{task.columnTitle}</span>
                                        </div>
                                    </div>

                                    <!-- Labels preview -->
                                    {#if task.labels && task.labels.length > 0}
                                        <div class="flex gap-1 flex-shrink-0 max-w-[100px] overflow-hidden">
                                            {#each task.labels.slice(0, 2) as label}
                                                <span
                                                    class="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                                                    style="background-color: {label.color || '#93c5fd'}"
                                                >{label.name}</span>
                                            {/each}
                                            {#if task.labels.length > 2}
                                                <span class="text-[10px] text-[#8a98a8]">+{task.labels.length - 2}</span>
                                            {/if}
                                        </div>
                                    {/if}

                                    <span class="material-symbols-outlined text-[16px] text-[#8a98a8] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/if}
            {:else}
                <!-- Empty / idle state -->
                <div class="px-6 py-10 text-center">
                    <span class="material-symbols-outlined text-4xl text-[#d1d5db] dark:text-[#2a3a4a] mb-3 block">manage_search</span>
                    <p class="text-sm text-[#8a98a8]">Search across all your tasks and boards</p>
                    <p class="text-xs text-[#aab0b8] dark:text-[#4a5a6a] mt-1">Tip: Press <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">⌘K</kbd> or <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">Ctrl+K</kbd> to open search anytime</p>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    :global(.search-highlight) {
        background-color: #fde68a;
        color: #92400e;
        border-radius: 2px;
        padding: 0 1px;
        font-weight: 700;
    }
    :global(.dark .search-highlight) {
        background-color: #78350f;
        color: #fde68a;
    }
</style>
