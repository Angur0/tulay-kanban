<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { tasks, columns, activeBoard } from '$lib/stores/board';
    import { activeTask, setActiveTask } from '$lib/stores/board';
    import { currentBoardRole } from '$lib/stores/user';
    import { updateTask } from '$lib/api/tasksApi';
    import type { Task } from '$lib/types';
    import { tick } from 'svelte';
    // Bypass frappe-gantt's incomplete exports map by using the filesystem path directly
    import ganttCssUrl from '/node_modules/frappe-gantt/dist/frappe-gantt.css?url';
    import { exportGanttImage, exportBoardCSV, triggerDownload } from '$lib/api/exportApi';
    import { API_URL } from '$lib/constants';

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
        _isSubtask?: boolean;
        _parentId?: string;
        _subtaskDone?: boolean;
        _subtaskFinishDate?: string | null;
    }

    const SUBTASK_COLORS = [
        '#f59e0b', // amber
        '#10b981', // emerald
        '#8b5cf6', // violet
        '#ef4444', // red
        '#06b6d4', // cyan
        '#f97316', // orange
        '#84cc16', // lime
        '#ec4899', // pink
    ];

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

        const result: GanttTask[] = [];

        for (const t of uniqueTasks) {
            const hasStart = !!t.start_date;
            const hasEnd = !!t.due_date;
            const start = toDateStr(t.start_date, today);
            let end = toDateStr(t.due_date, addDay(today, 1));

            // Ensure end is strictly after start to avoid frappe-gantt errors
            if (new Date(end) <= new Date(start)) {
                end = formatDate(addDay(new Date(start), 1));
            }

            result.push({
                id: t.id,
                name: t.title || 'Untitled Task',
                start,
                end,
                progress: t.status === 'done' ? 100 : t.status === 'in-progress' ? 50 : 0,
                dependencies: '',
                // Visually distinguish tasks with no real dates
                custom_class: !hasStart && !hasEnd ? 'gantt-task-unscheduled' : '',
                _original: t,
            });

            // Add subtasks
            if (t.subtasks && t.subtasks.length > 0) {
                t.subtasks.forEach((st, idx) => {
                    const colorIndex = idx % SUBTASK_COLORS.length;
                    const stStart = start;
                    let stEnd = st.is_finished && st.finish_date
                        ? toDateStr(st.finish_date, new Date(end))
                        : end;

                    // Ensure stEnd > stStart
                    if (new Date(stEnd) <= new Date(stStart)) {
                        stEnd = formatDate(addDay(new Date(stStart), 1));
                    }

                    result.push({
                        id: `subtask-${st.id}`,
                        name: `  ↳ ${st.title || 'Untitled Subtask'}`,
                        start: stStart,
                        end: stEnd,
                        progress: st.is_finished ? 100 : (st.percentage || 0),
                        dependencies: '',
                        custom_class: `gantt-subtask gantt-subtask-color-${colorIndex}${st.is_finished ? ' gantt-subtask-done' : ''}`,
                        _original: t,
                        _isSubtask: true,
                        _parentId: t.id,
                        _subtaskDone: st.is_finished,
                        _subtaskFinishDate: st.finish_date ? formatDate(new Date(st.finish_date)) : null,
                    });
                });
            }
        }

        return result;
    }

    let activeGaps: {start: number, end: number, days: number}[] = [];
    let mapTimeFunc: (t: number) => number = (t) => t;
    let unmapTimeFunc: (t: number) => number = (t) => t;

    function compressTasks(tasks: GanttTask[]): GanttTask[] {
        activeGaps = [];
        mapTimeFunc = (t) => t;
        unmapTimeFunc = (t) => t;
        if (tasks.length === 0) return tasks;

        const spans = tasks.map(t => ({
            id: t.id,
            start: new Date(t.start).getTime(),
            end: new Date(t.end).getTime()
        }));

        let events: {time: number, type: 'start'|'end'}[] = [];
        for (const s of spans) {
            events.push({ time: s.start, type: 'start' });
            events.push({ time: s.end, type: 'end' });
        }
        events.sort((a, b) => a.time - b.time);

        let activeCount = 0;
        let lastTime = events[0].time;

        for (const e of events) {
            if (activeCount === 0 && e.time > lastTime) {
                const gapDays = (e.time - lastTime) / (1000 * 60 * 60 * 24);
                if (gapDays > 2) {
                    activeGaps.push({ start: lastTime, end: e.time, days: gapDays });
                }
            }
            if (e.type === 'start') activeCount++;
            else activeCount--;
            
            lastTime = e.time;
        }

        if (activeGaps.length === 0) return tasks;

        const COMPRESSED_GAP_DAYS = 2;
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        mapTimeFunc = function(t: number): number {
            let shift = 0;
            for (const g of activeGaps) {
                if (t >= g.end) {
                    shift += (g.days - COMPRESSED_GAP_DAYS) * MS_PER_DAY;
                } else if (t > g.start && t < g.end) {
                    shift += (t - g.start) / MS_PER_DAY * MS_PER_DAY - (COMPRESSED_GAP_DAYS * MS_PER_DAY);
                }
            }
            return t - shift;
        };

        unmapTimeFunc = function(mappedT: number): number {
            let shift = 0;
            for (const g of activeGaps) {
                const mappedGapStart = mapTimeFunc(g.start);
                const mappedGapEnd = mapTimeFunc(g.end);
                if (mappedT >= mappedGapEnd) {
                    shift += (g.days - COMPRESSED_GAP_DAYS) * MS_PER_DAY;
                } else if (mappedT > mappedGapStart && mappedT < mappedGapEnd) {
                    const ratio = (mappedT - mappedGapStart) / (COMPRESSED_GAP_DAYS * MS_PER_DAY);
                    shift += ratio * (g.days - COMPRESSED_GAP_DAYS) * MS_PER_DAY;
                }
            }
            return mappedT + shift;
        };

        return tasks.map(t => ({
            ...t,
            start: formatDate(new Date(mapTimeFunc(new Date(t.start).getTime()))),
            end: formatDate(new Date(mapTimeFunc(new Date(t.end).getTime()))),
        }));
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
                readonly: isReadOnly || isCompact, // disable dragging when dates are compressed/faked
                popup_trigger: 'click',
                bar_height: isCompact ? 18 : 30,
                padding: isCompact ? 8 : 18,
                column_width: isCompact ? (viewMode === 'Day' ? 15 : viewMode === 'Week' ? 50 : 60) : undefined,
                custom_popup_html: (task: GanttTask) => {
                    if (task._isSubtask) {
                        const doneStr = task._subtaskDone
                            ? `✓ Done on ${task._subtaskFinishDate || task.end}`
                            : `In progress (${task.progress}%)`;
                        return `<div class="p-2 bg-[#1e293b] text-white rounded shadow-lg text-xs">
                            <strong>${task.name.replace('  ↳ ', '')}</strong><br/>
                            ${doneStr}
                        </div>`;
                    }
                    const startStr = task._original?.start_date || task.start;
                    const endStr = task._original?.due_date || task.end;
                    return `<div class="p-2 bg-[#1e293b] text-white rounded shadow-lg text-xs">
                        <strong>${task.name}</strong><br/>
                        ${startStr} to ${endStr}
                    </div>`;
                },
                on_click: (task: GanttTask) => {
                    const targetId = task._isSubtask && task._parentId ? task._parentId : task.id;
                    const original = $tasks.find((t) => t.id === targetId);
                    if (original) setActiveTask(original);
                },
                on_date_change: async (task: GanttTask, start: Date, end: Date) => {
                    if (isReadOnly || isCompact || task._isSubtask) return;
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
    $: baseGanttTasks = transformTasks($tasks);
    $: ganttTasks = isCompact ? compressTasks(baseGanttTasks) : baseGanttTasks;

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
                tick().then(applyCompactVisuals);
            }
        } else {
            if (currentViewMode !== viewMode || lastCompactMode !== isCompact) {
                buildGantt(ganttTasks);
                currentViewMode = viewMode;
                lastCompactMode = isCompact;
                lastRenderedTasks = ganttTasks;
                tick().then(applyCompactVisuals);
            } else if (ganttTasks) {
                // If tasks changed but view mode didn't, refresh the tasks list
                if (ganttTasks.length === 0) {
                    buildGantt(ganttTasks);
                    lastRenderedTasks = null;
                    tick().then(applyCompactVisuals);
                } else if (ganttInstance && lastRenderedTasks !== ganttTasks) {
                    try {
                        ganttInstance.refresh(ganttTasks);
                        lastRenderedTasks = ganttTasks;
                        tick().then(applyCompactVisuals);
                    } catch (err) {
                        console.warn('Gantt refresh failed, falling back to full rebuild:', err);
                        buildGantt(ganttTasks);
                        lastRenderedTasks = ganttTasks;
                        tick().then(applyCompactVisuals);
                    }
                }
            }
        }
    }

    function applyCompactVisuals() {
        if (!containerEl) return;
        const svg = containerEl.querySelector('svg');
        if (!svg) return;

        svg.querySelectorAll('.custom-gap-overlay').forEach(e => e.remove());

        if (!isCompact || !ganttInstance || !activeGaps.length) return;

        const gantt_start = ganttInstance.gantt_start;
        let step = 24;
        if (viewMode === 'Week') step = 168;
        if (viewMode === 'Month') step = 720;
        
        const actual_col_width = ganttInstance.options.column_width;
        const svgHeight = svg.getAttribute('height') || '100%';

        activeGaps.forEach(g => {
            const mappedStart = new Date(mapTimeFunc(g.start));
            const mappedEnd = new Date(mapTimeFunc(g.end));

            const durationHrsStart = (mappedStart.getTime() - gantt_start.getTime()) / (1000 * 60 * 60);
            const x = (durationHrsStart / step) * actual_col_width;

            const durationHrsEnd = (mappedEnd.getTime() - gantt_start.getTime()) / (1000 * 60 * 60);
            const w = ((durationHrsEnd - durationHrsStart) / step) * actual_col_width;

            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute("class", "custom-gap-overlay");
            
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x.toString());
            rect.setAttribute("y", "0");
            rect.setAttribute("width", w.toString());
            rect.setAttribute("height", svgHeight.toString());
            rect.setAttribute("fill", "#94a3b8");
            rect.setAttribute("opacity", "0.15");
            
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", (x + w/2).toString());
            text.setAttribute("y", "35"); 
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "#64748b");
            text.setAttribute("font-size", "10px");
            text.setAttribute("font-weight", "600");
            text.textContent = `Skip: ${formatDate(new Date(g.start))} to ${formatDate(new Date(g.end))}`;

            group.appendChild(rect);
            group.appendChild(text);
            
            const grid = svg.querySelector('.grid-background');
            if (grid && grid.nextSibling) {
                svg.insertBefore(group, grid.nextSibling);
            } else {
                svg.appendChild(group);
            }
        });

        const ticks = svg.querySelectorAll('.tick');
        ticks.forEach(tick => {
            const transform = tick.getAttribute('transform');
            if (!transform) return;
            const match = transform.match(/translate\(([^,]+)/);
            if (match) {
                const x = parseFloat(match[1]);
                const mappedTime = gantt_start.getTime() + (x / actual_col_width) * step * 60 * 60 * 1000;
                const realTime = unmapTimeFunc(mappedTime);
                const date = new Date(realTime);
                
                const textEls = tick.querySelectorAll('text');
                textEls.forEach(textEl => {
                    if (textEl.classList.contains('lower-text')) {
                        if (viewMode === 'Day') {
                            textEl.textContent = date.getDate().toString();
                        } else if (viewMode === 'Week') {
                            textEl.textContent = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
                        } else {
                            textEl.textContent = date.toLocaleString('default', { month: 'short' });
                        }
                    } else if (textEl.classList.contains('upper-text')) {
                        if (viewMode === 'Day' || viewMode === 'Week') {
                            textEl.textContent = date.toLocaleString('default', { month: 'long', year: 'numeric' });
                        } else {
                            textEl.textContent = date.getFullYear().toString();
                        }
                    }
                });
            }
        });
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

    // ─── Export helpers (backend-driven) ────────────────────────────────────
    let exporting = false;
    let showExportMenu = false;
    let exportError: string | null = null;

    function showNotification(message: string, type: 'error' | 'success' = 'error') {
        // Reuse a simple toast or alert for now
        // In a real app, this would hook into a toast store
        alert(message);
    }

    async function handleExport(format: 'png' | 'pdf') {
        if (!$activeBoard) return;
        exporting = true;
        showExportMenu = false;
        exportError = null;
        try {
            const result = await exportGanttImage($activeBoard.id, format);
            if (result?.url) {
                // Fetch the exported file as a blob to force a download instead of just displaying it
                const fullUrl = result.url.startsWith('http') ? result.url : `${API_URL}${result.url}`;
                const response = await fetch(fullUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                triggerDownload(blobUrl, `${$activeBoard.name ?? 'board'}-gantt.${format}`);
                URL.revokeObjectURL(blobUrl);
            }
        } catch (e: any) {
            exportError = e.message || 'Export failed';
            if (e.message?.includes('EMPTY_BOARD') || e.message?.includes('No tasks')) {
                showNotification('This board has no tasks to export', 'error');
            } else {
                showNotification(exportError, 'error');
            }
            console.error('Export failed:', e);
        } finally {
            exporting = false;
        }
    }

    async function handleExportCSV() {
        if (!$activeBoard) return;
        exporting = true;
        showExportMenu = false;
        exportError = null;
        try {
            const result = await exportBoardCSV($activeBoard.id);
            if (result?.csv) {
                const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                triggerDownload(url, `${$activeBoard.name ?? 'board'}-tasks.csv`);
                URL.revokeObjectURL(url);
            }
        } catch (e: any) {
            exportError = e.message || 'CSV Export failed';
            if (e.message?.includes('EMPTY_BOARD') || e.message?.includes('No tasks')) {
                showNotification('This board has no tasks to export', 'error');
            } else {
                showNotification(exportError, 'error');
            }
            console.error('CSV export failed:', e);
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
                            on:click={() => handleExport('png')}
                            id="export-png-btn"
                        >
                            <span class="material-symbols-outlined text-[16px]">image</span>
                            Export as PNG
                        </button>
                        <button
                            class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#374151] dark:text-gray-300 hover:bg-[#f3f4f6] dark:hover:bg-[#253040] transition-colors"
                            on:click={() => handleExport('pdf')}
                            id="export-pdf-btn"
                        >
                            <span class="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                            Export as PDF
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#2a3a4a] my-1"></div>
                        <button
                            class="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#374151] dark:text-gray-300 hover:bg-[#f3f4f6] dark:hover:bg-[#253040] transition-colors"
                            on:click={handleExportCSV}
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
    <div class="flex items-center gap-4 px-6 py-2 text-[11px] text-[#8a98a8] dark:text-[#5c6b7f] border-b border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0 flex-wrap">
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-primary opacity-80"></span>
            Scheduled
        </span>
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-[#94a3b8]"></span>
            Unscheduled (default dates)
        </span>
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-2 rounded-sm bg-[#f59e0b] opacity-80"></span>
            Subtask (Active)
        </span>
        <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-2 rounded-sm bg-[#94a3b8] opacity-50"></span>
            Subtask (Done)
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
    :global(.compact .gantt-container .gantt .tick text) {
        font-size: 10px !important;
    }

    /* Dark mode adjustments for big labels (labels drawn outside the bar) */
    :global(.dark .gantt-container .gantt .bar-label.big) {
        fill: #cbd5e1 !important;
    }

    /* Subtask styles */
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask) {
        transform: translateY(8px);
    }
    :global(.compact .gantt-container .gantt .bar-wrapper.gantt-subtask) {
        transform: translateY(4px);
    }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask .bar) {
        height: 14px !important;
        rx: 3;
        opacity: 0.85;
    }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask .bar-progress) {
        height: 14px !important;
        rx: 3;
    }
    :global(.compact .gantt-container .gantt .bar-wrapper.gantt-subtask .bar) {
        height: 10px !important;
    }
    :global(.compact .gantt-container .gantt .bar-wrapper.gantt-subtask .bar-progress) {
        height: 10px !important;
    }

    /* Subtask bar colors */
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-0 .bar) { fill: #f59e0b !important; stroke: #f59e0b !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-0 .bar-progress) { fill: #d97706 !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-1 .bar) { fill: #10b981 !important; stroke: #10b981 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-1 .bar-progress) { fill: #059669 !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-2 .bar) { fill: #8b5cf6 !important; stroke: #8b5cf6 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-2 .bar-progress) { fill: #7c3aed !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-3 .bar) { fill: #ef4444 !important; stroke: #ef4444 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-3 .bar-progress) { fill: #dc2626 !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-4 .bar) { fill: #06b6d4 !important; stroke: #06b6d4 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-4 .bar-progress) { fill: #0891b2 !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-5 .bar) { fill: #f97316 !important; stroke: #f97316 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-5 .bar-progress) { fill: #ea580c !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-6 .bar) { fill: #84cc16 !important; stroke: #84cc16 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-6 .bar-progress) { fill: #65a30d !important; }
    
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-7 .bar) { fill: #ec4899 !important; stroke: #ec4899 !important; }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-color-7 .bar-progress) { fill: #db2777 !important; }

    /* Done subtasks styling */
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-done .bar) {
        fill: #94a3b8 !important;
        stroke: #94a3b8 !important;
        opacity: 0.5 !important;
    }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-done .bar-progress) {
        fill: #64748b !important;
        opacity: 0.5 !important;
    }
    :global(.gantt-container .gantt .bar-wrapper.gantt-subtask-done .bar-label) {
        opacity: 0.5 !important;
    }
</style>
