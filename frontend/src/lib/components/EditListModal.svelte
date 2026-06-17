<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { columns, editListTarget } from "$lib/stores/board";
    import { updateColumn } from "$lib/api/listsApi";
    import { loadColumnsAndTasks } from "$lib/api/boardDataApi";

    let title = "";
    let isHidden = false;
    let isArchive = false;

    // Reactively populate state when target changes
    $: if ($editListTarget) {
        title = $editListTarget.title;
        isHidden = $editListTarget.is_hidden || false;
        isArchive = $editListTarget.is_archive || false;
    }

    $: hasArchive = $columns.some(col => col.is_archive && col.id !== $editListTarget?.id);

    async function handleSave() {
        if (!title.trim() || !$editListTarget) return;
        try {
            await updateColumn($editListTarget.id, {
                title: title.trim(),
                is_hidden: isHidden,
                is_archive: isArchive
            });
            await loadColumnsAndTasks();
            closeModal();
        } catch (e) {
            console.error("Failed to update list", e);
        }
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "editListModal" && $editListTarget}
    <div class="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <!-- svelte-ignore a11y-click-events-have-key-events bg-click -->
        <div
            class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
        ></div>
        <div
            class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto"
            >
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-4 text-primary">
                        <div
                            class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                            <span class="material-symbols-outlined text-2xl"
                                >edit</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Edit List Settings
                        </h3>
                    </div>
                    <div class="mb-4">
                        <label
                            for="editListTitle"
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >List Title</label
                        >
                        <input
                            type="text"
                            id="editListTitle"
                            bind:value={title}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="List Title"
                            autofocus
                        />
                    </div>
                    
                    <div class="mb-6 flex flex-col gap-3">
                        <label class="flex items-center gap-2 cursor-pointer text-sm text-[#111418] dark:text-white">
                            <input type="checkbox" bind:checked={isHidden} class="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-primary focus:ring-primary/50" />
                            <span>Hidden List (Only visible when filter is active)</span>
                        </label>
                        <label class="flex items-center gap-2 cursor-pointer text-sm text-[#111418] dark:text-white {hasArchive ? 'opacity-50 cursor-not-allowed' : ''}">
                            <input type="checkbox" bind:checked={isArchive} disabled={hasArchive} class="rounded border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-primary focus:ring-primary/50" />
                            <span>Archive List (Tasks moved here instead of deleted)</span>
                        </label>
                        {#if hasArchive}
                            <span class="text-[11px] text-gray-500 dark:text-gray-400 italic">An archive list already exists on this board.</span>
                        {/if}
                    </div>

                    <div class="flex justify-end gap-3">
                        <button
                            on:click={closeModal}
                            class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]"
                        >
                            Cancel
                        </button>
                        <button
                            on:click={handleSave}
                            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors rounded-lg shadow-sm"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
