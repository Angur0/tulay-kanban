<script lang="ts">
    import AppLayout from "$lib/components/AppLayout.svelte";
    import { activeView, boardViewMode } from "$lib/stores/ui";
    import { activeBoard } from "$lib/stores/board";

    import BoardView from "$lib/components/BoardView.svelte";
    import GanttView from "$lib/components/GanttView.svelte";
    import CalendarView from "$lib/components/CalendarView.svelte";
    import MyTasksView from "$lib/components/MyTasksView.svelte";
</script>

<AppLayout>
    {#if $activeView === "board"}
        {#if $activeBoard}
            {#if $boardViewMode === 'kanban'}
                <BoardView />
            {:else if $boardViewMode === 'gantt'}
                <GanttView />
            {:else if $boardViewMode === 'calendar'}
                <CalendarView />
            {/if}
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
    {:else if $activeView === "my-tasks"}
        <MyTasksView />
    {/if}
</AppLayout>
