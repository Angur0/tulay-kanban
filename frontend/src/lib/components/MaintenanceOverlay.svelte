<script lang="ts">
    import { maintenanceEndTime } from "$lib/stores/ui";
    
    // Parse and format the end time for user's local timezone
    $: formattedEndTime = $maintenanceEndTime ? new Date($maintenanceEndTime).toLocaleString(undefined, {
        dateStyle: 'long',
        timeStyle: 'short'
    }) : null;

    // Calculate time remaining if possible
    let timeRemaining = "";
    let intervalId: any;

    function updateRemaining() {
        if (!$maintenanceEndTime) {
            timeRemaining = "";
            return;
        }
        const diff = new Date($maintenanceEndTime).getTime() - Date.now();
        if (diff <= 0) {
            timeRemaining = "Ending shortly...";
            return;
        }
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        
        timeRemaining = `Estimated time remaining: ${parts.join(" ")}`;
    }

    $: if ($maintenanceEndTime) {
        if (intervalId) clearInterval(intervalId);
        updateRemaining();
        intervalId = setInterval(updateRemaining, 1000);
    } else {
        if (intervalId) clearInterval(intervalId);
        timeRemaining = "";
    }

    import { onDestroy } from "svelte";
    onDestroy(() => {
        if (intervalId) clearInterval(intervalId);
    });
</script>

<div class="absolute inset-0 z-[70] bg-white/95 dark:bg-[#0d141c]/95 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
    <div class="max-w-md mx-auto flex flex-col items-center">
        <!-- Brand/Logo Icon -->
        <div class="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-8 shadow-sm">
            <span class="material-symbols-outlined text-4xl animate-[pulse_2s_infinite]">engineering</span>
        </div>

        <h1 class="text-4xl font-extrabold tracking-tight text-[#111418] dark:text-white mb-4">
            Under Maintenance
        </h1>
        
        <p class="text-base text-[#5c6b7f] dark:text-gray-400 mb-8 leading-relaxed">
            Tulay Kanban is currently undergoing scheduled maintenance to improve our systems and deliver a better experience.
        </p>

        {#if formattedEndTime}
            <div class="w-full bg-[#fbfcfd] dark:bg-[#151e29] border border-[#e5e7eb] dark:border-[#1e2936] rounded-xl p-5 mb-8 shadow-inner">
                <p class="text-xs font-semibold uppercase tracking-wider text-[#8a98a8] mb-1">Estimated Return Time</p>
                <p class="text-lg font-bold text-primary dark:text-blue-400 mb-2">{formattedEndTime}</p>
                {#if timeRemaining}
                    <p class="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{timeRemaining}</p>
                {/if}
            </div>
        {/if}

        <div class="flex items-center gap-3 px-5 py-2.5 rounded-full bg-[#f3f4f6] dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium border border-gray-200 dark:border-gray-700/50">
            <span class="material-symbols-outlined animate-spin text-[18px]">sync</span>
            <span>Checking service status...</span>
        </div>
    </div>
</div>
