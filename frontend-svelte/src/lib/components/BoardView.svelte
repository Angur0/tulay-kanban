<script lang="ts">
    import { columns, tasks } from "$lib/stores/board";
    import { currentBoardRole } from "$lib/stores/user";
    import { openModal } from "$lib/stores/ui";
    import ColumnComponent from "./Column.svelte";

    function showCreateListModal() {
        openModal("createListModal");
    }
</script>

<div
    class="flex-1 overflow-x-auto overflow-y-hidden bg-[#fbfcfd] dark:bg-[#0d141c] p-8 custom-scrollbar"
>
    <div class="flex h-full gap-6 min-w-[900px]" id="board">
        {#if $columns.length === 0}
            <div
                class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]"
            >
                <span class="material-symbols-outlined text-5xl mb-4 opacity-30"
                    >view_week</span
                >
                <p class="text-base font-medium mb-2">No lists yet</p>
                <button
                    on:click={showCreateListModal}
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                    <span class="material-symbols-outlined text-[18px]"
                        >add</span
                    >
                    Create List
                </button>
            </div>
        {/if}

        {#each $columns as col, index}
            <ColumnComponent column={col} {index} />
        {/each}

        <!-- Add List Button -->
        {#if $columns.length > 0 && ["owner", "moderator", "member"].includes($currentBoardRole)}
            <div class="flex-shrink-0 h-full flex items-stretch">
                <button
                    on:click={showCreateListModal}
                    class="flex flex-col items-center justify-center px-4 w-16 bg-[#f1f3f5] dark:bg-[#1a232e] hover:bg-[#e6e8eb] dark:hover:bg-[#253040] rounded-xl text-[#5c6b7f] dark:text-gray-400 font-medium transition-all shadow-sm"
                >
                    <span class="material-symbols-outlined text-2xl">add</span>
                </button>
            </div>
        {/if}
    </div>
</div>
