<script lang="ts">
    import { onMount } from "svelte";
    import { getMyTasks } from "$lib/api/tasksApi";
    import type { Task } from "$lib/types";
    import { activeTask, boards, setActiveBoardId, setActiveTask } from "$lib/stores/board";
    import { openModal } from "$lib/stores/ui";

    let loading = true;
    let error: string | null = null;
    let myTasks: Task[] = [];

    $: todoTasks = myTasks.filter((t) => t.status === "todo");
    $: inprogressTasks = myTasks.filter((t) => t.status === "inprogress");
    $: doneTasks = myTasks.filter((t) => t.status === "done");

    onMount(async () => {
        try {
            myTasks = await getMyTasks();
        } catch (e: any) {
            error = e.message || "Failed to load your tasks";
            console.error(e);
        } finally {
            loading = false;
        }
    });

    const priorityColors: Record<string, string> = {
        low: "#22c55e",
        medium: "#f97316",
        high: "#ef4444",
    };

    function getBoardName(boardId: string) {
        return $boards.find((b) => b.id === boardId)?.name || "Unknown Board";
    }

    function isOverdue(task: Task): boolean {
        if (!task.due_date || task.status === "done") return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(task.due_date) < today;
    }

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString();
    }

    function openTask(task: Task) {
        setActiveBoardId(task.board_id);
        setActiveTask(task);
        openModal("taskPanel");
    }
</script>

<div
    class="flex-1 flex flex-col overflow-hidden bg-[#f0f2f5] dark:bg-[#0d141c] md:ml-2 rounded-tl-none md:rounded-tl-2xl"
>
    <div
        class="shrink-0 px-4 md:px-8 py-4 border-b border-[#e5e7eb] dark:border-[#1e2936] flex items-center justify-between"
    >
        <h3 class="text-sm font-semibold text-[#111418] dark:text-white">
            My Assigned Tasks
        </h3>
        <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-primary"></span>
            <span
                class="text-[10px] font-bold text-primary uppercase tracking-wider"
            >
                {myTasks.length} task{myTasks.length !== 1 ? "s" : ""}
            </span>
        </div>
    </div>
    <div class="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        {#if loading}
            <div class="flex flex-col items-center justify-center py-20 text-[#8a98a8]">
                <span
                    class="material-symbols-outlined animate-spin text-4xl mb-4"
                    >refresh</span
                >
            </div>
        {:else if error}
            <div
                class="flex flex-col items-center justify-center py-20 text-red-500"
            >
                <span class="material-symbols-outlined text-4xl mb-4"
                    >error</span
                >
                <p class="text-sm">{error}</p>
            </div>
        {:else if myTasks.length === 0}
            <div
                class="flex flex-col items-center justify-center py-20 text-[#8a98a8]"
            >
                <span class="material-symbols-outlined text-4xl mb-4 opacity-30"
                    >check_circle</span
                >
                <p class="text-sm">No tasks assigned to you</p>
            </div>
        {:else}
            <div class="max-w-4xl mx-auto flex flex-col gap-4">
                {#if todoTasks.length > 0}
                    <div class="mb-6">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="size-2 rounded-full bg-amber-500"
                            ></span>
                            <span
                                class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase"
                                >To Do ({todoTasks.length})</span
                            >
                        </div>
                        <div class="flex flex-col gap-3">
                            {#each todoTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all flex flex-col gap-3 shadow-sm hover:shadow"
                                    style="border-left-width: 4px; border-left-color: {priorityColors[task.priority] || priorityColors.medium};"
                                    on:click={() => openTask(task)}
                                >
                                    <!-- Top Row: Board + Due Date -->
                                    <div class="flex items-center justify-between text-xs text-[#5c6b7f] dark:text-gray-400 gap-2">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="material-symbols-outlined text-[16px] text-primary">dashboard</span>
                                            <span class="font-medium truncate">{getBoardName(task.board_id)}</span>
                                        </div>
                                        {#if task.due_date}
                                            {@const overdue = isOverdue(task)}
                                            <div class="flex items-center gap-1 flex-shrink-0 {overdue ? 'text-red-500 font-semibold' : ''}">
                                                <span class="material-symbols-outlined text-[16px]">{overdue ? 'warning' : 'event'}</span>
                                                <span>{overdue ? 'Overdue: ' : ''}{formatDate(task.due_date)}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Middle: Title + Description -->
                                    <div>
                                        <p class="text-sm font-semibold text-[#111418] dark:text-gray-100 leading-snug">
                                            {task.title}
                                        </p>
                                        {#if task.description}
                                            <p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1 line-clamp-2">
                                                {task.description}
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Bottom: Labels + Subtask progress -->
                                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                                        <div class="flex flex-wrap gap-1">
                                            {#if task.labels && task.labels.length > 0}
                                                {#each task.labels as label}
                                                    <span
                                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                                                        style="background-color: {label.color || '#93c5fd'}"
                                                    >
                                                        {label.name}
                                                    </span>
                                                {/each}
                                            {:else}
                                                <span class="text-[10px] italic text-gray-400">No labels</span>
                                            {/if}
                                        </div>

                                        {#if task.subtasks && task.subtasks.length > 0}
                                            {@const completed = task.subtasks.filter(s => s.is_finished).length}
                                            {@const total = task.subtasks.length}
                                            {@const percentage = Math.round((completed / total) * 100)}
                                            <div class="flex items-center gap-2 text-[11px] text-[#5c6b7f] dark:text-gray-400 min-w-[120px]">
                                                <div class="flex-1 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                    <div class="bg-primary h-full transition-all duration-300" style="width: {percentage}%"></div>
                                                </div>
                                                <span class="font-medium flex-shrink-0">{completed}/{total} subtasks</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if inprogressTasks.length > 0}
                    <div class="mb-6">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="size-2 rounded-full bg-primary"></span>
                            <span
                                class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase"
                                >In Progress ({inprogressTasks.length})</span
                            >
                        </div>
                        <div class="flex flex-col gap-3">
                            {#each inprogressTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all flex flex-col gap-3 shadow-sm hover:shadow"
                                    style="border-left-width: 4px; border-left-color: {priorityColors[task.priority] || priorityColors.medium};"
                                    on:click={() => openTask(task)}
                                >
                                    <!-- Top Row: Board + Due Date -->
                                    <div class="flex items-center justify-between text-xs text-[#5c6b7f] dark:text-gray-400 gap-2">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="material-symbols-outlined text-[16px] text-primary">dashboard</span>
                                            <span class="font-medium truncate">{getBoardName(task.board_id)}</span>
                                        </div>
                                        {#if task.due_date}
                                            {@const overdue = isOverdue(task)}
                                            <div class="flex items-center gap-1 flex-shrink-0 {overdue ? 'text-red-500 font-semibold' : ''}">
                                                <span class="material-symbols-outlined text-[16px]">{overdue ? 'warning' : 'event'}</span>
                                                <span>{overdue ? 'Overdue: ' : ''}{formatDate(task.due_date)}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Middle: Title + Description -->
                                    <div>
                                        <p class="text-sm font-semibold text-[#111418] dark:text-gray-100 leading-snug">
                                            {task.title}
                                        </p>
                                        {#if task.description}
                                            <p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1 line-clamp-2">
                                                {task.description}
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Bottom: Labels + Subtask progress -->
                                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                                        <div class="flex flex-wrap gap-1">
                                            {#if task.labels && task.labels.length > 0}
                                                {#each task.labels as label}
                                                    <span
                                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                                                        style="background-color: {label.color || '#93c5fd'}"
                                                    >
                                                        {label.name}
                                                    </span>
                                                {/each}
                                            {:else}
                                                <span class="text-[10px] italic text-gray-400">No labels</span>
                                            {/if}
                                        </div>

                                        {#if task.subtasks && task.subtasks.length > 0}
                                            {@const completed = task.subtasks.filter(s => s.is_finished).length}
                                            {@const total = task.subtasks.length}
                                            {@const percentage = Math.round((completed / total) * 100)}
                                            <div class="flex items-center gap-2 text-[11px] text-[#5c6b7f] dark:text-gray-400 min-w-[120px]">
                                                <div class="flex-1 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                    <div class="bg-primary h-full transition-all duration-300" style="width: {percentage}%"></div>
                                                </div>
                                                <span class="font-medium flex-shrink-0">{completed}/{total} subtasks</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                {#if doneTasks.length > 0}
                    <div class="mb-6">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="size-2 rounded-full bg-green-500"
                            ></span>
                            <span
                                class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase"
                                >Done ({doneTasks.length})</span
                            >
                        </div>
                        <div class="flex flex-col gap-3">
                            {#each doneTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all flex flex-col gap-3 shadow-sm hover:shadow"
                                    style="border-left-width: 4px; border-left-color: {priorityColors[task.priority] || priorityColors.medium};"
                                    on:click={() => openTask(task)}
                                >
                                    <!-- Top Row: Board + Due Date -->
                                    <div class="flex items-center justify-between text-xs text-[#5c6b7f] dark:text-gray-400 gap-2">
                                        <div class="flex items-center gap-1.5 min-w-0">
                                            <span class="material-symbols-outlined text-[16px] text-primary">dashboard</span>
                                            <span class="font-medium truncate">{getBoardName(task.board_id)}</span>
                                        </div>
                                        {#if task.due_date}
                                            {@const overdue = isOverdue(task)}
                                            <div class="flex items-center gap-1 flex-shrink-0 {overdue ? 'text-red-500 font-semibold' : ''}">
                                                <span class="material-symbols-outlined text-[16px]">{overdue ? 'warning' : 'event'}</span>
                                                <span>{overdue ? 'Overdue: ' : ''}{formatDate(task.due_date)}</span>
                                            </div>
                                        {/if}
                                    </div>

                                    <!-- Middle: Title + Description -->
                                    <div>
                                        <p class="text-sm font-semibold text-[#111418] dark:text-gray-100 leading-snug">
                                            {task.title}
                                        </p>
                                        {#if task.description}
                                            <p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1 line-clamp-2">
                                                {task.description}
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Bottom: Labels + Subtask progress -->
                                    <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/50">
                                        <div class="flex flex-wrap gap-1">
                                            {#if task.labels && task.labels.length > 0}
                                                {#each task.labels as label}
                                                    <span
                                                        class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                                                        style="background-color: {label.color || '#93c5fd'}"
                                                    >
                                                        {label.name}
                                                    </span>
                                                {/each}
                                            {:else}
                                                <span class="text-[10px] italic text-gray-400">No labels</span>
                                            {/if}
                                        </div>

                                        {#if task.subtasks && task.subtasks.length > 0}
                                            {@const completed = task.subtasks.filter(s => s.is_finished).length}
                                            {@const total = task.subtasks.length}
                                            {@const percentage = Math.round((completed / total) * 100)}
                                            <div class="flex items-center gap-2 text-[11px] text-[#5c6b7f] dark:text-gray-400 min-w-[120px]">
                                                <div class="flex-1 bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                    <div class="bg-primary h-full transition-all duration-300" style="width: {percentage}%"></div>
                                                </div>
                                                <span class="font-medium flex-shrink-0">{completed}/{total} subtasks</span>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
