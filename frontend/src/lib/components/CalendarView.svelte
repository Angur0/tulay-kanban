<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { tasks, columns, activeBoard, setActiveTask } from "$lib/stores/board";
    import { currentBoardRole, currentUser } from "$lib/stores/user";
    import { taskFilters } from "$lib/stores/filter";
    import { createTask } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import {
        calendarYear,
        calendarMonth,
        calendarViewMode,
        calendarSelectedDay,
        openModal,
        createTaskInitialData
    } from "$lib/stores/ui";
    import type { Task } from "$lib/types";

    // ─── Constants ───
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_NAMES = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const COLUMN_COLORS = [
        "#f59e0b", "#2b8cee", "#22c55e", "#a855f7",
        "#ec4899", "#6366f1", "#ef4444", "#eab308"
    ];

    // ─── Reactive View Parameters ───
    let isMobile = false;
    let isPortrait = false;

    function checkScreen() {
        if (typeof window !== "undefined") {
            isMobile = window.innerWidth < 768;
            isPortrait = window.innerHeight > window.innerWidth;
        }
    }

    onMount(() => {
        checkScreen();
        window.addEventListener("resize", checkScreen);
    });

    onDestroy(() => {
        if (typeof window !== "undefined") {
            window.removeEventListener("resize", checkScreen);
        }
    });

    // Permission check
    $: canCreate = ["owner", "editor", "moderator", "member"].includes($currentBoardRole);

    // ─── Filtered Tasks ───
    $: filteredTasks = $tasks.filter(t => {
        // Only show tasks with a due date in calendar
        if (!t.due_date) return false;

        // Filter: Assigned to me
        if ($taskFilters.assignedToMe && String(t.assignee_id) !== String($currentUser?.id)) {
            return false;
        }

        // Filter: Priority
        if ($taskFilters.priority !== "all" && t.priority !== $taskFilters.priority) {
            return false;
        }

        // Filter: Labels (AND logic matching BoardView)
        if ($taskFilters.labelIds.length > 0) {
            const taskLabelIds = (t.labels as { id: string }[] | undefined)?.map(l => l.id)
                ?? (t.label_ids as string[] | undefined)
                ?? [];
            const matchesAll = $taskFilters.labelIds.every(lid => taskLabelIds.includes(lid));
            if (!matchesAll) return false;
        }

        // Filter: Search query
        if ($taskFilters.searchQuery.trim()) {
            const q = $taskFilters.searchQuery.trim().toLowerCase();
            const inTitle = t.title.toLowerCase().includes(q);
            const inDesc = (t.description || "").toLowerCase().includes(q);
            if (!inTitle && !inDesc) return false;
        }

        return true;
    });

    // Helper for task chip column colors
    function getTaskColor(columnId: string): string {
        const idx = $columns.findIndex(c => c.id === columnId);
        return COLUMN_COLORS[(idx >= 0 ? idx : 0) % COLUMN_COLORS.length];
    }

    // Map: 'YYYY-MM-DD' -> Task[]
    $: taskMap = (() => {
        const map = new Map<string, Task[]>();
        for (const t of filteredTasks) {
            if (t.due_date) {
                const dateStr = t.due_date.slice(0, 10);
                if (!map.has(dateStr)) {
                    map.set(dateStr, []);
                }
                map.get(dateStr)!.push(t);
            }
        }
        return map;
    })();

    // ─── Navigation Logic ───
    function getDaysInMonth(y: number, m: number): number {
        return new Date(y, m + 1, 0).getDate();
    }

    function prev() {
        if ($calendarViewMode === "month") {
            if ($calendarMonth === 0) {
                calendarMonth.set(11);
                calendarYear.update(y => y - 1);
            } else {
                calendarMonth.update(m => m - 1);
            }
        } else if ($calendarViewMode === "week") {
            const current = new Date($calendarYear, $calendarMonth, $calendarSelectedDay);
            current.setDate(current.getDate() - 7);
            calendarYear.set(current.getFullYear());
            calendarMonth.set(current.getMonth());
            calendarSelectedDay.set(current.getDate());
        } else {
            const current = new Date($calendarYear, $calendarMonth, $calendarSelectedDay);
            current.setDate(current.getDate() - 1);
            calendarYear.set(current.getFullYear());
            calendarMonth.set(current.getMonth());
            calendarSelectedDay.set(current.getDate());
        }
    }

    function next() {
        if ($calendarViewMode === "month") {
            if ($calendarMonth === 11) {
                calendarMonth.set(0);
                calendarYear.update(y => y + 1);
            } else {
                calendarMonth.update(m => m + 1);
            }
        } else if ($calendarViewMode === "week") {
            const current = new Date($calendarYear, $calendarMonth, $calendarSelectedDay);
            current.setDate(current.getDate() + 7);
            calendarYear.set(current.getFullYear());
            calendarMonth.set(current.getMonth());
            calendarSelectedDay.set(current.getDate());
        } else {
            const current = new Date($calendarYear, $calendarMonth, $calendarSelectedDay);
            current.setDate(current.getDate() + 1);
            calendarYear.set(current.getFullYear());
            calendarMonth.set(current.getMonth());
            calendarSelectedDay.set(current.getDate());
        }
    }

    function today() {
        const now = new Date();
        calendarYear.set(now.getFullYear());
        calendarMonth.set(now.getMonth());
        calendarSelectedDay.set(now.getDate());
    }

    function startCreate(dateStr: string) {
        if (!canCreate || isMobile) return;
        createTaskInitialData.set({ dueDate: dateStr });
        openModal("createTaskModal");
    }

    // ─── Inline Expansion (+N More) ───
    let expandedCells = new Set<string>();

    function toggleCellExpand(dateStr: string, event: MouseEvent) {
        event.stopPropagation();
        if (expandedCells.has(dateStr)) {
            expandedCells.delete(dateStr);
        } else {
            expandedCells.add(dateStr);
        }
        expandedCells = expandedCells; // trigger update
    }

    // ─── Grid Generation helper ───
    interface DayCell {
        dateStr: string;
        dayNum: number;
        isCurrentMonth: boolean;
        isToday: boolean;
    }

    // Month Grid Generation
    $: monthCells = (() => {
        const cells: DayCell[] = [];
        const firstDayIdx = new Date($calendarYear, $calendarMonth, 1).getDay(); // 0 is Sunday
        const daysInCurrentMonth = getDaysInMonth($calendarYear, $calendarMonth);
        const daysInPrevMonth = getDaysInMonth($calendarYear, $calendarMonth - 1);

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        // Previous month padding days
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const d = daysInPrevMonth - i;
            const m = $calendarMonth === 0 ? 11 : $calendarMonth - 1;
            const y = $calendarMonth === 0 ? $calendarYear - 1 : $calendarYear;
            const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            cells.push({
                dateStr,
                dayNum: d,
                isCurrentMonth: false,
                isToday: dateStr === todayStr
            });
        }

        // Current month days
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dateStr = `${$calendarYear}-${String($calendarMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            cells.push({
                dateStr,
                dayNum: d,
                isCurrentMonth: true,
                isToday: dateStr === todayStr
            });
        }

        // Next month padding days to fill 6-week layout (42 cells)
        const remaining = 42 - cells.length;
        for (let d = 1; d <= remaining; d++) {
            const m = $calendarMonth === 11 ? 0 : $calendarMonth + 1;
            const y = $calendarMonth === 11 ? $calendarYear + 1 : $calendarYear;
            const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            cells.push({
                dateStr,
                dayNum: d,
                isCurrentMonth: false,
                isToday: dateStr === todayStr
            });
        }

        return cells;
    })();

    // Week Grid Generation
    $: weekCells = (() => {
        const cells: DayCell[] = [];
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

        // Get the Sunday of the current selected day's week
        const baseDate = new Date($calendarYear, $calendarMonth, $calendarSelectedDay);
        const dayOfWeek = baseDate.getDay();
        const sunday = new Date(baseDate);
        sunday.setDate(baseDate.getDate() - dayOfWeek);

        for (let i = 0; i < 7; i++) {
            const current = new Date(sunday);
            current.setDate(sunday.getDate() + i);
            const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
            cells.push({
                dateStr,
                dayNum: current.getDate(),
                isCurrentMonth: current.getMonth() === $calendarMonth,
                isToday: dateStr === todayStr
            });
        }

        return cells;
    })();

    // Day details
    $: dayDateStr = `${$calendarYear}-${String($calendarMonth + 1).padStart(2, "0")}-${String($calendarSelectedDay).padStart(2, "0")}`;
    $: dayTasks = taskMap.get(dayDateStr) || [];
</script>


<!-- Fullscreen Rotation Prompt for Mobile Portrait (Month & Week views only) -->
{#if isMobile && isPortrait && $calendarViewMode !== "day"}
    <div class="absolute inset-0 z-[60] bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <span class="material-symbols-outlined text-6xl text-primary mb-4 animate-bounce">screen_rotation</span>
        <h3 class="text-lg font-bold mb-2">Rotate your device</h3>
        <p class="text-sm text-slate-400">
            Please rotate your device to landscape mode to view the Month or Week Calendar.
        </p>
        <button
            on:click={() => calendarViewMode.set("day")}
            class="mt-6 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-xs font-semibold shadow transition-colors"
        >
            Switch to Day View
        </button>
    </div>
{/if}

<div class="calendar-view flex flex-col flex-1 overflow-hidden bg-[#fbfcfd] dark:bg-[#151e29]">
    <!-- ─── Top Toolbar ─── -->
    <div class="flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0 flex-wrap gap-3">
        <!-- Month Label & Nav controls -->
        <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-[#111418] dark:text-white min-w-[120px]">
                {#if $calendarViewMode === "month"}
                    {MONTH_NAMES[$calendarMonth]} {$calendarYear}
                {:else if $calendarViewMode === "week"}
                    Week of {MONTH_NAMES[new Date(weekCells[0].dateStr).getMonth()]} {new Date(weekCells[0].dateStr).getDate()}, {new Date(weekCells[0].dateStr).getFullYear()}
                {:else}
                    {MONTH_NAMES[$calendarMonth]} {$calendarSelectedDay}, {$calendarYear}
                {/if}
            </h3>
            <div class="flex items-center gap-0.5 bg-[#eff1f3] dark:bg-[#1e2936] rounded-lg p-0.5">
                <button
                    on:click={prev}
                    class="p-1 rounded-md text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white transition-colors"
                >
                    <span class="material-symbols-outlined text-[16px] align-middle">chevron_left</span>
                </button>
                <button
                    on:click={today}
                    class="px-2 py-0.5 rounded-md text-xs font-medium text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white transition-colors"
                >
                    Today
                </button>
                <button
                    on:click={next}
                    class="p-1 rounded-md text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white transition-colors"
                >
                    <span class="material-symbols-outlined text-[16px] align-middle">chevron_right</span>
                </button>
            </div>
        </div>

        <!-- Desktop Navigation pills -->
        {#if !isMobile}
            <div class="flex items-center bg-[#eff1f3] dark:bg-[#1e2936] rounded-lg p-0.5">
                {#each ["month", "week", "day"] as mode}
                    <button
                        on:click={() => calendarViewMode.set(mode as any)}
                        class="px-3 py-1 rounded-md text-xs font-medium transition-colors { $calendarViewMode === mode
                            ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary'
                            : 'text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white'}"
                    >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                {/each}
            </div>
        {/if}
    </div>

    <!-- ─── Main Content Container ─── -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar relative">
        {#if $tasks.length === 0}
            <!-- Empty state -->
            <div class="absolute inset-0 flex flex-col items-center justify-center text-[#8a98a8] gap-3 pointer-events-none">
                <span class="material-symbols-outlined text-4xl opacity-30">calendar_month</span>
                <p class="text-sm">No tasks on this board yet</p>
            </div>
        {:else if $calendarViewMode === "month"}
            <!-- Month View Grid -->
            <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm h-full min-h-[480px]">
                <!-- Weekday Headers -->
                {#each WEEKDAYS as day}
                    <div class="bg-[#f8fafc] dark:bg-[#1a2535] py-2 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                        {day}
                    </div>
                {/each}

                <!-- Days cells -->
                {#each monthCells as cell}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        on:click={() => startCreate(cell.dateStr)}
                        class="bg-white dark:bg-[#111923] p-2 min-h-[90px] flex flex-col transition-colors relative group
                        {cell.isCurrentMonth ? '' : 'bg-slate-50/50 dark:bg-[#0f151e]/40'}
                        {cell.isToday ? 'ring-2 ring-primary ring-inset bg-blue-50/10 dark:bg-blue-900/5' : ''}"
                    >
                        <!-- Cell Header -->
                        <div class="flex items-center justify-between mb-1.5">
                            <button
                                on:click|stopPropagation={() => {
                                    const parsed = new Date(cell.dateStr);
                                    calendarYear.set(parsed.getFullYear());
                                    calendarMonth.set(parsed.getMonth());
                                    calendarSelectedDay.set(parsed.getDate());
                                    calendarViewMode.set("day");
                                }}
                                class="text-xs font-semibold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors
                                {cell.isToday ? 'text-primary font-bold bg-primary/10' : 'text-[#5c6b7f] dark:text-gray-400'}
                                {!cell.isCurrentMonth && !cell.isToday ? 'opacity-40' : ''}"
                            >
                                {cell.dayNum}
                            </button>

                            <!-- Add task shortcut icon on desktop hover -->
                            {#if canCreate && !isMobile}
                                <span class="material-symbols-outlined text-[14px] text-primary opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                    add_circle
                                </span>
                            {/if}
                        </div>

                        <!-- Cell Tasks List -->
                        <div class="flex-1 flex flex-col gap-1 overflow-visible">
                            <!-- Show tasks -->
                            {#if taskMap.has(cell.dateStr)}
                                {@const list = taskMap.get(cell.dateStr) || []}
                                {@const maxVisible = expandedCells.has(cell.dateStr) ? list.length : 3}
                                {#each list.slice(0, maxVisible) as t}
                                    <button
                                        on:click|stopPropagation={() => { setActiveTask(t); openModal('taskPanel'); }}
                                        style="border-left-color: {getTaskColor(t.column_id)}"
                                        class="text-left text-[11px] font-medium leading-tight py-1 px-1.5 bg-slate-50 dark:bg-[#1a232f] border-l-2 hover:bg-slate-100 dark:hover:bg-[#202b3b] rounded-r transition-all truncate flex items-center gap-1 w-full"
                                    >
                                        <!-- Priority Dot -->
                                        <span
                                            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            class:bg-red-500={t.priority === 'high'}
                                            class:bg-orange-500={t.priority === 'medium'}
                                            class:bg-green-500={t.priority === 'low'}
                                        ></span>
                                        <span class="truncate text-slate-700 dark:text-slate-200 flex-1">{t.title}</span>
                                    </button>
                                {/each}

                                <!-- Overflow indicator -->
                                {#if list.length > 3}
                                    <button
                                        on:click={(e) => toggleCellExpand(cell.dateStr, e)}
                                        class="text-[10px] font-bold text-primary hover:underline self-start mt-0.5"
                                    >
                                        {expandedCells.has(cell.dateStr)
                                            ? "Show less"
                                            : `+${list.length - 3} more`}
                                    </button>
                                {/if}
                            {/if}
                        </div>

                    </div>
                {/each}
            </div>
        {:else if $calendarViewMode === "week"}
            <!-- Week View Grid -->
            <div class="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm h-full min-h-[480px]">
                <!-- Weekday Headers with dates -->
                {#each weekCells as cell, i}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        on:click={() => {
                            const parsed = new Date(cell.dateStr);
                            calendarYear.set(parsed.getFullYear());
                            calendarMonth.set(parsed.getMonth());
                            calendarSelectedDay.set(parsed.getDate());
                            calendarViewMode.set("day");
                        }}
                        class="bg-[#f8fafc] dark:bg-[#1a2535] py-3 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex flex-col items-center justify-center gap-0.5 border-b border-slate-200 dark:border-slate-700"
                    >
                        <span class="text-[10px] font-bold text-slate-400 uppercase">{WEEKDAYS[i]}</span>
                        <span class="text-sm font-bold {cell.isToday ? 'text-primary bg-primary/10 rounded-full px-2 py-0.5' : 'text-slate-700 dark:text-slate-300'}">
                            {cell.dayNum}
                        </span>
                    </div>
                {/each}

                <!-- Week Column Cells -->
                {#each weekCells as cell}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        on:click={() => startCreate(cell.dateStr)}
                        class="bg-white dark:bg-[#111923] p-2 min-h-[350px] flex flex-col relative group
                        {cell.isToday ? 'bg-blue-50/5 dark:bg-blue-900/5 border-x border-primary/20' : ''}"
                    >
                        <!-- Tasks Container -->
                        <div class="flex-1 flex flex-col gap-1.5">
                            {#if taskMap.has(cell.dateStr)}
                                {#each taskMap.get(cell.dateStr) || [] as t}
                                    <button
                                        on:click|stopPropagation={() => { setActiveTask(t); openModal('taskPanel'); }}
                                        style="border-left-color: {getTaskColor(t.column_id)}"
                                        class="text-left text-xs font-semibold leading-tight py-1.5 px-2 bg-slate-50 dark:bg-[#1a232f] border-l-2 hover:bg-slate-100 dark:hover:bg-[#202b3b] rounded-r transition-all truncate flex items-center gap-1.5 w-full shadow-sm"
                                    >
                                        <!-- Priority Dot -->
                                        <span
                                            class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            class:bg-red-500={t.priority === 'high'}
                                            class:bg-orange-500={t.priority === 'medium'}
                                            class:bg-green-500={t.priority === 'low'}
                                        ></span>
                                        <span class="truncate text-slate-700 dark:text-slate-200 flex-1">{t.title}</span>
                                    </button>
                                {/each}
                            {/if}
                        </div>

                        <!-- Add task icon on desktop hover -->
                        {#if canCreate && !isMobile}
                            <span class="material-symbols-outlined text-[16px] text-primary opacity-0 group-hover:opacity-100 absolute bottom-3 right-3 transition-opacity pointer-events-none">
                                add_circle
                            </span>
                        {/if}

                    </div>
                {/each}
            </div>
        {:else}
            <!-- Day View Details -->
            <div class="max-w-2xl mx-auto flex flex-col h-full bg-white dark:bg-[#1a232f] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <!-- Day view header -->
                <div class="px-6 py-4 bg-[#f8fafc] dark:bg-[#1f2b3c] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div>
                        <h4 class="text-sm font-bold text-slate-800 dark:text-white">
                            Tasks Scheduled
                        </h4>
                        <p class="text-xs text-slate-400">
                            {dayTasks.length} {dayTasks.length === 1 ? "task" : "tasks"}
                        </p>
                    </div>
                    {#if canCreate && !isMobile}
                        <button
                            on:click={() => startCreate(dayDateStr)}
                            class="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-semibold shadow transition-colors"
                        >
                            <span class="material-symbols-outlined text-[16px]">add</span>
                            Create Task
                        </button>
                    {/if}
                </div>

                <!-- Day view tasks container -->
                <div class="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-3 custom-scrollbar">
                    {#if dayTasks.length === 0}
                        <div class="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <span class="material-symbols-outlined text-4xl opacity-20 font-light">event_busy</span>
                            <p class="text-xs font-medium">No tasks scheduled for this day</p>
                        </div>
                    {:else}
                        {#each dayTasks as t}
                            <button
                                on:click={() => { setActiveTask(t); openModal('taskPanel'); }}
                                class="text-left w-full bg-white dark:bg-[#151e29] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm rounded-xl p-3 flex items-center justify-between gap-4 transition-all"
                            >
                                <div class="flex items-center gap-3 min-w-0">
                                    <!-- Priority Dot indicator -->
                                    <span
                                        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        class:bg-red-500={t.priority === 'high'}
                                        class:bg-orange-500={t.priority === 'medium'}
                                        class:bg-green-500={t.priority === 'low'}
                                    ></span>
                                    <div class="min-w-0">
                                        <h5 class="text-sm font-bold text-slate-800 dark:text-white truncate">
                                            {t.title}
                                        </h5>
                                        <p class="text-[10px] text-slate-400 font-medium">
                                            List: {$columns.find(c => c.id === t.column_id)?.title || "Unknown"}
                                        </p>
                                    </div>
                                </div>
                                <span
                                    style="background-color: {getTaskColor(t.column_id)}20; color: {getTaskColor(t.column_id)}"
                                    class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                                >
                                    {$columns.find(c => c.id === t.column_id)?.title || "Default"}
                                </span>
                            </button>
                        {/each}
                    {/if}
                </div>

            </div>
        {/if}
    </div>

    <!-- ─── Secondary Bottom Navigation Bar for Mobile switcher ─── -->
    {#if isMobile}
        <div class="mobile-bottom-nav bg-white dark:bg-[#161f2b] border-t border-[#e5e7eb] dark:border-[#1e2936] py-2 px-6 flex items-center justify-around flex-shrink-0">
            <button
                on:click={() => calendarViewMode.set("month")}
                class="flex flex-col items-center gap-0.5 text-[#5c6b7f] dark:text-gray-400
                {$calendarViewMode === 'month' ? 'text-primary dark:text-primary font-semibold' : ''}"
            >
                <span class="material-symbols-outlined text-[20px] { $calendarViewMode === 'month' ? 'icon-filled' : ''}">calendar_month</span>
                <span class="text-[10px]">Month</span>
            </button>
            <button
                on:click={() => calendarViewMode.set("week")}
                class="flex flex-col items-center gap-0.5 text-[#5c6b7f] dark:text-gray-400
                {$calendarViewMode === 'week' ? 'text-primary dark:text-primary font-semibold' : ''}"
            >
                <span class="material-symbols-outlined text-[20px] { $calendarViewMode === 'week' ? 'icon-filled' : ''}">calendar_view_week</span>
                <span class="text-[10px]">Week</span>
            </button>
            <button
                on:click={() => calendarViewMode.set("day")}
                class="flex flex-col items-center gap-0.5 text-[#5c6b7f] dark:text-gray-400
                {$calendarViewMode === 'day' ? 'text-primary dark:text-primary font-semibold' : ''}"
            >
                <span class="material-symbols-outlined text-[20px] { $calendarViewMode === 'day' ? 'icon-filled' : ''}">event</span>
                <span class="text-[10px]">Day</span>
            </button>
        </div>
    {/if}
</div>

<style>
    /* Prevent user select on calendar headers/cells */
    .calendar-view {
        user-select: none;
    }
</style>
