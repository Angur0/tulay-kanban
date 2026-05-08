<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { createEventDispatcher } from "svelte";
    import { BOARD_ICONS } from "$lib/constants";

    const dispatch = createEventDispatcher();

    let boardName = "";
    let selectedIcon = "dashboard";
    let selectedColor = "#3b82f6";
    let showIconDropdown = false;

    const colors = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
        "#64748b",
    ];

    function handleCreate() {
        if (!boardName.trim()) return;
        dispatch("create", {
            name: boardName,
            icon: selectedIcon,
            color: selectedColor,
        });
        closeModal();
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "createBoardModal"}
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
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-sm overflow-visible transform transition-all border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto flex flex-col"
            >
                <div class="p-6 overflow-visible">
                    <div class="flex items-center gap-3 mb-4 text-primary">
                        <div
                            class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                            <span class="material-symbols-outlined text-2xl"
                                >dashboard_customize</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Create New Board
                        </h3>
                    </div>
                    <div class="mb-6 overflow-visible">
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Board Name & Icon</label
                        >
                        <div class="relative overflow-visible">
                            <div
                                class="flex items-center gap-0 bg-transparent dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-primary/50 relative z-20"
                            >
                                <button
                                    type="button"
                                    on:click={() =>
                                        (showIconDropdown = !showIconDropdown)}
                                    class="px-3 py-2.5 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
                                >
                                    <span
                                        class="material-symbols-outlined text-2xl"
                                        style="color: {selectedColor}"
                                        >{selectedIcon}</span
                                    >
                                </button>
                                <input
                                    type="text"
                                    bind:value={boardName}
                                    class="flex-1 px-3 py-2.5 bg-transparent text-[#111418] dark:text-white focus:outline-none border-none"
                                    placeholder="e.g., Marketing Project"
                                    autofocus
                                />
                            </div>
                            {#if showIconDropdown}
                                <div
                                    class="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 max-h-[280px]"
                                >
                                    <div class="grid grid-cols-5 gap-1.5">
                                        {#each Array.from(BOARD_ICONS) as icon}
                                            <button
                                                type="button"
                                                on:click={() => {
                                                    selectedIcon = icon;
                                                    showIconDropdown = false;
                                                }}
                                                class="p-2.5 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors {selectedIcon ===
                                                icon
                                                    ? 'bg-gray-100 dark:bg-gray-700'
                                                    : ''}"
                                            >
                                                <span
                                                    class="material-symbols-outlined text-xl"
                                                    >{icon}</span
                                                >
                                            </button>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                    <div class="mb-6">
                        <label
                            class="block text-sm font-medium text-[#5c6b7f] dark:text-gray-400 mb-2"
                            >Icon Color</label
                        >
                        <div class="grid grid-cols-8 gap-2">
                            {#each colors as color}
                                <button
                                    type="button"
                                    on:click={() => (selectedColor = color)}
                                    class="w-10 h-10 rounded-lg border-2 {selectedColor ===
                                    color
                                        ? 'border-primary scale-110 shadow-sm'
                                        : 'border-transparent hover:border-gray-400 dark:hover:border-gray-500 hover:scale-110'} transition-all"
                                    style="background-color: {color};"
                                ></button>
                            {/each}
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 mt-auto pt-2">
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
                            Create Board
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
