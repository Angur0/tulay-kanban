<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import {
        boardMembers,
        columns,
        labels,
        setActiveTask,
        setTasks,
        tasks,
    } from "$lib/stores/board";
    import { currentBoardRole, currentUser } from "$lib/stores/user";
    import {
        createTaskComment,
        deleteTask,
        deleteTaskComment,
        getTaskComments,
        resolveImageUrl,
        updateTask,
        uploadImage,
    } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import type { Task, TaskComment } from "$lib/types";

    export let task: Task | null = null;

    let initializedTaskId: string | null = null;
    let isSaving = false;
    let isDeleting = false;
    let saveError = "";

    let title = "";
    let description = "";
    let selectedColumnId = "";
    let selectedPriority: "low" | "medium" | "high" = "medium";
    let dueDateValue = "";
    let selectedAssigneeId = "";
    let selectedLabelIds: string[] = [];
    let taskImages: string[] = [];

    let comments: TaskComment[] = [];
    let commentInput = "";
    let commentImages: string[] = [];
    let isPostingComment = false;
    let isUploadingTaskImage = false;
    let isUploadingCommentImage = false;

    let taskImageUploadInput: HTMLInputElement | null = null;
    let commentImageUploadInput: HTMLInputElement | null = null;
    let isLightboxOpen = false;
    let lightboxImages: string[] = [];
    let lightboxIndex = 0;

    $: canManage = ["owner", "moderator", "member"].includes($currentBoardRole);
    $: assigneeOptions = $boardMembers.map((member) => ({
        id: member.user?.id || member.user_id,
        name:
            member.user?.full_name ||
            member.user_full_name ||
            member.user?.email ||
            member.user_email,
    }));
    $: currentColumnName =
        $columns.find((column) => column.id === selectedColumnId)?.title ||
        "Unknown";

    $: if ($activeModal !== "taskPanel") {
        initializedTaskId = null;
    }

    $: if (
        $activeModal === "taskPanel" &&
        task &&
        task.id !== initializedTaskId
    ) {
        initializedTaskId = task.id;
        title = task.title || "";
        description = task.description || "";
        selectedColumnId = task.column_id || "";
        selectedPriority =
            (task.priority as "low" | "medium" | "high") || "medium";
        dueDateValue = task.due_date
            ? new Date(task.due_date).toISOString().split("T")[0]
            : "";
        selectedAssigneeId = task.assignee_id || "";
        selectedLabelIds =
            task.labels?.map((label) => label.id) || task.label_ids || [];
        taskImages = [...(task.images || [])];
        comments = [];
        commentInput = "";
        commentImages = [];
        saveError = "";
        void loadComments();
    }

    async function loadComments() {
        if (!task) return;
        try {
            comments = await getTaskComments(task.id);
        } catch (e) {
            console.error("Failed to load comments", e);
        }
    }

    function closePanel() {
        closeModal();
    }

    function validateDueDate() {
        if (!dueDateValue) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(dueDateValue) >= today;
    }

    function buildStatus(columnId: string, fallback: string) {
        const statusTitle = $columns.find(
            (column) => column.id === columnId,
        )?.title;
        if (!statusTitle) return fallback;
        return statusTitle.toLowerCase().replace(/\s+/g, "");
    }

    function getSelectedLabelObjects() {
        return $labels.filter((label) => selectedLabelIds.includes(label.id));
    }

    async function saveTask() {
        if (!task || !canManage) return;
        if (!title.trim()) {
            saveError = "Task title is required";
            return;
        }
        if (!validateDueDate()) {
            saveError = "Due date cannot be in the past";
            return;
        }

        isSaving = true;
        saveError = "";

        const payload = {
            title: title.trim(),
            description: description.trim(),
            column_id: selectedColumnId,
            status: buildStatus(selectedColumnId, task.status),
            priority: selectedPriority,
            label_ids: selectedLabelIds,
            due_date: dueDateValue || null,
            assignee_id: selectedAssigneeId || null,
            images: taskImages,
        };

        try {
            await updateTask(task.id, payload);

            const selectedLabels = getSelectedLabelObjects();
            setTasks(
                $tasks.map((taskItem) =>
                    taskItem.id === task.id
                        ? {
                              ...taskItem,
                              ...payload,
                              labels: selectedLabels,
                          }
                        : taskItem,
                ),
            );

            setActiveTask({
                ...task,
                ...payload,
                labels: selectedLabels,
            });

            await loadColumnsAndTasks();
            closePanel();
        } catch (e: any) {
            saveError = e?.message || "Failed to save task";
        } finally {
            isSaving = false;
        }
    }

    async function handleDeleteTask() {
        if (!task || !canManage || isDeleting) return;
        if (!confirm("Delete this task?")) return;

        isDeleting = true;
        try {
            await deleteTask(task.id);
            setTasks($tasks.filter((taskItem) => taskItem.id !== task.id));
            setActiveTask(null);
            closePanel();
        } catch (e: any) {
            saveError = e?.message || "Failed to delete task";
        } finally {
            isDeleting = false;
        }
    }

    function removeTaskImage(index: number) {
        if (!canManage) return;
        taskImages = taskImages.filter((_, idx) => idx !== index);
    }

    async function onTaskImageUpload(event: Event) {
        if (!canManage) return;
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length === 0) return;

        isUploadingTaskImage = true;
        try {
            const uploadedUrls = await Promise.all(
                files.map((file) => uploadImage(file)),
            );
            taskImages = [...taskImages, ...uploadedUrls];
        } catch (e: any) {
            saveError = e?.message || "Failed to upload image";
        } finally {
            isUploadingTaskImage = false;
            if (taskImageUploadInput) {
                taskImageUploadInput.value = "";
            }
        }
    }

    function removeCommentImage(index: number) {
        commentImages = commentImages.filter((_, idx) => idx !== index);
    }

    async function onCommentImageUpload(event: Event) {
        const input = event.target as HTMLInputElement;
        const files = Array.from(input.files || []);
        if (files.length === 0) return;

        isUploadingCommentImage = true;
        try {
            const uploadedUrls = await Promise.all(
                files.map((file) => uploadImage(file)),
            );
            commentImages = [...commentImages, ...uploadedUrls];
        } catch (e: any) {
            saveError = e?.message || "Failed to upload comment image";
        } finally {
            isUploadingCommentImage = false;
            if (commentImageUploadInput) {
                commentImageUploadInput.value = "";
            }
        }
    }

    async function postComment() {
        if (!task || isPostingComment) return;
        const content = commentInput.trim();
        if (!content && commentImages.length === 0) return;

        isPostingComment = true;
        try {
            await createTaskComment(task.id, {
                content,
                images: commentImages,
            });
            commentInput = "";
            commentImages = [];
            await loadComments();
        } catch (e: any) {
            saveError = e?.message || "Failed to post comment";
        } finally {
            isPostingComment = false;
        }
    }

    async function onDeleteComment(commentId: string) {
        try {
            await deleteTaskComment(commentId);
            comments = comments.filter((comment) => comment.id !== commentId);
        } catch (e: any) {
            saveError = e?.message || "Failed to delete comment";
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closePanel();
    }

    function formatDateTime(dateValue: string) {
        const parsed = new Date(dateValue);
        return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }

    function openLightbox(images: string[], index: number) {
        if (!images.length) return;
        lightboxImages = images.map((url) => resolveImageUrl(url));
        lightboxIndex = Math.max(0, Math.min(index, lightboxImages.length - 1));
        isLightboxOpen = true;
    }

    function closeLightbox() {
        isLightboxOpen = false;
        lightboxImages = [];
        lightboxIndex = 0;
    }

    function showPrevImage() {
        if (!lightboxImages.length) return;
        lightboxIndex =
            (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    }

    function showNextImage() {
        if (!lightboxImages.length) return;
        lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    }
</script>

<svelte:window
    on:open-task-lightbox={(
        event: CustomEvent<{
            taskId?: string;
            imageIndex: number;
            images?: string[];
        }>,
    ) => {
        const { imageIndex, images = [] } = event.detail || {
            imageIndex: 0,
            images: [],
        };
        if (!images.length) return;
        openLightbox(images, imageIndex ?? 0);
    }}
    on:keydown={(event) => {
        if (!isLightboxOpen) return;
        if (event.key === "Escape") closeLightbox();
        if (event.key === "ArrowLeft") showPrevImage();
        if (event.key === "ArrowRight") showNextImage();
    }}
/>

{#if $activeModal === "taskPanel" && task}
    <div
        class="fixed inset-x-0 bottom-0 top-8 z-[60] flex justify-end"
        role="dialog"
        aria-modal="true"
    >
        <div
            class="fixed inset-x-0 bottom-0 top-8 bg-gray-900/20 transition-opacity"
            on:click={handleBackdropClick}
            on:keydown={(event) => {
                if (event.key === "Escape") closePanel();
            }}
            role="button"
            tabindex="0"
            aria-label="Close task panel"
        ></div>

        <div
            class="relative w-full max-w-2xl h-full bg-white dark:bg-[#151e29] shadow-2xl border-l border-t border-[#e5e7eb] dark:border-[#1e2936] flex flex-col pointer-events-auto rounded-tl-2xl"
        >
            <div
                class="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] dark:border-[#1e2936]"
            >
                <div
                    class="flex items-center gap-3 text-[#111418] dark:text-white"
                >
                    <span
                        class="material-symbols-outlined text-2xl text-primary"
                        >view_timeline</span
                    >
                    <div>
                        <input
                            type="text"
                            bind:value={title}
                            class="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-[#111418] dark:text-white w-full"
                            readonly={!canManage}
                        />
                        <p
                            class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1"
                        >
                            In {currentColumnName}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    {#if canManage}
                        <button
                            on:click={handleDeleteTask}
                            disabled={isDeleting}
                            class="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-[#5c6b7f] dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Delete task"
                        >
                            <span class="material-symbols-outlined text-[20px]"
                                >delete</span
                            >
                        </button>
                    {/if}
                    <button
                        on:click={closePanel}
                        class="p-2 text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded-lg transition-colors"
                    >
                        <span class="material-symbols-outlined text-xl"
                            >close</span
                        >
                    </button>
                </div>
            </div>

            <div
                class="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-6"
            >
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label
                            class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                            >Status</label
                        >
                        <select
                            bind:value={selectedColumnId}
                            disabled={!canManage}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        >
                            {#each $columns as column}
                                <option value={column.id}>{column.title}</option
                                >
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                            >Priority</label
                        >
                        <select
                            bind:value={selectedPriority}
                            disabled={!canManage}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <div>
                        <label
                            class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                            >Due date</label
                        >
                        <input
                            type="date"
                            bind:value={dueDateValue}
                            min={new Date().toISOString().split("T")[0]}
                            disabled={!canManage}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        />
                    </div>

                    <div>
                        <label
                            class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                            >Assignee</label
                        >
                        <select
                            bind:value={selectedAssigneeId}
                            disabled={!canManage}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                        >
                            <option value="">Unassigned</option>
                            {#each assigneeOptions as assignee}
                                <option value={assignee.id}
                                    >{assignee.name}</option
                                >
                            {/each}
                        </select>
                    </div>
                </div>

                <div>
                    <label
                        class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                        >Labels</label
                    >
                    <div
                        class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg max-h-[160px] overflow-y-auto custom-scrollbar"
                    >
                        {#if $labels.length === 0}
                            <p class="text-xs text-gray-400">
                                No labels available
                            </p>
                        {:else}
                            {#each $labels as label}
                                <label
                                    class="flex items-center gap-2 p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        value={label.id}
                                        checked={selectedLabelIds.includes(
                                            label.id,
                                        )}
                                        disabled={!canManage}
                                        on:change={(event) => {
                                            const isChecked = (
                                                event.currentTarget as HTMLInputElement
                                            ).checked;
                                            if (isChecked) {
                                                selectedLabelIds = [
                                                    ...selectedLabelIds,
                                                    label.id,
                                                ];
                                            } else {
                                                selectedLabelIds =
                                                    selectedLabelIds.filter(
                                                        (id) => id !== label.id,
                                                    );
                                            }
                                        }}
                                        class="rounded border-gray-300 dark:border-gray-600"
                                    />
                                    <span
                                        class="w-3 h-3 rounded"
                                        style="background-color: {label.color ||
                                            '#93c5fd'}"
                                    ></span>
                                    <span
                                        class="text-xs text-[#111418] dark:text-white"
                                        >{label.name}</span
                                    >
                                </label>
                            {/each}
                        {/if}
                    </div>
                </div>

                <div>
                    <label
                        class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1"
                        >Description</label
                    >
                    <textarea
                        rows="4"
                        bind:value={description}
                        readonly={!canManage}
                        class="w-full p-3 text-sm bg-white dark:bg-[#1a232e] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none custom-scrollbar"
                        placeholder="Add a more detailed description..."
                    ></textarea>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2">
                        <label
                            class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider"
                            >Task images</label
                        >
                        {#if canManage}
                            <button
                                type="button"
                                on:click={() => taskImageUploadInput?.click()}
                                class="text-xs font-medium text-primary hover:text-blue-600"
                            >
                                Add image
                            </button>
                        {/if}
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        class="hidden"
                        bind:this={taskImageUploadInput}
                        on:change={onTaskImageUpload}
                    />
                    <div
                        class="grid grid-cols-3 gap-2 p-2 border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg bg-[#fbfcfd] dark:bg-[#0d141c]"
                    >
                        {#if taskImages.length === 0}
                            <div class="col-span-3 text-xs text-[#8a98a8] p-2">
                                No images added yet
                            </div>
                        {:else}
                            {#each taskImages as imageUrl, idx}
                                <div
                                    class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800"
                                >
                                    <button
                                        type="button"
                                        class="w-full h-full"
                                        on:click={() =>
                                            openLightbox(taskImages, idx)}
                                    >
                                        <img
                                            src={resolveImageUrl(imageUrl)}
                                            alt="Task"
                                            class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        />
                                    </button>
                                    {#if canManage}
                                        <button
                                            type="button"
                                            on:click={() =>
                                                removeTaskImage(idx)}
                                            class="absolute top-1 right-1 h-4 w-4 flex items-center justify-center bg-red-600/75 hover:bg-red-600 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-colors"
                                        >
                                            <span
                                                class="material-symbols-outlined text-[10px] leading-none"
                                                >close</span
                                            >
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        {/if}
                    </div>
                    {#if isUploadingTaskImage}
                        <p
                            class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1"
                        >
                            Uploading image...
                        </p>
                    {/if}
                </div>

                <div>
                    <h3
                        class="text-sm font-semibold text-[#111418] dark:text-white mb-2"
                    >
                        Comments
                    </h3>
                    <div
                        class="space-y-3 mb-4 max-h-[320px] overflow-y-auto custom-scrollbar"
                    >
                        {#if comments.length === 0}
                            <div
                                class="text-xs text-[#8a98a8] text-center py-4"
                            >
                                No comments yet. Be the first to comment!
                            </div>
                        {:else}
                            {#each comments as comment}
                                <div
                                    class="bg-white dark:bg-[#151e29] rounded-lg p-3 border border-[#e5e7eb] dark:border-[#1e2936]"
                                >
                                    <div
                                        class="flex items-start justify-between mb-2"
                                    >
                                        <div
                                            class="text-xs text-[#5c6b7f] dark:text-gray-400"
                                        >
                                            {formatDateTime(comment.created_at)}
                                        </div>
                                        {#if $currentUser && String(comment.user_id) === String($currentUser.id)}
                                            <button
                                                on:click={() =>
                                                    onDeleteComment(comment.id)}
                                                class="p-1 text-[#5c6b7f] hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                                                title="Delete comment"
                                            >
                                                <span
                                                    class="material-symbols-outlined text-[18px]"
                                                    >delete</span
                                                >
                                            </button>
                                        {/if}
                                    </div>
                                    <div
                                        class="text-sm text-[#111418] dark:text-gray-200 whitespace-pre-wrap"
                                    >
                                        {comment.content}
                                    </div>
                                    {#if comment.images && comment.images.length > 0}
                                        <div
                                            class="grid grid-cols-3 gap-2 mt-2"
                                        >
                                            {#each comment.images as imageUrl, imageIdx}
                                                <button
                                                    type="button"
                                                    class="aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936]"
                                                    on:click={() =>
                                                        openLightbox(
                                                            comment.images ||
                                                                [],
                                                            imageIdx,
                                                        )}
                                                >
                                                    <img
                                                        src={resolveImageUrl(
                                                            imageUrl,
                                                        )}
                                                        alt="Comment"
                                                        class="w-full h-full object-cover cursor-pointer hover:opacity-90"
                                                    />
                                                </button>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        {/if}
                    </div>

                    <div
                        class="bg-[#f6f7f8] dark:bg-[#0d141c] rounded-xl p-3 border border-[#e5e7eb] dark:border-[#1e2936]"
                    >
                        <textarea
                            placeholder="Write a comment..."
                            rows="3"
                            bind:value={commentInput}
                            class="w-full px-3 py-2 bg-white dark:bg-[#151e29] text-[#111418] dark:text-white border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                        ></textarea>

                        {#if commentImages.length > 0}
                            <div class="grid grid-cols-4 gap-2 mt-3">
                                {#each commentImages as imageUrl, idx}
                                    <div
                                        class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936]"
                                    >
                                        <img
                                            src={resolveImageUrl(imageUrl)}
                                            alt="Upload preview"
                                            class="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            on:click={() =>
                                                removeCommentImage(idx)}
                                            class="absolute top-1 right-1 h-4 w-4 flex items-center justify-center bg-red-600/75 hover:bg-red-600 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-colors"
                                        >
                                            <span
                                                class="material-symbols-outlined text-[10px] leading-none"
                                                >close</span
                                            >
                                        </button>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        <div class="flex items-center justify-between mt-3">
                            <div class="flex items-center gap-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    class="hidden"
                                    bind:this={commentImageUploadInput}
                                    on:change={onCommentImageUpload}
                                />
                                <button
                                    type="button"
                                    on:click={() =>
                                        commentImageUploadInput?.click()}
                                    class="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                >
                                    <span
                                        class="material-symbols-outlined text-[16px]"
                                        >image</span
                                    >
                                    Add images
                                </button>
                                {#if isUploadingCommentImage}
                                    <span
                                        class="text-xs text-[#5c6b7f] dark:text-gray-400"
                                        >Uploading...</span
                                    >
                                {/if}
                            </div>
                            <button
                                type="button"
                                on:click={postComment}
                                disabled={isPostingComment ||
                                    (!commentInput.trim() &&
                                        commentImages.length === 0)}
                                class="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
                            >
                                <span
                                    class="material-symbols-outlined text-[16px]"
                                    >send</span
                                >
                                Post
                            </button>
                        </div>
                    </div>
                </div>

                {#if saveError}
                    <p class="text-sm text-red-600 dark:text-red-400">
                        {saveError}
                    </p>
                {/if}
            </div>

            {#if isLightboxOpen && lightboxImages.length > 0}
                <div
                    class="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                    on:click={closeLightbox}
                >
                    <button
                        type="button"
                        class="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                        on:click|stopPropagation={closeLightbox}
                        aria-label="Close image viewer"
                    >
                        <span class="material-symbols-outlined">close</span>
                    </button>

                    {#if lightboxImages.length > 1}
                        <button
                            type="button"
                            class="absolute left-4 h-9 w-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white"
                            on:click|stopPropagation={showPrevImage}
                            aria-label="Previous image"
                        >
                            <span
                                class="material-symbols-outlined text-[20px] leading-none"
                                >chevron_left</span
                            >
                        </button>
                    {/if}

                    <img
                        src={lightboxImages[lightboxIndex]}
                        alt="Expanded"
                        class="max-w-[92vw] max-h-[88vh] object-contain"
                        on:click|stopPropagation
                    />

                    {#if lightboxImages.length > 1}
                        <button
                            type="button"
                            class="absolute right-4 h-9 w-9 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white"
                            on:click|stopPropagation={showNextImage}
                            aria-label="Next image"
                        >
                            <span
                                class="material-symbols-outlined text-[20px] leading-none"
                                >chevron_right</span
                            >
                        </button>
                    {/if}
                </div>
            {/if}

            <div
                class="px-6 py-4 border-t border-[#e5e7eb] dark:border-[#1e2936] flex justify-end gap-2"
            >
                <button
                    on:click={closePanel}
                    class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]"
                >
                    Cancel
                </button>
                {#if canManage}
                    <button
                        on:click={saveTask}
                        disabled={isSaving}
                        class="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}
