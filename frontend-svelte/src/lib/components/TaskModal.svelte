<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { currentBoardRole, workspaceMembers } from "$lib/stores/user";
    import type { Task } from "$lib/types";
    import { createEventDispatcher } from "svelte";

    // In a real implementation we would likely use a reactive activeTask store.
    // Simplifying this for the migration skeleton.
    export let task: Task | null = null;

    let isEditingDescription = false;
    let editableDescription = "";

    $: canManage = ["owner", "moderator", "member"].includes($currentBoardRole);

    function startEditing() {
        if (!canManage || !task) return;
        isEditingDescription = true;
        editableDescription = task.description || "";
    }

    function saveDescription() {
        if (!task) return;
        // dispatch save event
        isEditingDescription = false;
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) closeModal();
    }
</script>

{#if $activeModal === "taskPanel" && task}
    <div
        class="fixed inset-0 z-[60] flex justify-end"
        role="dialog"
        aria-modal="true"
    >
        <!-- svelte-ignore a11y-click-events-have-key-events bg-click -->
        <div
            class="fixed inset-0 bg-gray-900/20 backdrop-blur-sm transition-opacity"
            on:click={handleBackdropClick}
        ></div>

        <div
            class="relative w-full max-w-2xl h-full bg-white dark:bg-[#151e29] shadow-2xl transform transition-transform border-l border-[#e5e7eb] dark:border-[#1e2936] flex flex-col pointer-events-auto"
        >
            <!-- Header -->
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
                    <input
                        type="text"
                        bind:value={task.title}
                        class="text-xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-[#111418] dark:text-white w-full {canManage
                            ? 'cursor-text editable-title'
                            : 'cursor-default pointer-events-none'}"
                        readonly={!canManage}
                    />
                </div>
                <button
                    on:click={closeModal}
                    class="p-2 text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded-lg transition-colors"
                >
                    <span class="material-symbols-outlined text-xl">close</span>
                </button>
            </div>

            <!-- Content Structure for Task (simplified) -->
            <div class="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                <div class="flex flex-col md:flex-row gap-8 h-full">
                    <!-- Main Content Area -->
                    <div class="flex-1 min-w-0">
                        <!-- Description -->
                        <div class="mb-8">
                            <div
                                class="flex items-center gap-2 mb-3 text-[#111418] dark:text-white"
                            >
                                <span class="material-symbols-outlined"
                                    >description</span
                                >
                                <h3 class="text-base font-semibold">
                                    Description
                                </h3>
                            </div>

                            {#if isEditingDescription}
                                <div class="relative mt-2">
                                    <textarea
                                        bind:value={editableDescription}
                                        class="w-full min-h-[120px] p-3 text-sm bg-white dark:bg-[#151e29] border border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-[#111418] dark:text-white resize-none custom-scrollbar"
                                        placeholder="Add a more detailed description..."
                                    ></textarea>
                                    <div class="flex gap-2 mt-2">
                                        <button
                                            on:click={saveDescription}
                                            class="px-3 py-1.5 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors shadow-sm"
                                            >Save</button
                                        >
                                        <button
                                            on:click={() =>
                                                (isEditingDescription = false)}
                                            class="px-3 py-1.5 text-sm font-medium text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded transition-colors"
                                            >Cancel</button
                                        >
                                    </div>
                                </div>
                            {:else}
                                <div
                                    class="text-sm text-[#5c6b7f] dark:text-gray-400 mt-2 {canManage
                                        ? 'cursor-text hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'
                                        : ''} p-3 rounded-lg min-h-[60px] whitespace-pre-wrap transition-colors"
                                    on:click={startEditing}
                                >
                                    {task.description ||
                                        (canManage
                                            ? "Add a more detailed description..."
                                            : "No description provided")}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- Sidebar Tools Area -->
                    <div
                        class="w-full md:w-48 flex-shrink-0 flex flex-col gap-6"
                    >
                        {#if canManage}
                            <div>
                                <h4
                                    class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wider mb-2"
                                >
                                    Add to card
                                </h4>
                                <div class="flex flex-col gap-1.5 text-sm">
                                    <button
                                        class="flex items-center gap-2 px-3 py-1.5 bg-[#eff1f3] dark:bg-[#1e2936] hover:bg-gray-200 dark:hover:bg-gray-700 text-[#111418] dark:text-white rounded transition-colors text-left"
                                        title="Not implemented"
                                    >
                                        <span
                                            class="material-symbols-outlined text-[18px]"
                                            >person</span
                                        > Members
                                    </button>
                                    <button
                                        class="flex items-center gap-2 px-3 py-1.5 bg-[#eff1f3] dark:bg-[#1e2936] hover:bg-gray-200 dark:hover:bg-gray-700 text-[#111418] dark:text-white rounded transition-colors text-left"
                                        title="Not implemented"
                                    >
                                        <span
                                            class="material-symbols-outlined text-[18px]"
                                            >label</span
                                        > Labels
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
