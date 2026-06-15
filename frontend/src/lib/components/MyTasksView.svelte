<script lang="ts">
    import { onMount, tick } from "svelte";
    import { getMyTasks } from "$lib/api/tasksApi";
    import type { Task } from "$lib/types";
    import { activeTask } from "$lib/stores/board";

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

    function openTask(task: Task) {
        $activeTask = task;
    }
</script>

<div
    class="flex-1 flex flex-col overflow-hidden bg-[#f0f2f5] dark:bg-[#0d141c]"
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
            <div class="flex items-center justify-center py-20 text-[#8a98a8]">
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
                        <div class="flex flex-col gap-2">
                            {#each todoTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all"
                                    on:click={() => openTask(task)}
                                >
                                    <p
                                        class="text-sm font-medium text-[#111418] dark:text-gray-200"
                                    >
                                        {task.title}
                                    </p>
                                    {#if task.description}
                                        <p
                                            class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1"
                                        >
                                            {task.description}
                                        </p>
                                    {/if}
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
                        <div class="flex flex-col gap-2">
                            {#each inprogressTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all"
                                    on:click={() => openTask(task)}
                                >
                                    <p
                                        class="text-sm font-medium text-[#111418] dark:text-gray-200"
                                    >
                                        {task.title}
                                    </p>
                                    {#if task.description}
                                        <p
                                            class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1"
                                        >
                                            {task.description}
                                        </p>
                                    {/if}
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
                        <div class="flex flex-col gap-2">
                            {#each doneTasks as task (task.id)}
                                <!-- svelte-ignore a11y-click-events-have-key-events -->
                                <!-- svelte-ignore a11y-no-static-element-interactions -->
                                <div
                                    class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all"
                                    on:click={() => openTask(task)}
                                >
                                    <p
                                        class="text-sm font-medium text-[#111418] dark:text-gray-200"
                                    >
                                        {task.title}
                                    </p>
                                    {#if task.description}
                                        <p
                                            class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1"
                                        >
                                            {task.description}
                                        </p>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
