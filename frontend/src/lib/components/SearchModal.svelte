<script lang="ts">
    import { boards, tasks, columns, labels } from "$lib/stores/board";
    import { setActiveBoardId } from "$lib/stores/board";
    import { closeSearch } from "$lib/stores/filter";
    import { openModal, switchView } from "$lib/stores/ui";
    import { setActiveTask } from "$lib/stores/board";
    import type { Task, Board } from "$lib/types";

    let query = "";
    let inputEl: HTMLInputElement;

    // ---- Label filter state ----
    let selectedLabelIds: string[] = [];

    function toggleLabel(id: string) {
        if (selectedLabelIds.includes(id)) {
            selectedLabelIds = selectedLabelIds.filter(l => l !== id);
        } else {
            selectedLabelIds = [...selectedLabelIds, id];
        }
    }

    function handleClose() {
        closeSearch();
        query = "";
        selectedLabelIds = [];
        showSuggestions = false;
    }

    // ---- Suggestions ----
    let showSuggestions = false;

    type SuggestionKind = "task" | "board" | "list" | "label";
    type Suggestion = {
        kind: SuggestionKind;
        id: string;
        label: string;
        sub?: string;        // secondary hint text
        color?: string;      // for labels / boards
        icon?: string;       // material icon override
        payload?: unknown;   // original object for action
    };

    const kindMeta: Record<SuggestionKind, { icon: string; color: string; group: string }> = {
        task:  { icon: "task_alt",        color: "#6366f1", group: "Tasks"  },
        board: { icon: "dashboard",       color: "#3b82f6", group: "Boards" },
        list:  { icon: "view_list",       color: "#10b981", group: "Lists"  },
        label: { icon: "label",           color: "#f59e0b", group: "Labels" },
    };

    const MAX_PER_GROUP = 3;

    $: suggestions = buildSuggestions(query);

    function buildSuggestions(q: string): Suggestion[] {
        const term = q.trim().toLowerCase();
        if (!term) return [];

        const out: Suggestion[] = [];

        // Boards
        let bCount = 0;
        for (const b of $boards) {
            if (bCount >= MAX_PER_GROUP) break;
            if (b.name.toLowerCase().includes(term)) {
                out.push({ kind: "board", id: b.id, label: b.name, color: b.icon_color, icon: b.icon || "dashboard", payload: b });
                bCount++;
            }
        }

        // Lists (columns)
        let lCount = 0;
        for (const c of $columns) {
            if (lCount >= MAX_PER_GROUP) break;
            if (c.title.toLowerCase().includes(term)) {
                const boardName = $boards.find(b => b.id === c.board_id)?.name;
                out.push({ kind: "list", id: c.id, label: c.title, sub: boardName, payload: c });
                lCount++;
            }
        }

        // Labels
        let lblCount = 0;
        for (const lbl of $labels) {
            if (lblCount >= MAX_PER_GROUP) break;
            if (lbl.name.toLowerCase().includes(term)) {
                out.push({ kind: "label", id: lbl.id, label: lbl.name, color: lbl.color, payload: lbl });
                lblCount++;
            }
        }

        // Tasks (title only for suggestions — description is noisy)
        let tCount = 0;
        for (const t of $tasks) {
            if (tCount >= MAX_PER_GROUP) break;
            if (t.title.toLowerCase().includes(term)) {
                const col   = $columns.find(c => c.id === t.column_id);
                const board = $boards.find(b => b.id === t.board_id);
                out.push({
                    kind: "task",
                    id: t.id,
                    label: t.title,
                    sub: [board?.name, col?.title].filter(Boolean).join(" › "),
                    payload: t,
                });
                tCount++;
            }
        }

        return out;
    }

    // Group suggestions for display
    const SUGGESTION_ORDER: SuggestionKind[] = ["task", "board", "list", "label"];
    $: groupedSuggestions = SUGGESTION_ORDER
        .map(kind => ({ kind, items: suggestions.filter(s => s.kind === kind) }))
        .filter(g => g.items.length > 0);

    function applySuggestion(s: Suggestion) {
        if (s.kind === "label") {
            // Toggle the label filter instead of setting the query
            toggleLabel(s.id);
            query = "";
        } else if (s.kind === "board") {
            handleBoardSelect(s.payload as Board);
            return;
        } else if (s.kind === "list") {
            // Navigate to the board that owns this list
            const col = s.payload as { board_id: string };
            setActiveBoardId(col.board_id);
            switchView("board");
            handleClose();
            return;
        } else if (s.kind === "task") {
            handleTaskSelect(s.payload as Task);
            return;
        }
        showSuggestions = false;
    }

    // ---- Full results ----
    type TaskResult  = Task  & { _type: "task";  columnTitle: string; boardName: string };
    type BoardResult = Board & { _type: "board" };
    type SearchResult = TaskResult | BoardResult;

    $: results = search(query, selectedLabelIds);

    function search(q: string, labelIds: string[]): SearchResult[] {
        const term = q.trim().toLowerCase();
        const hasText   = term.length >= 2;
        const hasLabels = labelIds.length > 0;

        if (!hasText && !hasLabels) return [];
        if (!hasText && term.length === 1) return [];

        const out: SearchResult[] = [];

        if (hasText) {
            for (const board of $boards) {
                if (board.name.toLowerCase().includes(term)) {
                    out.push({ ...board, _type: "board" });
                }
            }
        }

        for (const task of $tasks) {
            if (hasLabels) {
                const taskLabelIds = (task.labels ?? []).map((l: { id: string }) => l.id);
                const hasAll = labelIds.every(id => taskLabelIds.includes(id));
                if (!hasAll) continue;
            }
            if (hasText) {
                const titleMatch       = task.title.toLowerCase().includes(term);
                const descriptionMatch = (task.description || "").toLowerCase().includes(term);
                if (!titleMatch && !descriptionMatch) continue;
            }
            const col   = $columns.find(c => c.id === task.column_id);
            const board = $boards.find(b => b.id === task.board_id);
            out.push({
                ...task,
                _type:       "task",
                columnTitle: col?.title  || "Unknown List",
                boardName:   board?.name || "Unknown Board",
            });
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
        handleClose();
    }

    function handleTaskSelect(task: Task) {
        if (task.board_id) {
            setActiveBoardId(task.board_id);
            switchView("board");
        }
        setActiveTask(task);
        openModal("taskPanel");
        handleClose();
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            if (showSuggestions) {
                showSuggestions = false;
            } else {
                handleClose();
            }
        }
    }

    function handleInputFocus() {
        if (query.trim()) showSuggestions = true;
    }

    function handleInput() {
        showSuggestions = query.trim().length > 0;
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

<!-- Root overlay — full-screen click-away zone -->
<div
    class="fixed inset-0 z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Global Search"
>
    <!-- Blur backdrop — clicking it closes the modal -->
    <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        on:mousedown={handleClose}
    ></div>

    <!-- Search Panel wrapper — mobile: bottom sheet, sm+: centered modal -->
    <div class="search-panel-wrapper">

    <!-- Search Panel -->
    <div
        class="search-panel relative w-full bg-white dark:bg-[#151e29] shadow-2xl border border-[#e5e7eb] dark:border-[#1e2936] flex flex-col"
        on:mousedown|stopPropagation
    >
        <!-- Mobile drag handle -->
        <div class="flex justify-center pt-2.5 pb-0 sm:hidden">
            <div class="w-9 h-1 rounded-full bg-[#d1d5db] dark:bg-[#2a3a4a]"></div>
        </div>

        <!-- Input Row -->
        <div class="flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-4 border-b border-[#e5e7eb] dark:border-[#1e2936] relative">
            <span class="material-symbols-outlined text-[20px] sm:text-[22px] text-[#8a98a8] flex-shrink-0">search</span>
            <input
                bind:this={inputEl}
                bind:value={query}
                type="text"
                placeholder="Search tasks, boards, lists, labels…"
                class="flex-1 bg-transparent text-[#111418] dark:text-white text-sm sm:text-base placeholder-[#8a98a8] focus:outline-none min-w-0"
                autocomplete="off"
                spellcheck="false"
                on:input={handleInput}
                on:focus={handleInputFocus}
            />
            {#if query}
                <button
                    class="text-[#8a98a8] hover:text-[#5c6b7f] transition-colors flex-shrink-0"
                    on:click={() => { query = ""; showSuggestions = false; }}
                    title="Clear search"
                >
                    <span class="material-symbols-outlined text-[18px]">backspace</span>
                </button>
            {/if}
            <!-- Close button — always visible, no ESC hint on mobile -->
            <button
                class="flex items-center justify-center w-8 h-8 rounded-lg text-[#8a98a8] hover:text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                on:click={handleClose}
                title="Close search (Esc)"
                aria-label="Close search"
            >
                <span class="material-symbols-outlined text-[20px]">close</span>
            </button>

            <!-- ── Suggestion Dropdown ── -->
            {#if showSuggestions && groupedSuggestions.length > 0}
                <div
                    class="suggestion-dropdown absolute top-full left-0 right-0 z-10 bg-white dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] border-t-0 rounded-b-2xl shadow-2xl max-h-72 overflow-y-auto custom-scrollbar"
                    on:mousedown|stopPropagation
                >
                    {#each groupedSuggestions as group}
                        <!-- Group header -->
                        <div class="px-4 pt-3 pb-1">
                            <span class="text-[10px] font-bold uppercase tracking-widest text-[#8a98a8] flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-[12px]">{kindMeta[group.kind].icon}</span>
                                {kindMeta[group.kind].group}
                            </span>
                        </div>
                        {#each group.items as s}
                            <button
                                class="w-full flex items-center gap-3 px-4 py-2 text-sm text-left hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors group/s"
                                on:click={() => applySuggestion(s)}
                            >
                                <!-- Icon / color swatch -->
                                {#if s.kind === "label"}
                                    <span
                                        class="w-3 h-3 rounded-sm flex-shrink-0"
                                        style="background-color: {s.color || '#93c5fd'}"
                                    ></span>
                                {:else if s.kind === "board"}
                                    <span
                                        class="material-symbols-outlined text-[16px] flex-shrink-0"
                                        style="color: {s.color || kindMeta[s.kind].color}"
                                    >{s.icon || kindMeta[s.kind].icon}</span>
                                {:else}
                                    <span
                                        class="material-symbols-outlined text-[16px] flex-shrink-0"
                                        style="color: {kindMeta[s.kind].color}"
                                    >{kindMeta[s.kind].icon}</span>
                                {/if}

                                <!-- Label + sub-hint -->
                                <span class="flex-1 min-w-0">
                                    <span class="text-[#111418] dark:text-white font-medium truncate block">
                                        {@html highlightMatch(s.label, query)}
                                    </span>
                                    {#if s.sub}
                                        <span class="text-[10px] text-[#8a98a8] truncate block">{s.sub}</span>
                                    {/if}
                                </span>

                                <!-- Kind badge -->
                                <span class="text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 opacity-60 group-hover/s:opacity-100 transition-opacity"
                                    style="background: {kindMeta[s.kind].color}22; color: {kindMeta[s.kind].color}"
                                >
                                    {s.kind}
                                </span>
                            </button>
                        {/each}
                    {/each}

                    <!-- Footer hint -->
                    <p class="px-4 py-2.5 text-[10px] text-[#8a98a8] border-t border-[#e5e7eb] dark:border-[#1e2936] mt-1">
                        Press <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">Enter</kbd> to search · <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">Esc</kbd> to dismiss suggestions
                    </p>
                </div>
            {/if}
        </div>

        <!-- Label filter chips -->
        {#if $labels.length > 0}
            <div class="flex items-center gap-2 px-5 py-2.5 border-b border-[#e5e7eb] dark:border-[#1e2936] flex-wrap">
                <span class="material-symbols-outlined text-[14px] text-[#8a98a8] flex-shrink-0">label</span>
                <span class="text-[10px] font-bold uppercase tracking-widest text-[#8a98a8] flex-shrink-0 mr-0.5">Labels</span>
                {#each $labels as label}
                    <button
                        class="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all"
                        style={selectedLabelIds.includes(label.id)
                            ? `background-color: ${label.color}; border-color: ${label.color}; color: #fff;`
                            : `border-color: ${label.color}40; color: ${label.color}; background: ${label.color}12;`}
                        on:click={() => toggleLabel(label.id)}
                        title="Filter by label: {label.name}"
                    >
                        {#if selectedLabelIds.includes(label.id)}
                            <span class="material-symbols-outlined text-[11px]">check</span>
                        {/if}
                        {label.name}
                    </button>
                {/each}
                {#if selectedLabelIds.length > 0}
                    <button
                        class="ml-auto flex items-center gap-0.5 text-[10px] text-[#8a98a8] hover:text-red-400 transition-colors"
                        on:click={() => (selectedLabelIds = [])}
                        title="Clear label filters"
                    >
                        <span class="material-symbols-outlined text-[12px]">close</span>
                        Clear
                    </button>
                {/if}
            </div>
        {/if}

        <!-- Results -->
        <div class="overflow-y-auto custom-scrollbar flex-1">
            {#if query.trim().length > 0 && query.trim().length < 2 && selectedLabelIds.length === 0}
                <p class="px-6 py-10 text-center text-sm text-[#8a98a8]">Type at least 2 characters…</p>
            {:else if results.length === 0 && (query.trim().length >= 2 || selectedLabelIds.length > 0)}
                <div class="px-6 py-12 text-center">
                    <span class="material-symbols-outlined text-4xl text-[#d1d5db] dark:text-[#2a3a4a] mb-3 block">search_off</span>
                    {#if query.trim().length >= 2}
                        <p class="text-sm text-[#8a98a8]">No results for "<strong class="text-[#5c6b7f] dark:text-gray-300">{query}</strong>"</p>
                    {:else}
                        <p class="text-sm text-[#8a98a8]">No tasks match the selected label{selectedLabelIds.length > 1 ? 's' : ''}</p>
                    {/if}
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
                                    <!-- Priority icon -->
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
                    <p class="text-sm text-[#8a98a8]">Search tasks and boards, or filter by label above</p>
                    <p class="text-xs text-[#aab0b8] dark:text-[#4a5a6a] mt-1">Tip: Press <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">⌘K</kbd> or <kbd class="px-1 rounded bg-[#f0f2f5] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#2a3a4a] font-mono">Ctrl+K</kbd> to open search anytime</p>
                </div>
            {/if}
        </div>
    </div>
    </div><!-- /.search-panel-wrapper -->
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

    /* ── Layout ───────────────────────────────────────────────── */

    /* Mobile: bottom sheet that fills most of the screen */
    .search-panel-wrapper {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;   /* anchor to bottom */
        justify-content: center;
        pointer-events: none;    /* let backdrop clicks fall through */
    }

    .search-panel {
        pointer-events: all;
        width: 100%;
        max-height: 92dvh;       /* leave a sliver at top so backdrop is tappable */
        border-radius: 1.25rem 1.25rem 0 0;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        animation: sheet-up 220ms cubic-bezier(0.34, 1.2, 0.64, 1);
    }

    @keyframes sheet-up {
        from { transform: translateY(60px); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
    }

    /* sm+: centered floating modal */
    @media (min-width: 640px) {
        .search-panel-wrapper {
            align-items: flex-start;
            padding: 12vh 1rem 0;
        }
        .search-panel {
            max-width: 42rem;
            max-height: 80vh;
            border-radius: 1rem;
            animation: modal-in 150ms ease-out;
        }
        @keyframes modal-in {
            from { transform: translateY(-8px) scale(0.98); opacity: 0; }
            to   { transform: translateY(0)    scale(1);    opacity: 1; }
        }
    }

    /* ── Suggestion dropdown ──────────────────────────────────── */
    .suggestion-dropdown {
        animation: suggestions-in 120ms ease-out;
    }
    @keyframes suggestions-in {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
    }
</style>
