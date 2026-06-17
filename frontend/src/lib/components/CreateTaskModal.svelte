<script lang="ts">
    import { activeModal, closeModal, createTaskInitialData } from "$lib/stores/ui";
    import { columns, labels, setColumns, setTasks, tasks, activeBoardId, boardMembers } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { createTask, uploadImage, resolveImageUrl, createSubtask } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import { onMount } from "svelte";

    let isCreating = false;
    let saveError = "";

    let title = "";
    let description = "";
    let selectedColumnId = "";
    let selectedPriority: "low" | "medium" | "high" = "medium";
    let startDateValue = "";
    let dueDateValue = "";
    let selectedLabelIds: string[] = [];
    let taskImages: string[] = [];
    let isUploadingTaskImage = false;
    let taskImageUploadInput: HTMLInputElement | null = null;
    let selectedAssigneeId = "";
    let subtasks: { title: string }[] = [];
    let newSubtaskTitle = "";

    $: assigneeOptions = $boardMembers.map((member) => ({
        id: member.user?.id || member.user_id,
        name: member.user?.full_name || member.user_full_name || member.user?.email || member.user_email,
    }));

    $: canManage = ["owner", "editor", "moderator", "member"].includes($currentBoardRole);

    $: if ($activeModal !== "createTaskModal") {
        // Reset form when modal closes
        title = "";
        description = "";
        selectedColumnId = "";
        selectedPriority = "medium";
        startDateValue = "";
        dueDateValue = "";
        selectedLabelIds = [];
        taskImages = [];
        selectedAssigneeId = "";
        subtasks = [];
        newSubtaskTitle = "";
        saveError = "";
    }

    $: if ($activeModal === "createTaskModal") {
        if (!selectedColumnId) {
            selectedColumnId = $createTaskInitialData.columnId || ($columns.length > 0 ? $columns[0].id : "");
        }
        if (!dueDateValue && $createTaskInitialData.dueDate) {
            dueDateValue = $createTaskInitialData.dueDate;
        }
        if (!startDateValue && $createTaskInitialData.startDate) {
            startDateValue = $createTaskInitialData.startDate;
        }
    }

    function closePanel() {
        closeModal();
    }

    $: isPastDate = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = startDateValue ? new Date(startDateValue) : null;
        const due = dueDateValue ? new Date(dueDateValue) : null;
        return (start && start < today) || (due && due < today);
    })();

    async function handleCreateTask() {
        if (!canManage) return;
        if (!title.trim()) {
            saveError = "Task title is required";
            return;
        }
        if (!selectedColumnId) {
            saveError = "List is required";
            return;
        }

        isCreating = true;
        saveError = "";

        try {
            const newTask = await createTask(selectedColumnId, title.trim(), {
                description: description.trim(),
                priority: selectedPriority,
                labelIds: selectedLabelIds,
                start_date: startDateValue || undefined,
                due_date: dueDateValue || undefined,
                assignee_id: selectedAssigneeId || undefined,
                images: taskImages,
            });

            if (newTask && subtasks.length > 0) {
                // Create subtasks sequentially
                for (const st of subtasks) {
                    await createSubtask(newTask.id, st.title);
                }
            }

            await loadColumnsAndTasks();
            closePanel();
        } catch (e: any) {
            saveError = e?.message || "Failed to create task";
        } finally {
            isCreating = false;
        }
    }

    function addSubtask() {
        if (newSubtaskTitle.trim()) {
            subtasks = [...subtasks, { title: newSubtaskTitle.trim() }];
            newSubtaskTitle = "";
        }
    }

    function removeSubtask(index: number) {
        subtasks = subtasks.filter((_, i) => i !== index);
    }

    function removeTaskImage(index: number) {
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

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closePanel();
    }
</script>

{#if $activeModal === "createTaskModal"}
    <div
        class="absolute inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
    >
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
            class="absolute inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
            role="button"
            tabindex="0"
            aria-label="Close modal"
        ></div>

        <div
            class="relative w-full max-w-2xl bg-white dark:bg-[#151e29] shadow-2xl rounded-xl sm:rounded-2xl flex flex-col pointer-events-auto max-h-[90vh] overflow-hidden"
        >
            <div
                class="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[#e5e7eb] dark:border-[#1e2936]"
            >
                <div class="flex items-center gap-3 text-[#111418] dark:text-white min-w-0">
                    <span class="material-symbols-outlined text-2xl text-primary">add_task</span>
                    <h2 class="text-lg font-bold">Create New Task</h2>
                </div>
                <button
                    on:click={closePanel}
                    class="p-2 text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded-lg transition-colors"
                >
                    <span class="material-symbols-outlined text-xl">close</span>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-6 custom-scrollbar space-y-5">
                {#if saveError}
                    <div class="p-3 bg-red-50 text-red-600 rounded border border-red-200 text-sm">
                        {saveError}
                    </div>
                {/if}

                {#if isPastDate}
                    <div class="p-3 bg-yellow-50 text-yellow-700 rounded border border-yellow-200 text-sm flex items-center gap-2">
                        <span class="material-symbols-outlined text-[18px]">warning</span>
                        Warning: One or more dates are in the past.
                    </div>
                {/if}

                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Title</label>
                    <input
                        type="text"
                        bind:value={title}
                        class="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-[#111418] dark:text-white"
                        placeholder="Task title..."
                        autofocus
                    />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">List</label>
                        <select
                            bind:value={selectedColumnId}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#111418] dark:text-white"
                        >
                            {#each $columns as column}
                                <option value={column.id}>{column.title}</option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Priority</label>
                        <select
                            bind:value={selectedPriority}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#111418] dark:text-white"
                        >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Assignee</label>
                        <select
                            bind:value={selectedAssigneeId}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#111418] dark:text-white"
                        >
                            <option value="">Unassigned</option>
                            {#each assigneeOptions as assignee}
                                <option value={assignee.id}>{assignee.name}</option>
                            {/each}
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Start date</label>
                        <input
                            type="date"
                            bind:value={startDateValue}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#111418] dark:text-white"
                        />
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Due date</label>
                        <input
                            type="date"
                            bind:value={dueDateValue}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-[#111418] dark:text-white"
                        />
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Labels</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg max-h-[160px] overflow-y-auto custom-scrollbar">
                        {#if $labels.length === 0}
                            <p class="text-xs text-gray-400">No labels available</p>
                        {:else}
                            {#each $labels as label}
                                <label class="flex items-center gap-2 p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        value={label.id}
                                        checked={selectedLabelIds.includes(label.id)}
                                        on:change={(event) => {
                                            const isChecked = (event.currentTarget).checked;
                                            if (isChecked) {
                                                selectedLabelIds = [...selectedLabelIds, label.id];
                                            } else {
                                                selectedLabelIds = selectedLabelIds.filter((id) => id !== label.id);
                                            }
                                        }}
                                        class="rounded border-gray-300 dark:border-gray-600"
                                    />
                                    <span class="w-3 h-3 rounded" style="background-color: {label.color || '#93c5fd'}"></span>
                                    <span class="text-xs text-[#111418] dark:text-white">{label.name}</span>
                                </label>
                            {/each}
                        {/if}
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Description</label>
                    <textarea
                        rows="3"
                        bind:value={description}
                        class="w-full p-3 text-sm bg-white dark:bg-[#1a232e] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none custom-scrollbar text-[#111418] dark:text-white"
                        placeholder="Add a more detailed description..."
                    ></textarea>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-1">Subtasks</label>
                    <div class="flex flex-col gap-2">
                        {#each subtasks as st, idx}
                            <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                <span class="material-symbols-outlined text-gray-400 text-sm">radio_button_unchecked</span>
                                <span class="text-sm text-[#111418] dark:text-white flex-1">{st.title}</span>
                                <button type="button" on:click={() => removeSubtask(idx)} class="text-gray-400 hover:text-red-500">
                                    <span class="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>
                        {/each}
                        <div class="flex items-center gap-2 mt-1">
                            <input
                                type="text"
                                bind:value={newSubtaskTitle}
                                placeholder="Add a subtask..."
                                class="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-[#111418] dark:text-white"
                                on:keydown={(e) => e.key === 'Enter' && addSubtask()}
                            />
                            <button
                                type="button"
                                on:click={addSubtask}
                                disabled={!newSubtaskTitle.trim()}
                                class="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-[#111418] dark:text-white rounded-lg text-sm font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                            >
                                Add
                            </button>
                        </div>
                    </div>
                </div>

                <div class="mt-2 mb-2">
                    <div class="flex items-center justify-between mb-1.5">
                        <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase">Images</label>
                        <button type="button" on:click={() => taskImageUploadInput?.click()} class="p-0.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md text-primary hover:text-blue-600 transition-colors inline-flex items-center justify-center">
                            <span class="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                        </button>
                    </div>
                    <input type="file" accept="image/*" multiple class="hidden" bind:this={taskImageUploadInput} on:change={onTaskImageUpload} />
                    {#if taskImages.length > 0}
                        <div class="grid grid-cols-4 gap-2 p-1.5 border border-[#e5e7eb] dark:border-[#1e2936] rounded bg-[#fbfcfd] dark:bg-[#0d141c]">
                            {#each taskImages as imageUrl, idx}
                                <div class="relative group aspect-square rounded overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800">
                                    <img src={resolveImageUrl(imageUrl)} alt="Upload preview" class="w-full h-full object-cover" />
                                    <button type="button" on:click={() => removeTaskImage(idx)} class="absolute top-0.5 right-0.5 h-4 w-4 flex items-center justify-center bg-red-600/75 hover:bg-red-600 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-colors">
                                        <span class="material-symbols-outlined text-[10px] leading-none">close</span>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    {/if}
                    {#if isUploadingTaskImage}
                        <p class="text-[10px] text-[#5c6b7f] dark:text-gray-400 mt-1">Uploading image...</p>
                    {/if}
                </div>
            </div>

            <div class="px-4 sm:px-6 py-4 border-t border-[#e5e7eb] dark:border-[#1e2936] flex justify-end gap-3 bg-gray-50 dark:bg-[#1a232e]">
                <button
                    on:click={closePanel}
                    class="px-4 py-2 text-sm font-semibold text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
                >
                    Cancel
                </button>
                <button
                    on:click={handleCreateTask}
                    disabled={isCreating || !title.trim()}
                    class="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {#if isCreating}
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                        Creating...
                    {:else}
                        <span class="material-symbols-outlined text-[18px]">add</span>
                        Create Task
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
