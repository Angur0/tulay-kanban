<script lang="ts">
    import { activeModal, closeModal } from "$lib/stores/ui";
    import { labels, setLabels } from "$lib/stores/board";
    import {
        getBoardLabels,
        getWorkspaceLabels,
        createBoardLabel,
        createWorkspaceLabel,
        updateBoardLabel,
        deleteBoardLabel,
    } from "$lib/api/labelsApi";
    import { get } from "svelte/store";
    import { activeBoardId } from "$lib/stores/board";
    import { activeWorkspaceId } from "$lib/stores/user";
    import type { Label } from "$lib/types";

    // Create form state
    let newLabelName = "";
    let newLabelColor = "#3b82f6";
    let newLabelScope: "global" | "board" = "global";

    // Edit state
    let editLabelId: string | null = null;
    let editLabelName = "";
    let editLabelColor = "#3b82f6";

    // Fetched lists
    let globalLabels: Label[] = [];
    let boardLabels: Label[] = [];

    // Load labels when modal opens
    $: if ($activeModal === "labelManagerModal") {
        loadLabels();
    }

    async function loadLabels() {
        const boardId = get(activeBoardId);
        const wsId = get(activeWorkspaceId);

        try {
            const [board, global] = await Promise.all([
                boardId ? getBoardLabels(boardId) : Promise.resolve([]),
                wsId ? getWorkspaceLabels(wsId) : Promise.resolve([]),
            ]);
            boardLabels = board;
            globalLabels = global;
            // Keep the shared `labels` store updated with board labels (used in TaskModal)
            setLabels([...global, ...board]);
        } catch (e) {
            console.error("Failed to load labels", e);
        }
    }

    async function handleCreate() {
        if (!newLabelName.trim()) return;
        const boardId = get(activeBoardId);
        const wsId = get(activeWorkspaceId);

        try {
            if (newLabelScope === "board") {
                if (!boardId) return;
                await createBoardLabel(boardId, {
                    name: newLabelName.trim(),
                    color: newLabelColor,
                });
            } else {
                if (!wsId) return;
                await createWorkspaceLabel(wsId, {
                    name: newLabelName.trim(),
                    color: newLabelColor,
                });
            }
            newLabelName = "";
            newLabelColor = "#3b82f6";
            await loadLabels();
        } catch (e) {
            console.error("Failed to create label", e);
        }
    }

    function startEdit(label: Label) {
        editLabelId = label.id;
        editLabelName = label.name;
        editLabelColor = label.color ?? "#3b82f6";
    }

    async function handleUpdate() {
        if (!editLabelId) return;
        try {
            await updateBoardLabel(editLabelId, {
                name: editLabelName,
                color: editLabelColor,
            });
            editLabelId = null;
            await loadLabels();
        } catch (e) {
            console.error("Failed to update label", e);
        }
    }

    async function handleDelete(id: string) {
        try {
            await deleteBoardLabel(id);
            await loadLabels();
        } catch (e) {
            console.error("Failed to delete label", e);
        }
    }
</script>

{#if $activeModal === "labelManagerModal"}
    <div class="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
        <!-- Backdrop -->
        <div
            class="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
            role="button"
            tabindex="0"
            on:click={() => closeModal()}
            on:keydown={(e) => e.key === "Enter" && closeModal()}
        ></div>

        <div
            class="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        >
            <div
                class="bg-white dark:bg-[#151e29] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] pointer-events-auto flex flex-col max-h-[85vh]"
            >
                <!-- Header -->
                <div
                    class="flex items-center justify-between px-6 py-4 border-b border-[#e5e7eb] dark:border-[#1e2936] shrink-0"
                >
                    <div class="flex items-center gap-3 text-primary">
                        <div
                            class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                            <span class="material-symbols-outlined text-2xl"
                                >label</span
                            >
                        </div>
                        <h3
                            class="text-lg font-bold text-[#111418] dark:text-white"
                        >
                            Manage Labels
                        </h3>
                    </div>
                    <button
                        on:click={() => closeModal()}
                        class="p-1.5 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded-md text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
                    >
                        <span class="material-symbols-outlined text-[20px]"
                            >close</span
                        >
                    </button>
                </div>

                <!-- Scrollable Body -->
                <div
                    class="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6"
                >
                    <!-- Create Label Form -->
                    <div>
                        <div class="grid grid-cols-1 gap-3">
                            <!-- Scope -->
                            <div class="flex flex-col gap-1">
                                <label
                                    for="labelScope"
                                    class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wide"
                                    >Scope</label
                                >
                                <select
                                    id="labelScope"
                                    bind:value={newLabelScope}
                                    class="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="global"
                                        >Global (Workspace)</option
                                    >
                                    <option value="board">Board Only</option>
                                </select>
                            </div>

                            <!-- Name + Color + Button -->
                            <div class="flex flex-col gap-1">
                                <label
                                    for="labelName"
                                    class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wide"
                                    >Label Name</label
                                >
                                <div class="flex items-center gap-2">
                                    <input
                                        id="labelName"
                                        type="text"
                                        bind:value={newLabelName}
                                        placeholder="e.g., Research"
                                        on:keydown={(e) =>
                                            e.key === "Enter" && handleCreate()}
                                        class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    />
                                    <div
                                        class="flex flex-col gap-1 items-center"
                                    >
                                        <label
                                            for="labelColor"
                                            class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase tracking-wide"
                                            >Color</label
                                        >
                                        <input
                                            id="labelColor"
                                            type="color"
                                            bind:value={newLabelColor}
                                            class="w-10 h-10 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 cursor-pointer"
                                        />
                                    </div>
                                    <button
                                        on:click={handleCreate}
                                        class="mt-5 flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                                    >
                                        <span
                                            class="material-symbols-outlined text-[18px]"
                                            >add</span
                                        >
                                        Create Label
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Global Labels -->
                    <div>
                        <h4
                            class="text-xs font-semibold text-[#8a98a8] uppercase tracking-wider mb-3"
                        >
                            Global Labels
                        </h4>
                        {#if globalLabels.length === 0}
                            <p class="text-sm text-[#8a98a8]">
                                No global labels yet.
                            </p>
                        {:else}
                            <ul class="flex flex-col gap-2">
                                {#each globalLabels as label (label.id)}
                                    <li
                                        class="flex items-center justify-between px-3 py-2 bg-[#f6f7f8] dark:bg-[#1a232e] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936]"
                                    >
                                        {#if editLabelId === label.id}
                                            <div
                                                class="flex gap-2 items-center flex-1"
                                            >
                                                <input
                                                    bind:value={editLabelName}
                                                    class="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-[#111418] dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                                <input
                                                    type="color"
                                                    bind:value={editLabelColor}
                                                    class="w-8 h-8 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
                                                />
                                                <button
                                                    on:click={handleUpdate}
                                                    class="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-blue-600 transition-colors"
                                                    >Save</button
                                                >
                                                <button
                                                    on:click={() =>
                                                        (editLabelId = null)}
                                                    class="px-2 py-1 text-xs text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
                                                    >Cancel</button
                                                >
                                            </div>
                                        {:else}
                                            <div
                                                class="flex items-center gap-3 flex-1"
                                            >
                                                <span
                                                    class="w-4 h-4 rounded-full shrink-0"
                                                    style="background:{label.color ??
                                                        '#777'}"
                                                ></span>
                                                <span
                                                    class="flex-1 text-sm text-[#111418] dark:text-gray-200"
                                                    >{label.name}</span
                                                >
                                                <button
                                                    on:click={() =>
                                                        startEdit(label)}
                                                    class="text-xs text-primary hover:text-blue-600 transition-colors"
                                                    >Edit</button
                                                >
                                                <button
                                                    on:click={() =>
                                                        handleDelete(label.id)}
                                                    class="text-xs text-red-500 hover:text-red-700 transition-colors"
                                                    >Delete</button
                                                >
                                            </div>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>

                    <!-- Board Labels -->
                    <div>
                        <h4
                            class="text-xs font-semibold text-[#8a98a8] uppercase tracking-wider mb-3"
                        >
                            Board Labels
                        </h4>
                        {#if boardLabels.length === 0}
                            <p class="text-sm text-[#8a98a8]">
                                No board labels yet.
                            </p>
                        {:else}
                            <ul class="flex flex-col gap-2">
                                {#each boardLabels as label (label.id)}
                                    <li
                                        class="flex items-center justify-between px-3 py-2 bg-[#f6f7f8] dark:bg-[#1a232e] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936]"
                                    >
                                        {#if editLabelId === label.id}
                                            <div
                                                class="flex gap-2 items-center flex-1"
                                            >
                                                <input
                                                    bind:value={editLabelName}
                                                    class="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-[#111418] dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                                                />
                                                <input
                                                    type="color"
                                                    bind:value={editLabelColor}
                                                    class="w-8 h-8 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
                                                />
                                                <button
                                                    on:click={handleUpdate}
                                                    class="px-2 py-1 text-xs bg-primary text-white rounded hover:bg-blue-600 transition-colors"
                                                    >Save</button
                                                >
                                                <button
                                                    on:click={() =>
                                                        (editLabelId = null)}
                                                    class="px-2 py-1 text-xs text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
                                                    >Cancel</button
                                                >
                                            </div>
                                        {:else}
                                            <div
                                                class="flex items-center gap-3 flex-1"
                                            >
                                                <span
                                                    class="w-4 h-4 rounded-full shrink-0"
                                                    style="background:{label.color ??
                                                        '#777'}"
                                                ></span>
                                                <span
                                                    class="flex-1 text-sm text-[#111418] dark:text-gray-200"
                                                    >{label.name}</span
                                                >
                                                <button
                                                    on:click={() =>
                                                        startEdit(label)}
                                                    class="text-xs text-primary hover:text-blue-600 transition-colors"
                                                    >Edit</button
                                                >
                                                <button
                                                    on:click={() =>
                                                        handleDelete(label.id)}
                                                    class="text-xs text-red-500 hover:text-red-700 transition-colors"
                                                    >Delete</button
                                                >
                                            </div>
                                        {/if}
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
