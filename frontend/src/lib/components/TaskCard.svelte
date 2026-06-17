<script lang="ts">
    import type { Task } from "$lib/types";
    import { currentBoardRole } from "$lib/stores/user";
    import { boardMembers } from "$lib/stores/board";
    import { openModal } from "$lib/stores/ui";
    import { setActiveTask } from "$lib/stores/board";
    import { openContextMenu } from "$lib/stores/context-menu";
    import { resolveImageUrl } from "$lib/api/tasksApi";
    import { createEventDispatcher } from "svelte";
    import { startTouchDrag, moveTouchDrag, commitTouchDrop, cancelTouchDrag, touchDrag } from "$lib/stores/touch-drag";

    const dispatch = createEventDispatcher<{
        taskDragStart: { taskId: string; columnId: string };
        taskDragEnd: undefined;
    }>();

    export let task: Task;

    $: canManage = ["owner", "moderator", "member"].includes($currentBoardRole);
    $: assignee = task.assignee_id
        ? $boardMembers
              .map((member) => member.user || { id: member.user_id, email: member.user_email, full_name: member.user_full_name })
              .find((user) => user.id === task.assignee_id)
        : null;
    $: initials = assignee
        ? (assignee.full_name || assignee.email || "")
              .split(/[\s@]+/)
              .slice(0, 2)
              .map((p: string) => p[0].toUpperCase())
              .join("")
        : "";

    const priorityColors: Record<string, string> = {
        low: "#22c55e",
        medium: "#f97316",
        high: "#ef4444",
    };
    $: borderColor = priorityColors[task.priority] || priorityColors.medium;

    function handleOpenTask() {
        setActiveTask(task);
        openModal("taskPanel");
    }

    function openImageGallery(imageIndex: number) {
        setActiveTask(task);
        openModal("taskPanel");
        setTimeout(() => {
            window.dispatchEvent(
                new CustomEvent("open-task-lightbox", {
                    detail: {
                        taskId: task.id,
                        imageIndex,
                        images: task.images || [],
                    },
                })
            );
        }, 0);
    }

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString();
    }

    function handleTaskContextMenu(event: MouseEvent) {
        event.preventDefault();
        event.stopPropagation();
        openContextMenu({
            type: "task",
            x: event.clientX,
            y: event.clientY,
            task,
        });
    }

    function handleDragStart(event: DragEvent) {
        if (!canManage || !event.dataTransfer) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("application/x-task-id", task.id);
        event.dataTransfer.setData("application/x-source-column-id", task.column_id);
        event.dataTransfer.setData("text/plain", task.id);
        dispatch("taskDragStart", { taskId: task.id, columnId: task.column_id });
    }

    function handleDragEnd() {
        dispatch("taskDragEnd", undefined);
    }

    // ── Touch / Pointer drag logic ────────────────────────────────────────────
    const HOLD_MS = 300;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let isTouchDragging = false;
    let pointerStartX = 0;
    let pointerStartY = 0;
    const MOVE_THRESHOLD = 8; // px before we decide the user is scrolling

    function handlePointerDown(event: PointerEvent) {
        // Only intercept touch/pen; let mouse use HTML5 DnD as before
        if (!canManage || event.pointerType === "mouse") return;

        pointerStartX = event.clientX;
        pointerStartY = event.clientY;
        isTouchDragging = false;

        holdTimer = setTimeout(() => {
            isTouchDragging = true;
            startTouchDrag(task.id, task.column_id, event.clientX, event.clientY);
            // Suppress the pending click so the task modal doesn't open
            suppressNextClick = true;
        }, HOLD_MS);
    }

    function handlePointerMove(event: PointerEvent) {
        if (event.pointerType === "mouse") return;
        if (!isTouchDragging) {
            // If the pointer moved noticeably before the hold timer fired, cancel it
            const dx = Math.abs(event.clientX - pointerStartX);
            const dy = Math.abs(event.clientY - pointerStartY);
            if ((dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) && holdTimer) {
                clearTimeout(holdTimer);
                holdTimer = null;
            }
            return;
        }
        event.preventDefault();
        moveTouchDrag(event.clientX, event.clientY);
    }

    function handlePointerUp(event: PointerEvent) {
        if (event.pointerType === "mouse") return;
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (!isTouchDragging) return;
        isTouchDragging = false;
        // The Column component that owns the element under the pointer
        // will react to touchDrag becoming inactive and fire taskDrop.
        // We just need to signal the drop with the final coordinates.
        window.dispatchEvent(new CustomEvent("touch-task-drop", {
            detail: { x: event.clientX, y: event.clientY }
        }));
        commitTouchDrop();
    }

    function handlePointerCancel(event: PointerEvent) {
        if (event.pointerType === "mouse") return;
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        isTouchDragging = false;
        cancelTouchDrag();
    }

    let suppressNextClick = false;
    function handleClick(event: MouseEvent) {
        if (suppressNextClick) {
            suppressNextClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        handleOpenTask();
    }

    $: isTouchActive = $touchDrag.active && $touchDrag.taskId === task.id;
</script>

<div
    class="task-card group flex flex-col gap-2 p-3 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 shadow-sm cursor-pointer transition-all {isTouchActive ? 'opacity-50 scale-95' : ''}"
    style="border-left-width: 4px; border-left-color: {borderColor}; touch-action: {isTouchActive ? 'none' : 'pan-x pan-y'};"
    data-task-id={task.id}
    draggable={canManage}
    on:click={handleClick}
    on:contextmenu={handleTaskContextMenu}
    on:dragstart={handleDragStart}
    on:dragend={handleDragEnd}
    on:pointerdown={handlePointerDown}
    on:pointermove={handlePointerMove}
    on:pointerup={handlePointerUp}
    on:pointercancel={handlePointerCancel}
    role="button"
    tabindex="0"
>
    <!-- Task Header -->
    <div class="flex justify-between items-start gap-2">
        <span
            class="text-sm font-medium text-[#111418] dark:text-gray-200 leading-snug"
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
        <button
            type="button"
            class="relative mt-2 w-full h-12 rounded-md overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] group/image"
            on:click|stopPropagation={() => openImageGallery(0)}
            title="Open image gallery"
        >
            <img
                src={resolveImageUrl(task.images[0])}
                alt="Attachment"
                class="card-thumb w-full h-full object-cover transition-opacity group-hover/image:opacity-75"
                draggable="false"
            />
            <div
                class="absolute inset-0 bg-black/45 text-white text-xs font-semibold opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center"
            >
                +{task.images.length}
            </div>
        </button>
    {/if}

    <!-- Footer: Labels and Assignee -->
    <div class="mt-1 flex items-center justify-between gap-2">
        <div
            class="relative flex items-center min-h-[24px] flex-1 overflow-hidden"
        >
            <div
                class="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            >
                <button
                    class="task-comment-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded"
                    title="Add comment"
                    on:click|stopPropagation={() => {
                        setActiveTask(task);
                        openModal("taskPanel");
                    }}
                >
                    <span
                        class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary"
                        >comment</span
                    >
                </button>
                <button
                    class="task-image-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded"
                    title="Add image"
                    on:click|stopPropagation={() => {
                        setActiveTask(task);
                        openModal("taskPanel");
                    }}
                >
                    <span
                        class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary"
                        >add_photo_alternate</span
                    >
                </button>
            </div>
            <div
                class="task-labels-row absolute left-16 right-0 md:left-0 md:right-0 overflow-hidden transition-all duration-200 md:group-hover:translate-x-16 md:group-hover:opacity-0"
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
