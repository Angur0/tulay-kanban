<script lang="ts">
    import AppLayout from "$lib/components/AppLayout.svelte";
    import { activeView } from "$lib/stores/ui";
    import { activeBoard } from "$lib/stores/board";

    import BoardView from "$lib/components/BoardView.svelte";
    // import ActivityView from '$lib/components/ActivityView.svelte';
    import MyTasksView from "$lib/components/MyTasksView.svelte";
</script>

<AppLayout>
    {#if $activeView === "board"}
        {#if $activeBoard}
            <BoardView />
        {:else}
            <div
                class="flex-1 flex flex-col items-center justify-center text-[#8a98a8]"
            >
                <span class="material-symbols-outlined text-4xl mb-4 opacity-30"
                    >dashboard</span
                >
                <p class="text-sm">Select a board from the sidebar</p>
            </div>
        {/if}
    {:else if $activeView === "activity"}
        <div class="flex-1 flex items-center justify-center text-gray-400">
            Activity View Coming Soon
        </div>
    {:else if $activeView === "my-tasks"}
        <MyTasksView />
    {/if}
</AppLayout>
