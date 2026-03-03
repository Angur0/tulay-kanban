<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
    let title = "";

    function handleCreate() {
        if (!title.trim()) return;
        dispatch("create", { title });
        title = "";
        closeModal();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "createListModal"}
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
                                >view_week</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Create New List
                        </h3>
                    </div>
                    <div class="mb-6">
                        <label
                            for="newListTitle"
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >List Title</label
                        >
                        <input
                            type="text"
                            id="newListTitle"
                            bind:value={title}
                            class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[#111418] dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="e.g., To Do"
                            autofocus
                        />
                    </div>
                    <div class="flex justify-end gap-3">
                        <button
                            on:click={closeModal}
                            class="px-4 py-2 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]"
                        >
                            Cancel
                        </button>
                        <button
                            on:click={handleCreate}
                            class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 transition-colors rounded-lg shadow-sm"
                        >
                            Create List
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
