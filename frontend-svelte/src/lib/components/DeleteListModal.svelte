<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { deleteListTarget, setDeleteListTarget } from "$lib/stores/board";
    import { deleteColumn } from "$lib/api/listsApi";

    let confirmText = "";
    let isDeleting = false;

    $: expectedTitle = $deleteListTarget?.title || "";
    $: canDelete = confirmText.trim() === expectedTitle && !isDeleting;

    function resetAndClose() {
        confirmText = "";
        setDeleteListTarget(null);
        closeModal();
    }

    async function handleDelete() {
        if (!$deleteListTarget || !canDelete) return;

        isDeleting = true;
        try {
            await deleteColumn($deleteListTarget.id);
            resetAndClose();
        } catch (e) {
            console.error("Failed to delete list", e);
        } finally {
            isDeleting = false;
        }
    }

    function handleBackdropClick() {
        resetAndClose();
    }
</script>

{#if $activeModal === "deleteListModal" && $deleteListTarget}
    <div class="fixed inset-0 z-[75]" role="dialog" aria-modal="true">
        <div
            class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
        ></div>

        <div class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto"
            >
                <div class="p-6">
                    <div class="flex items-center gap-3 mb-4 text-red-500">
                        <div class="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <span class="material-symbols-outlined text-2xl">delete</span>
                        </div>
                        <h3 class="text-lg font-bold text-[#111418] dark:text-white">Delete List</h3>
                    </div>

                    <p class="text-sm text-[#5c6b7f] dark:text-gray-400 mb-4">
                        This will permanently delete
                        <span class="font-semibold text-[#111418] dark:text-white">{$deleteListTarget.title}</span>
                        and its tasks.
                    </p>

                    <div class="mb-5">
                        <label class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2">
                            Type the list name to confirm:
                        </label>
                        <input
                            type="text"
                            bind:value={confirmText}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                            placeholder={$deleteListTarget.title}
                            autofocus
                        />
                    </div>

                    <div class="flex justify-end gap-3">
                        <button
                            on:click={resetAndClose}
                            class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors"
                            disabled={isDeleting}
                        >
                            Cancel
                        </button>
                        <button
                            on:click={handleDelete}
                            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!canDelete}
                        >
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                            {isDeleting ? "Deleting..." : "Delete List"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
