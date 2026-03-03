<script lang="ts">
    import type { Task } from "$lib/types";
    import { currentBoardRole, workspaceMembers } from "$lib/stores/user";
    import { openModal } from "$lib/stores/ui";

    export let task: Task;

    $: isDone = task.status === "done";
    $: canManage = ["owner", "moderator", "member"].includes($currentBoardRole);
    $: assignee = task.assignee_id
        ? $workspaceMembers.find((m) => m.id === task.assignee_id)
        : null;
    $: initials = assignee
        ? (assignee.full_name || assignee.email || "")
              .split(/[\s@]+/)
              .slice(0, 2)
              .map((p) => p[0].toUpperCase())
              .join("")
        : "";

    const priorityColors: Record<string, string> = {
        low: "#22c55e",
        medium: "#f97316",
        high: "#ef4444",
    };
    $: borderColor = priorityColors[task.priority] || priorityColors.medium;

    function handleOpenTask() {
        if (canManage) {
            // we will need to store the active task somewhere, for now just open modal
            openModal("taskPanel");
        }
    }

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString();
    }
</script>

<div
    class="task-card group flex flex-col gap-2 p-3 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 shadow-sm cursor-pointer transition-all {isDone
        ? 'opacity-60 hover:opacity-100'
        : ''}"
    style="border-left-width: 4px; border-left-color: {borderColor};"
    draggable={canManage}
    on:click={handleOpenTask}
    role="button"
    tabindex="0"
>
    <!-- Task Header -->
    <div class="flex justify-between items-start gap-2">
        <span
            class="text-sm font-medium text-[#111418] dark:text-gray-200 leading-snug {isDone
                ? 'line-through decoration-gray-400'
                : ''}"
        >
            {task.title}
        </span>
        {#if task.due_date}
            <span
                class="text-[10px] text-[#5c6b7f] dark:text-gray-400 flex-shrink-0"
            >
                {formatDate(task.due_date)}
            </span>
        {/if}
    </div>

    <!-- Task Description -->
    {#if task.description}
        <p class="text-xs text-[#5c6b7f] dark:text-gray-400 line-clamp-2 mt-1">
            {task.description}
        </p>
    {/if}

    <!-- Image Thumbnails -->
    {#if task.images && task.images.length > 0}
        <div class="flex gap-1 mt-2">
            {#each task.images.slice(0, 3) as img}
                <div
                    class="w-12 h-12 rounded-md overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0"
                >
                    <img
                        src={img}
                        alt="Attachment"
                        class="card-thumb w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        draggable="false"
                    />
                </div>
            {/each}
            {#if task.images.length > 3}
                <div
                    class="w-12 h-12 rounded-md bg-[#eff1f3] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0 flex items-center justify-center text-xs font-semibold text-[#5c6b7f] dark:text-gray-400"
                >
                    +{task.images.length - 3}
                </div>
            {/if}
        </div>
    {/if}

    <!-- Footer: Labels and Assignee -->
    <div class="mt-1 flex items-center justify-between gap-2">
        <div
            class="relative flex items-center min-h-[24px] flex-1 overflow-hidden"
        >
            <div
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <button
                    class="task-comment-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded"
                    title="Add comment"
                    on:click|stopPropagation={() => openModal("taskPanel")}
                >
                    <span
                        class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary"
                        >comment</span
                    >
                </button>
                <button
                    class="task-image-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded"
                    title="Add image"
                    on:click|stopPropagation={() => openModal("taskPanel")}
                >
                    <span
                        class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary"
                        >add_photo_alternate</span
                    >
                </button>
            </div>
            <div
                class="task-labels-row absolute left-0 right-0 overflow-hidden transition-all duration-200 group-hover:translate-x-16 group-hover:opacity-0"
            >
                <div class="task-labels-inner flex gap-1 items-center">
                    {#if task.labels}
                        {#each task.labels as label}
                            <span
                                class="inline-flex items-center flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white"
                                style="background-color: {label.color ||
                                    '#93c5fd'}"
                            >
                                {label.name}
                            </span>
                        {/each}
                    {/if}
                </div>
            </div>
        </div>

        <!-- Assignee Avatar -->
        {#if assignee}
            <div
                class="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold"
                title={assignee.full_name || assignee.email}
            >
                {initials}
            </div>
        {/if}
    </div>
</div>
