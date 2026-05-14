<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { createTask, uploadImage, resolveImageUrl } from "$lib/api/tasksApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";
    import { labels } from "$lib/stores/board";

    export let columnId: string;

    const dispatch = createEventDispatcher<{
        close: void;
    }>();

    let title = "";
    let description = "";
    let priority: "low" | "medium" | "high" = "medium";
    let selectedLabelIds: string[] = [];
    let startDate = "";
    let dueDate = "";
    let taskImages: string[] = [];
    
    let isUploadingTaskImage = false;
    let taskImageUploadInput: HTMLInputElement | null = null;

    function handleClose() {
        dispatch("close");
    }

    async function handleCreate() {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) return;

        try {
            await createTask(columnId, trimmedTitle, {
                description: description.trim(),
                priority,
                labelIds: selectedLabelIds,
                start_date: startDate || undefined,
                due_date: dueDate || undefined,
                images: taskImages,
            });
            await loadColumnsAndTasks();
            handleClose();
        } catch (e) {
            console.error("Failed to create task", e);
        }
    }

    function toggleLabel(labelId: string, checked: boolean) {
        if (checked) {
            selectedLabelIds = [...selectedLabelIds, labelId];
        } else {
            selectedLabelIds = selectedLabelIds.filter((id) => id !== labelId);
        }
    }

    async function onTaskImageUpload(event: Event) {
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
            console.error("Failed to upload image", e);
        } finally {
            isUploadingTaskImage = false;
            if (taskImageUploadInput) {
                taskImageUploadInput.value = "";
            }
        }
    }

    function removeTaskImage(index: number) {
        taskImages = taskImages.filter((_, idx) => idx !== index);
    }
</script>

<div
    class="flex flex-col gap-3 p-4 bg-white dark:bg-[#151e29] rounded-lg border-2 border-primary ring-4 ring-primary/20 shadow-xl mb-1 min-w-[320px]"
>
    <input
        type="text"
        bind:value={title}
        class="w-full text-sm font-semibold text-[#111418] dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400"
        placeholder="Task title..."
        autofocus
        on:keydown={(e) => {
            if (e.key === "Escape") handleClose();
        }}
    />
    <textarea
        bind:value={description}
        class="w-full text-xs text-[#5c6b7f] dark:text-gray-300 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder-gray-400 custom-scrollbar"
        rows="2"
        placeholder="Add a description (optional)..."
        on:keydown={(e) => {
            if (e.key === "Escape") handleClose();
        }}
    ></textarea>

    <div class="flex gap-3">
        <div class="flex-shrink-0">
            <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Priority</label>
            <select
                bind:value={priority}
                class="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
            </select>
        </div>

        <div class="flex-1 min-w-0">
            <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Labels</label>
            <div class="flex flex-col gap-0.5 p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg max-h-[140px] overflow-y-auto custom-scrollbar">
                {#if $labels.length === 0}
                    <p class="text-xs text-gray-400 py-2 text-center">No labels available</p>
                {:else}
                    {#each $labels as label}
                        <label class="flex items-center gap-2 cursor-pointer hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] px-2 py-1.5 rounded transition-colors">
                            <input
                                type="checkbox"
                                class="rounded border-gray-300 w-3.5 h-3.5"
                                checked={selectedLabelIds.includes(label.id)}
                                on:change={(e) => toggleLabel(label.id, (e.currentTarget).checked)}
                            />
                            <span class="w-3 h-3 rounded" style="background-color: {label.color || '#93c5fd'}"></span>
                            <span class="text-xs text-[#111418] dark:text-white">{label.name}</span>
                        </label>
                    {/each}
                {/if}
            </div>
        </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mt-2">
        <div>
            <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Start date</label>
            <input type="date" bind:value={startDate} class="w-full text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:ring-2 focus:ring-primary/50 focus:outline-none" />
        </div>
        <div>
            <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Due date</label>
            <input type="date" bind:value={dueDate} class="w-full text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:ring-2 focus:ring-primary/50 focus:outline-none" />
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

    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e7eb] dark:border-[#1e2936]">
        <button
            on:click={handleClose}
            class="text-xs text-[#5c6b7f] hover:text-[#111418] px-3 py-2 rounded-lg hover:bg-[#eff1f3] transition-colors"
        >
            Cancel
        </button>
        <button
            on:click={handleCreate}
            class="flex items-center gap-1.5 bg-primary hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"
            disabled={!title.trim()}
        >
            <span class="material-symbols-outlined text-[16px]">add</span>
            Create Task
        </button>
    </div>
</div>
