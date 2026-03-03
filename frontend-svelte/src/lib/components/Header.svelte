<script lang="ts">
    import { activeBoard, columns, tasks } from "$lib/stores/board";
    import { isKafkaConnected } from "$lib/stores/realtime";
    import { activeView, openModal } from "$lib/stores/ui";
    import { normalizeBoardIcon, columnColorClasses } from "$lib/constants";

    // Calculate header stats
    $: stats = $columns.map((col, index) => {
        return {
            title: col.title,
            count: $tasks.filter((t) => t.column_id === col.id).length,
            colorClass: columnColorClasses[index % columnColorClasses.length],
        };
    });
</script>

<header
    class="flex-shrink-0 h-8 px-8 border-b border-[#e5e7eb] dark:border-[#1e2936] flex items-center justify-between bg-[#fbfcfd] dark:bg-[#151e29]"
>
    <div class="flex items-center gap-3">
        <div
            class="flex items-center gap-2 text-[#5c6b7f] dark:text-gray-400 text-xs font-medium uppercase tracking-wider"
        >
            <span class="material-symbols-outlined text-sm"
                >{normalizeBoardIcon($activeBoard?.icon)}</span
            >
            <span>Task Board</span>
        </div>
        <h2
            class="text-[#111418] dark:text-white text-sm font-bold tracking-tight"
        >
            {$activeBoard
                ? $activeBoard.name
                : $activeView === "board"
                  ? "Select a Board"
                  : "Tulay Kanban"}
        </h2>
    </div>

    <div class="flex items-center gap-4">
        {#if $activeBoard}
            <!-- Members Button -->
            <button
                on:click={() => openModal("manageMembersModal")}
                class="flex items-center gap-1.5 text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white transition-colors"
            >
                <span class="material-symbols-outlined text-[16px]">group</span>
                Members
            </button>

            <!-- Task Stats -->
            <div
                class="hidden sm:flex items-center gap-4 text-xs overflow-x-auto"
            >
                {#each stats as stat}
                    <div class="flex items-center gap-1.5">
                        <span class="size-2 rounded-full {stat.colorClass}"
                        ></span>
                        <span class="text-[#5c6b7f] dark:text-gray-400"
                            >{stat.title}:
                            <span
                                class="font-semibold text-[#111418] dark:text-white"
                                >{stat.count}</span
                            ></span
                        >
                    </div>
                {/each}
            </div>
        {/if}

        <!-- Kafka Connection Indicator -->
        {#if $isKafkaConnected}
            <span class="relative flex h-2 w-2" title="Kafka Stream Active">
                <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
                ></span>
                <span
                    class="relative inline-flex rounded-full h-2 w-2 bg-primary"
                ></span>
            </span>
        {:else}
            <span
                class="relative flex h-2 w-2"
                title="Kafka Stream Disconnected"
            >
                <span
                    class="relative inline-flex rounded-full h-2 w-2 bg-gray-400"
                ></span>
            </span>
        {/if}
    </div>
</header>
