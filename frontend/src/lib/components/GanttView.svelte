<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { tasks, columns, activeBoard } from '$lib/stores/board';
    import { activeTask, setActiveTask } from '$lib/stores/board';
    import { currentBoardRole } from '$lib/stores/user';
    import { updateTask } from '$lib/api/tasksApi';
    import type { Task } from '$lib/types';
    // Bypass frappe-gantt's incomplete exports map by using the filesystem path directly
    import ganttCssUrl from '/node_modules/frappe-gantt/dist/frappe-gantt.css?url';

    // Inject the CSS once during mount
    let cssInjected = false;
    function injectGanttCss() {
        if (cssInjected || typeof document === 'undefined') return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = ganttCssUrl;
        document.head.appendChild(link);
        cssInjected = true;
    }

    // ─── frappe-gantt types ───────────────────────────────────────────────────
    // frappe-gantt ships its own typings in recent versions; if they're missing
    // we declare a minimal shape to keep TypeScript happy.
    let Gantt: any;
    let ganttInstance: any = null;
    let containerEl: HTMLElement;

    // ─── View mode ────────────────────────────────────────────────────────────
    type ViewMode = 'Day' | 'Week' | 'Month' | 'Quarter Day' | 'Half Day';
    let viewMode: ViewMode = 'Week';
    const VIEW_MODES: ViewMode[] = ['Day', 'Week', 'Month'];
    let isCompact = false;

    // ─── Data transformation ──────────────────────────────────────────────────
    interface GanttTask {
        id: string;
        name: string;
        start: string;
        end: string;
        progress: number;
        dependencies: string;
        custom_class?: string;
        _original: Task;
    }

    function toDateStr(d: string | null | undefined, fallback: Date): string {
        if (!d) return formatDate(fallback);
        const parsed = new Date(d);
        return isNaN(parsed.getTime()) ? formatDate(fallback) : formatDate(parsed);
    }

    function formatDate(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function addDay(d: Date, n: number): Date {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r;
    }

    function transformTasks(raw: Task[]): GanttTask[] {
        const today = new Date();
        const seenIds = new Set<string>();
        const uniqueTasks = raw.filter((t) => {
            if (!t.id) return false;
            if (seenIds.has(t.id)) {
                console.warn('Duplicate task ID found, ignoring:', t.id);
                return false;
            }
            seenIds.add(t.id);
            return true;
        });

        return uniqueTasks.map((t) => {
            const hasStart = !!t.start_date;
            const hasEnd = !!t.due_date;
            const start = toDateStr(t.start_date, today);
            let end = toDateStr(t.due_date, addDay(today, 1));

            // Ensure end is strictly after start to avoid frappe-gantt errors
            if (new Date(end) <= new Date(start)) {
                end = formatDate(addDay(new Date(start), 1));
            }

            return {
                id: t.id,
                name: t.title || 'Untitled Task',
                start,
                end,
                progress: t.status === 'done' ? 100 : t.status === 'in-progress' ? 50 : 0,
                dependencies: '',
                // Visually distinguish tasks with no real dates
                custom_class: !hasStart && !hasEnd ? 'gantt-task-unscheduled' : '',
                _original: t,
            };
        });
    }

    // ─── Init / re-init Gantt ─────────────────────────────────────────────────
    let initialized = false;
    const isReadOnly = $currentBoardRole === 'viewer';

    function buildGantt(ganttTasks: GanttTask[]) {
        if (!containerEl || !Gantt) return;

        // Clear old instance / DOM
        containerEl.innerHTML = '';
        ganttInstance = null;

        if (ganttTasks.length === 0) {
            initialized = false;
            return;
        }

        try {
            ganttInstance = new Gantt(containerEl, ganttTasks, {
                view_mode: viewMode,
                date_format: 'YYYY-MM-DD',
                readonly: isReadOnly,
                popup_trigger: 'click',
                bar_height: isCompact ? 18 : 30,
                padding: isCompact ? 8 : 18,
                on_click: (task: GanttTask) => {
                    const original = $tasks.find((t) => t.id === task.id);
                    if (original) setActiveTask(original);
                },
                on_date_change: async (task: GanttTask, start: Date, end: Date) => {
                    if (isReadOnly) return;
                    try {
                        await updateTask(task.id, {
                            start_date: formatDate(start),
                            due_date: formatDate(end),
                        });
                    } catch (e) {
                        console.error('Failed to update task dates', e);
                    }
                },
                on_progress_change: () => {},
                on_view_change: () => {},
            });

            initialized = true;
            lastRenderedTasks = ganttTasks;
        } catch (e) {
            console.error('Failed to initialize Frappe Gantt', e);
            initialized = false;
        }
    }

    // Reactive: rebuild chart when tasks change
    $: ganttTasks = transformTasks($tasks);

    let currentViewMode: ViewMode = viewMode;
    let lastRenderedTasks: GanttTask[] | null = null;
    let lastCompactMode = isCompact;

    // Robust reactive loop to handle building/refreshing the Gantt chart
    $: if (containerEl && Gantt) {
        // Register isCompact as a dependency for Svelte reactivity
        const _isCompact = isCompact;
        if (!initialized) {
            if (ganttTasks.length > 0) {
                buildGantt(ganttTasks);
                currentViewMode = viewMode;
                lastCompactMode = isCompact;
                lastRenderedTasks = ganttTasks;
            }
        } else {
            if (currentViewMode !== viewMode || lastCompactMode !== isCompact) {
                buildGantt(ganttTasks);
                currentViewMode = viewMode;
                lastCompactMode = isCompact;
                lastRenderedTasks = ganttTasks;
            } else if (ganttTasks) {
                // If tasks changed but view mode didn't, refresh the tasks list
                if (ganttTasks.length === 0) {
                    buildGantt(ganttTasks);
                    lastRenderedTasks = null;
                } else if (ganttInstance && lastRenderedTasks !== ganttTasks) {
                    try {
                        ganttInstance.refresh(ganttTasks);
                        lastRenderedTasks = ganttTasks;
                    } catch (err) {
                        console.warn('Gantt refresh failed, falling back to full rebuild:', err);
                        buildGantt(ganttTasks);
                        lastRenderedTasks = ganttTasks;
                    }
                }
            }
        }
    }

    onMount(async () => {
        injectGanttCss();
        // Dynamic import so SSR doesn't choke
        // @ts-expect-error – frappe-gantt ships no bundled TS declarations
        const mod = await import('frappe-gantt');
        Gantt = mod.default ?? mod;
    });

    onDestroy(() => {
        ganttInstance = null;
        initialized = false;
    });

    // ─── Export helpers ───────────────────────────────────────────────────────
    let exporting = false;
    let showExportMenu = false;

    async function getFullGanttCanvas(html2canvas: any) {
        const scrollWrapper = containerEl.closest('.gantt-scroll-wrapper') as HTMLElement;
        const svgEl = containerEl.querySelector('svg') as SVGElement;
        
        if (!scrollWrapper || !svgEl) {
            throw new Error('Gantt elements not found');
        }

        // Save scroll positions
        const originalScrollLeft = scrollWrapper.scrollLeft;
        const originalScrollTop = scrollWrapper.scrollTop;
        
        // Save inline styles
        const originalContainerStyle = containerEl.getAttribute('style') || '';
        const originalWrapperStyle = scrollWrapper.getAttribute('style') || '';

        try {
            // Reset scroll to top-left to avoid html2canvas clipping/shifting issues
            scrollWrapper.scrollLeft = 0;
            scrollWrapper.scrollTop = 0;

            // Get dimensions of the SVG
            const svgWidth = parseFloat(svgEl.getAttribute('width') || '0') || svgEl.scrollWidth || svgEl.getBoundingClientRect().width;
            const svgHeight = parseFloat(svgEl.getAttribute('height') || '0') || svgEl.scrollHeight || svgEl.getBoundingClientRect().height;

            const padding = 32; // 16px padding on each side (p-4)
            const targetWidth = svgWidth + padding;
            const targetHeight = svgHeight + padding;

            // Temporarily expand container and scroll wrapper to fit the entire SVG
            scrollWrapper.style.width = `${targetWidth}px`;
            scrollWrapper.style.height = `${targetHeight}px`;
            scrollWrapper.style.overflow = 'visible';
            scrollWrapper.style.maxHeight = 'none';
            scrollWrapper.style.maxWidth = 'none';
            
            containerEl.style.width = `${targetWidth}px`;
            containerEl.style.height = `${targetHeight}px`;
            containerEl.style.overflow = 'visible';
            containerEl.style.maxHeight = 'none';
            containerEl.style.maxWidth = 'none';

            // Wait a tiny bit for layout reflow
            await new Promise((resolve) => requestAnimationFrame(resolve));

            const canvas = await html2canvas(containerEl, {
                backgroundColor: null,
                scale: 2,
                width: targetWidth,
                height: targetHeight,
                scrollX: 0,
                scrollY: 0,
                windowWidth: targetWidth + 100,
                windowHeight: targetHeight + 100,
                logging: false,
                useCORS: true
            });

            return canvas;
        } finally {
            // Restore original inline styles
            containerEl.setAttribute('style', originalContainerStyle);
            scrollWrapper.setAttribute('style', originalWrapperStyle);
            
            // Restore scroll positions
            scrollWrapper.scrollLeft = originalScrollLeft;
            scrollWrapper.scrollTop = originalScrollTop;
        }
    }

    async function exportToImage() {
        exporting = true;
        showExportMenu = false;
        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await getFullGanttCanvas(html2canvas);
            const link = document.createElement('a');
            link.download = `${$activeBoard?.name ?? 'gantt'}-chart.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Export to image failed', e);
        } finally {
            exporting = false;
        }
    }

    async function exportToPDF() {
        exporting = true;
        showExportMenu = false;
        try {
            const { default: html2canvas } = await import('html2canvas');
            const { jsPDF } = await import('jspdf');
            const canvas = await getFullGanttCanvas(html2canvas);
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
            pdf.save(`${$activeBoard?.name ?? 'gantt'}-chart.pdf`);
        } catch (e) {
            console.error('Export to PDF failed', e);
        } finally {
            exporting = false;
        }
    }

    async function exportTasksToCSV() {
        exporting = true;
        showExportMenu = false;
        try {
            const Papa = await import('papaparse');
            const rows = $tasks.map((t) => ({
                id: t.id,
                title: t.title,
                description: t.description ?? '',
                status: t.status,
                priority: t.priority,
                start_date: t.start_date ?? '',
                due_date: t.due_date ?? '',
                column: $columns.find((c) => c.id === t.column_id)?.title ?? '',
            }));
            const csv = Papa.unparse(rows);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${$activeBoard?.name ?? 'board'}-tasks.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export to CSV failed', e);
        } finally {
            exporting = false;
        }
    }
</script>


<div class="gantt-view flex flex-col flex-1 overflow-hidden bg-[#fbfcfd] dark:bg-[#151e29]" class:compact={isCompact}>
    <!-- ─── Toolbar ─────────────────────────────────────────────────────── -->
    <div class="gantt-toolbar flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0">
        <!-- View mode pills -->
        <div class="flex items-center gap-1 bg-[#eff1f3] dark:bg-[#1e2936] rounded-lg p-0.5">
            {#each VIEW_MODES as mode}
                <button
                    class="px-3 py-1 rounded-md text-xs font-medium transition-colors {viewMode === mode
                        ? 'bg-white dark:bg-[#2a3a4a] shadow-sm text-primary'
                        : 'text-[#5c6b7f] hover:text-[#111418] dark:hover:text-white'}"
                    on:click={() => { viewMode = mode; }}
                    id="gantt-viewmode-{mode.toLowerCase()}"
                >
                    {mode}
                </button>
            {/each}
        </div>

        <div class="flex items-center gap-3">
            {#if isReadOnly}
                <span class="text-xs text-[#8a98a8] dark:text-[#5c6b7f] flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">lock</span>
                    Read-only
                </span>
            {/if}

            <!-- Compress view toggle -->
            <button
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border disabled:opacity-50 {isCompact
                    ? 'bg-primary text-white border-primary shadow-sm hover:bg-primary/90'
                    : 'text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] border-[#e5e7eb] dark:border-[#2a3a4a]'}"
                on:click={() => (isCompact = !isCompact)}
                id="gantt-compact-toggle"
                title={isCompact ? 'Standard View' : 'Compress View'}
            >
                <span class="material-symbols-outlined text-[16px]">
                    {isCompact ? 'unfold_more' : 'unfold_less'}
                </span>
                {isCompact ? 'Expand' : 'Compress'}
            </button>

            <!-- Export dropdown -->
            <div class="relative">
                <button
                    class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors border border-[#e5e7eb] dark:border-[#2a3a4a] disabled:opacity-50"
                    on:click={() => (showExportMenu = !showExportMenu)}
                    disabled={exporting}
                    id="gantt-export-btn"
                    title="Export"
                >
                    {#if exporting}
                        <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                    {:else}
                        <span class="material-symbols-outlined text-[16px]">download</span>
                    {/if}
                    Export
                    <span class="material-symbols-outlined text-[12px]">expand_more</span>
                </button>

                {#if showExportMenu}
                    <!-- svelte-ignore a11y-click-events-have-key-events -->
                    <!-- svelte-ignore a11y-no-static-element-interactions -->
                    <div
                        class="absolute right-0 mt-1 w-48 bg-white dark:bg-[#1a2535] border border-[#e5e7eb] dark:border-[#2a3a4a] rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                        on:click|stopPropagation
                    >
                        <button
                            class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#374151] dark:text-gray-300 hover:bg-[#f3f4f6] dark:hover:bg-[#253040] transition-colors"
                            on:click={exportToImage}
                            id="export-png-btn"
                        >
                            <span class="material-symbols-outlined text-[16px]">image</span>
                            Export as PNG
                        </button>
                        <button
                            class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#374151] dark:text-gray-300 hover:bg-[#f3f4f6] dark:hover:bg-[#253040] transition-colors"
                            on:click={exportToPDF}
                            id="export-pdf-btn"
                        >
                            <span class="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                            Export as PDF
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#2a3a4a] my-1"></div>
                        <button
                            class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#374151] dark:text-gray-300 hover:bg-[#f3f4f6] dark:hover:bg-[#253040] transition-colors"
                            on:click={exportTasksToCSV}
                            id="export-csv-btn"
                        >
                            <span class="material-symbols-outlined text-[16px]">table</span>
                            Export Tasks as CSV
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- ─── Legend ─────────────────────────────────────────────────────── -->
    <div class="flex items-center gap-4 px-6 py-2 text-[11px] text-[#8a98a8] dark:text-[#5c6b7f] border-b border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0">
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-primary opacity-80"></span>
            Scheduled
        </span>
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-[#94a3b8]"></span>
            Unscheduled (default dates)
        </span>
        {#if !isReadOnly}
            <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[13px]">drag_pan</span>
                Drag bars to reschedule
            </span>
        {/if}
    </div>

    <!-- ─── Chart container ───────────────────────────────────────────── -->
    <div class="gantt-scroll-wrapper flex-1 overflow-auto relative">
        <!-- Always render the container so containerEl is always bound -->
        <div bind:this={containerEl} id="gantt-container" class="gantt-container p-4"></div>

        <!-- Empty state overlay (shown when there are no tasks) -->
        {#if $tasks.length === 0}
            <div class="absolute inset-0 flex flex-col items-center justify-center text-[#8a98a8] gap-3 pointer-events-none">
                <span class="material-symbols-outlined text-4xl opacity-30">calendar_view_week</span>
                <p class="text-sm">No tasks on this board yet</p>
            </div>
        {/if}
    </div>
</div>

<!-- Close export menu when clicking outside -->
{#if showExportMenu}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 z-40" on:click={() => (showExportMenu = false)}></div>
{/if}

<style>
    /* ─── Frappe Gantt theme variables overrides ─── */
    :global(.gantt-container) {
        --g-bar-color: #2b8cee; /* Brand primary blue */
        --g-bar-border: #2b8cee;
        --g-progress-color: #1e6bb8; /* Darker progress blue */
        --g-today-highlight: #2b8cee;
    }

    :global(.dark .gantt-container) {
        --g-arrow-color: #cbd5e1;
        --g-bar-color: #3b82f6; /* Bright blue for dark mode contrast */
        --g-bar-border: #3b82f6;
        --g-progress-color: #1d4ed8;
        --g-tick-color-thick: #334155;
        --g-tick-color: #1e293b;
        --g-actions-background: #1e293b;
        --g-border-color: #2a3a4a;
        --g-text-muted: #8a98a8;
        --g-text-light: #ffffff;
        --g-text-dark: #ffffff;
        --g-handle-color: #cbd5e1;
        --g-weekend-label-color: #334155;
        --g-expected-progress: #1d4ed8;
        --g-header-background: #151e29; /* Nice dark header background */
        --g-row-color: #1e293b; /* Distinct row background color */
        --g-row-border-color: #2a3a4a;
        --g-today-highlight: #3b82f6;
        --g-popup-actions: #1e293b;
        --g-weekend-highlight-color: transparent;
    }

    /* ─── Frappe Gantt structure & shape overrides ─── */
    :global(.gantt-container .gantt .bar-wrapper .bar) {
        rx: 4;
    }

    :global(.gantt-container .gantt .bar-wrapper.gantt-task-unscheduled .bar) {
        fill: #94a3b8 !important;
        stroke: #94a3b8 !important;
    }

    :global(.dark .gantt-container .gantt .grid-background) {
        fill: none !important;
    }

    /* Remove holiday vertical highlight boxes in dark mode */
    :global(.dark .gantt-container .gantt .holiday-highlight) {
        fill: transparent !important;
    }

    /* Alternating rows in dark mode for better readability */
    :global(.dark .gantt-container .gantt .grid-row:nth-child(even)) {
        fill: #151e29 !important;
    }

    :global(.dark .gantt-container .popup-wrapper) {
        background: #1e293b;
        border: 1px solid #2a3a4a;
        color: #ffffff;
    }

    :global(.gantt-container svg) {
        font-family: inherit;
    }

    .gantt-scroll-wrapper {
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    }

    :global(.gantt-container) {
        min-height: 450px;
    }

    /* Compact view font size adjustments */
    :global(.compact .gantt-container .gantt .bar-label) {
        font-size: 10px !important;
    }
    :global(.compact .gantt-container .gantt .bar-label.big) {
        font-size: 10px !important;
    }

    /* Dark mode adjustments for big labels (labels drawn outside the bar) */
    :global(.dark .gantt-container .gantt .bar-label.big) {
        fill: #cbd5e1 !important;
    }
</style>
