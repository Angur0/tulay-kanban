/**
 * Kafka Kanban Board - Frontend Application (TypeScript)
 */

import {
    STORAGE_KEY, API_URL, getWsUrl, normalizeBoardIcon,
    columnColorClasses, labelColors, statusLabels, TASK_DRAG_KEY
} from './state.ts';
import { authFetch, sendKafkaEventRequest } from './api.ts';
import { escapeHtml, formatEventData, formatDate, formatDateWithYear, showToast, showKafkaEvent } from './ui.ts';
import { bindStaticDomEvents } from './dom-events.ts';
import { bindBoardListeners } from './listeners/board.ts';
import { bindTaskListeners } from './listeners/task.ts';
import { bindModalListeners } from './listeners/modal.ts';
import { bindDragDropListeners } from './listeners/dragdrop.ts';
import {
    showCreateListModalService, hideCreateListModalService, createColumnService,
    showDeleteListModalService, hideDeleteListModalService, confirmDeleteListService
} from './services/modal-service.ts';
import {
    loadBoardsService, createBoardService, deleteBoardService,
    showDeleteBoardModalService, hideDeleteBoardModalService, switchBoardService,
    showCreateBoardModalService, hideCreateBoardModalService,
    showEditBoardModalService, hideEditBoardModalService, updateBoardService
} from './services/board-service.ts';
import {
    saveTaskFromPanelService, addTaskService, addTaskToColumnService,
    updateTaskService, showDeleteModalService, hideDeleteModalService, deleteTaskService
} from './services/task-service.ts';
import {
    sendKafkaEventService, connectWebSocketService,
    handleIncomingKafkaEventService, notifyKafkaEventService
} from './services/realtime-service.ts';
import {
    cleanupDragStateService, handleDragStartService, handleDragEndService,
    handleDragOverService, getDragAfterElementService, handleDragEnterService,
    handleDragLeaveService, handleDropService, persistTaskDropService,
    handleColumnDragStartService, handleColumnDragEndService,
    handleColumnDragOverService, handleColumnDropService
} from './services/dragdrop-service.ts';
import type { Task, Board, Column, Label, WorkspaceMember, KafkaEvent, AppElements, TaskComment } from './types.ts';

// ===== State =====
let tasks: Task[] = [];
let globalEvents: KafkaEvent[] = [];
let currentUser: { id: string; full_name?: string } | null = null;
let activeBoardId: string | null = null;
let currentEditingTask: Task | null = null;
let activeInlineForm: { columnId: string; formContainer: HTMLElement; addBtn: HTMLElement } | null = null;
let websocket: WebSocket | null = null;
let kafkaConnected = false;
let workspaceMembers: WorkspaceMember[] = [];
let boards: Board[] = [];
let columns: Column[] = [];
let labels: Label[] = [];
let globalLabels: Label[] = [];
let boardLabels: Label[] = [];
let activeWorkspaceId: string | null = null;
let taskToDeleteId: string | null = null;
let currentContextTask: Task | null = null;
let currentContextColumnId: string | null = null;
let currentContextBoardId: string | null = null;
let boardToDeleteId: string | null = null;
let currentCommentImages: string[] = [];

// ===== DOM Elements =====
const elements: AppElements = {
    board: document.getElementById('board'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),
    boardHeaderIcon: document.getElementById('boardHeaderIcon'),
    kafkaStatus: document.getElementById('kafkaStatus'),
    taskPanel: document.getElementById('taskPanel'),
    panelOverlay: document.getElementById('panelOverlay'),
    panelContent: document.getElementById('panelContent'),
    panelTaskId: document.getElementById('panelTaskId'),
    panelTaskStatus: document.getElementById('panelTaskStatus'),
    panelTitle: document.getElementById('panelTitle'),
    panelDescription: document.getElementById('panelDescription'),
    panelStatusSelect: document.getElementById('panelStatusSelect'),
    panelPrioritySelect: document.getElementById('panelPrioritySelect'),
    panelLabelSelect: document.getElementById('panelLabelSelect'),
    panelDueDate: document.getElementById('panelDueDate'),
    panelAssigneeSelect: document.getElementById('panelAssigneeSelect'),
    panelEventLog: document.getElementById('panelEventLog'),
    panelImagesContainer: document.getElementById('panelImagesContainer'),
    panelImageUpload: document.getElementById('panelImageUpload'),
    panelAddImageBtn: document.getElementById('panelAddImageBtn'),
    imageUploadStatus: document.getElementById('imageUploadStatus'),
    commentsContainer: document.getElementById('commentsContainer'),
    commentInput: document.getElementById('commentInput'),
    commentImagesContainer: document.getElementById('commentImagesContainer'),
    commentImageUpload: document.getElementById('commentImageUpload'),
    addCommentImageBtn: document.getElementById('addCommentImageBtn'),
    submitCommentBtn: document.getElementById('submitCommentBtn'),
    commentImageStatus: document.getElementById('commentImageStatus'),
    closePanelBtn: document.getElementById('closePanelBtn'),
    cancelPanelBtn: document.getElementById('cancelPanelBtn'),
    savePanelBtn: document.getElementById('savePanelBtn'),
    deleteTaskBtn: document.getElementById('deleteTaskBtn'),
    boardView: document.getElementById('boardView'),
    activityView: document.getElementById('activityView'),
    activityLog: document.getElementById('activityLog'),
    myTasksView: document.getElementById('myTasksView'),
    myTasksList: document.getElementById('myTasksList'),
    myTasksCount: document.getElementById('myTasksCount'),
    navBoard: document.getElementById('navBoard'),
    navActivity: document.getElementById('navActivity'),
    navMyTasks: document.getElementById('navMyTasks'),
    toastContainer: document.getElementById('toastContainer'),
    headerStats: document.getElementById('headerStats'),
    deleteModal: document.getElementById('deleteModal'),
    deleteTaskTitle: document.getElementById('deleteTaskTitle'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    boardList: document.getElementById('boardList'),
    createBoardBtn: document.getElementById('createBoardBtn'),
    createBoardModal: document.getElementById('createBoardModal'),
    newBoardName: document.getElementById('newBoardName'),
    newBoardIcon: document.getElementById('newBoardIcon'),
    newBoardIconColor: document.getElementById('newBoardIconColor'),
    iconDropdownButton: document.getElementById('iconDropdownButton'),
    iconDropdownMenu: document.getElementById('iconDropdownMenu'),
    selectedIconPreview: document.getElementById('selectedIconPreview'),
    cancelCreateBoardBtn: document.getElementById('cancelCreateBoardBtn'),
    confirmCreateBoardBtn: document.getElementById('confirmCreateBoardBtn'),
    createListModal: document.getElementById('createListModal'),
    newListTitle: document.getElementById('newListTitle'),
    cancelCreateListBtn: document.getElementById('cancelCreateListBtn'),
    confirmCreateListBtn: document.getElementById('confirmCreateListBtn'),
    deleteBoardModal: document.getElementById('deleteBoardModal'),
    deleteBoardName: document.getElementById('deleteBoardName'),
    deleteBoardConfirmInput: document.getElementById('deleteBoardConfirmInput'),
    cancelDeleteBoardBtn: document.getElementById('cancelDeleteBoardBtn'),
    confirmDeleteBoardBtn: document.getElementById('confirmDeleteBoardBtn'),
    deleteListModal: document.getElementById('deleteListModal'),
    deleteListName: document.getElementById('deleteListName'),
    deleteListConfirmInput: document.getElementById('deleteListConfirmInput'),
    cancelDeleteListBtn: document.getElementById('cancelDeleteListBtn'),
    confirmDeleteListBtn: document.getElementById('confirmDeleteListBtn'),
    taskContextMenu: document.getElementById('taskContextMenu'),
    contextOpenTask: document.getElementById('contextOpenTask'),
    contextStatusOptions: document.getElementById('contextStatusOptions'),
    contextPriorityLow: document.getElementById('contextPriorityLow'),
    contextPriorityMedium: document.getElementById('contextPriorityMedium'),
    contextPriorityHigh: document.getElementById('contextPriorityHigh'),
    contextDeleteTask: document.getElementById('contextDeleteTask'),
    boardContextMenu: document.getElementById('boardContextMenu'),
    contextEditBoard: document.getElementById('contextEditBoard'),
    contextDeleteBoard: document.getElementById('contextDeleteBoard'),
    columnContextMenu: document.getElementById('columnContextMenu'),
    contextColumnAddTask: document.getElementById('contextColumnAddTask'),
    contextColumnRename: document.getElementById('contextColumnRename'),
    contextColumnMoveLeft: document.getElementById('contextColumnMoveLeft'),
    contextColumnMoveRight: document.getElementById('contextColumnMoveRight'),
    contextColumnDelete: document.getElementById('contextColumnDelete'),
    editBoardModal: document.getElementById('editBoardModal'),
    editBoardName: document.getElementById('editBoardName'),
    editBoardIcon: document.getElementById('editBoardIcon'),
    editBoardIconColor: document.getElementById('editBoardIconColor'),
    editIconDropdownButton: document.getElementById('editIconDropdownButton'),
    editIconDropdownMenu: document.getElementById('editIconDropdownMenu'),
    editSelectedIconPreview: document.getElementById('editSelectedIconPreview'),
    cancelEditBoardBtn: document.getElementById('cancelEditBoardBtn'),
    confirmEditBoardBtn: document.getElementById('confirmEditBoardBtn'),
};

// ===== Storage =====
async function loadTasks(): Promise<void> {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/tasks`);
        if (!response) return;
        if (!response.ok) { showToast(elements.toastContainer, 'Failed to load tasks', 'error'); return; }
        tasks = await response.json() as Task[];
        renderBoard();
    } catch (e) { console.error(e); showToast(elements.toastContainer, 'Error loading tasks', 'error'); }
}

function saveTasks(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch (e) { console.error(e); }
}

// ===== Rendering =====
function renderBoard(): void {
    const boardEl = document.getElementById('board');
    if (!boardEl) return;
    updateKafkaStatusUI();
    updateHeaderStats();
    const boardTitleEl = document.getElementById('boardTitle');
    if (boardTitleEl) {
        if (boards.length === 0) { boardTitleEl.textContent = 'No Boards'; if (elements.boardHeaderIcon) elements.boardHeaderIcon.textContent = 'dashboard'; }
        else if (!activeBoardId) { boardTitleEl.textContent = 'Select a Board'; if (elements.boardHeaderIcon) elements.boardHeaderIcon.textContent = 'dashboard'; }
        else {
            const ab = boards.find(b => b.id === activeBoardId);
            boardTitleEl.textContent = ab ? ab.name : 'Board';
            if (elements.boardHeaderIcon) elements.boardHeaderIcon.textContent = normalizeBoardIcon((ab as Board & { icon?: string })?.icon);
        }
    }
    if (boards.length === 0) { boardEl.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]"><span class="material-symbols-outlined text-5xl mb-4 opacity-30">dashboard_customize</span><p class="text-base font-medium mb-2">No boards yet</p><button data-action="open-create-board" class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"><span class="material-symbols-outlined text-[18px]">add</span>Create Board</button></div>`; return; }
    if (!activeBoardId) { boardEl.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]"><span class="material-symbols-outlined text-4xl mb-4 opacity-30">dashboard</span><p class="text-sm">Select a board from the sidebar</p></div>`; return; }
    if (columns.length === 0) { boardEl.innerHTML = `<div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]"><span class="material-symbols-outlined text-5xl mb-4 opacity-30">view_week</span><p class="text-base font-medium mb-2">No lists yet</p><button data-action="open-create-list" class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"><span class="material-symbols-outlined text-[18px]">add</span>Create List</button></div>`; return; }
    boardEl.innerHTML = columns.map((col, index) => `
        <div class="column flex flex-col w-80 flex-shrink-0 h-full rounded-xl transition-colors" data-column-id="${col.id}">
            <div class="column-drag-handle flex items-center justify-between mb-3 px-1" draggable="true">
                <div class="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                    <span class="material-symbols-outlined text-[#8a98a8] text-[18px]">drag_indicator</span>
                    <span class="flex items-center justify-center size-5 rounded text-[10px] font-bold text-white ${columnColorClasses[index % columnColorClasses.length]}" id="count-${col.id}">0</span>
                    <h3 class="text-sm font-semibold text-[#111418] dark:text-white editable-title" data-column-id="${col.id}" contenteditable="false">${escapeHtml(col.title)}</h3>
                </div>
                <div class="flex items-center gap-1 relative">
                    <button class="column-menu-btn text-[#8a98a8] hover:text-[#111418] dark:hover:text-white" data-column-id="${col.id}"><span class="material-symbols-outlined text-[18px]">more_horiz</span></button>
                    <div class="column-menu hidden absolute right-0 top-8 bg-white dark:bg-[#151e29] rounded-lg shadow-xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-48 z-10" data-column-id="${col.id}">
                        <button data-action="column-add-card" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"><span class="material-symbols-outlined text-[18px]">add</span>Add card</button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button data-action="column-move-left" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === 0 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><span class="material-symbols-outlined text-[18px]">arrow_back</span>Move left</button>
                        <button data-action="column-move-right" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === columns.length - 1 ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}><span class="material-symbols-outlined text-[18px]">arrow_forward</span>Move right</button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button data-action="column-rename" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left"><span class="material-symbols-outlined text-[18px]">edit</span>Rename list</button>
                        <button data-action="column-delete" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left"><span class="material-symbols-outlined text-[18px]">delete</span>Delete list</button>
                    </div>
                </div>
            </div>
            <div class="task-list flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 pr-1" id="list-${col.id}" data-column-id="${col.id}"></div>
            <div class="inline-add-form hidden" data-column-id="${col.id}"></div>
            <button class="add-card-btn flex items-center justify-center px-2 py-2 mt-2 text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" data-column-id="${col.id}" title="Add Card"><span class="material-symbols-outlined text-[20px]">add</span></button>
        </div>
    `).join('') + `<div class="flex-shrink-0 h-full flex items-stretch"><button id="addListBtn" class="flex flex-col items-center justify-center px-4 w-16 bg-[#f1f3f5] dark:bg-[#1a232e] hover:bg-[#e6e8eb] dark:hover:bg-[#253040] rounded-xl text-[#5c6b7f] dark:text-gray-400 font-medium transition-all shadow-sm"><span class="material-symbols-outlined text-2xl">add</span></button></div>`;
    const addListBtn = document.getElementById('addListBtn');
    if (addListBtn) addListBtn.addEventListener('click', showCreateListModal);
    attachBoardEventListeners();
    columns.forEach(col => {
        const colTasks = tasks.filter(t => t.column_id === col.id);
        const listEl = document.getElementById(`list-${col.id}`);
        const countEl = document.getElementById(`count-${col.id}`);
        if (listEl) { listEl.innerHTML = ''; colTasks.forEach(task => listEl.appendChild(createTaskCard(task))); }
        if (countEl) countEl.textContent = String(colTasks.length);
    });
}

function updateHeaderStats(): void {
    if (!elements.headerStats) return;
    if (!activeBoardId || columns.length === 0) { elements.headerStats.innerHTML = ''; return; }
    elements.headerStats.innerHTML = columns.map((col, index) => {
        const count = tasks.filter(t => t.column_id === col.id).length;
        return `<div class="flex items-center gap-1.5"><span class="size-2 rounded-full ${columnColorClasses[index % columnColorClasses.length]}"></span><span class="text-[#5c6b7f] dark:text-gray-400">${escapeHtml(col.title)}: <span class="font-semibold text-[#111418] dark:text-white">${count}</span></span></div>`;
    }).join('');
}

function switchView(viewName: string): void {
    elements.boardView!.classList.add('hidden');
    elements.activityView!.classList.add('hidden');
    elements.myTasksView!.classList.add('hidden');
    [elements.navBoard, elements.navActivity, elements.navMyTasks].forEach(nav => {
        nav?.classList.remove('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        nav?.classList.add('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
    });
    if (viewName === 'board') {
        elements.boardView!.classList.remove('hidden');
        elements.navBoard!.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navBoard!.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        renderBoard();
    } else if (viewName === 'activity') {
        elements.activityView!.classList.remove('hidden');
        elements.navActivity!.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navActivity!.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        loadActivities();
    } else if (viewName === 'my-tasks') {
        elements.myTasksView!.classList.remove('hidden');
        elements.navMyTasks!.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navMyTasks!.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        loadMyTasks();
    }
}

async function loadActivities(): Promise<void> {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/activities`);
        if (!response) return;
        const activities = await response.json() as Array<Record<string, unknown>>;
        globalEvents = activities.map(a => ({
            type: a['event_type'] as string, taskId: (a['task_title'] || a['task_id']) as string,
            originalTaskId: a['task_id'] as string, data: a['data'] as Record<string, unknown>,
            time: new Date(a['timestamp'] as string).toLocaleTimeString(), timestamp: a['timestamp'] as string,
        }));
        renderActivityLog();
    } catch (e) { console.error(e); }
}

function renderActivityLog(): void {
    if (globalEvents.length === 0) {
        elements.activityLog!.innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-[#8a98a8]"><span class="material-symbols-outlined text-4xl mb-4 opacity-30">history</span><p class="text-sm">No activity recorded yet</p></div>`;
        return;
    }
    const typeColors: Record<string, string> = {
        'TASK_CREATED': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
        'TASK_UPDATED': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
        'TASK_MOVED': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
        'TASK_DELETED': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
        'RECEIVED': 'text-primary bg-primary/10'
    };
    elements.activityLog!.innerHTML = globalEvents.map(event => {
        const colorClass = typeColors[event.type] || 'text-gray-600 bg-gray-50';
        const icon = event.type === 'TASK_DELETED' ? 'delete' : event.type === 'TASK_CREATED' ? 'add_circle' : 'bolt';
        return `<div class="flex items-start gap-4 p-4 bg-white dark:bg-[#151e29] rounded-xl border border-[#e5e7eb] dark:border-[#1e2936] shadow-sm hover:border-primary/30 transition-colors"><div class="p-2 rounded-lg ${colorClass} shrink-0"><span class="material-symbols-outlined text-[20px]">${icon}</span></div><div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2 mb-1"><h4 class="text-sm font-semibold text-[#111418] dark:text-white truncate">${(event as KafkaEvent & { taskTitle?: string }).taskTitle ? escapeHtml((event as KafkaEvent & { taskTitle?: string }).taskTitle!) : (event.taskId || 'System')}</h4><span class="text-[10px] font-medium text-[#8a98a8] whitespace-nowrap">${event.time}</span></div><div class="flex items-center gap-2"><span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass} uppercase tracking-wider">${event.type.replace('TASK_', '')}</span><p class="text-xs text-[#5c6b7f] dark:text-gray-400 truncate">${event.type === 'TASK_CREATED' ? 'Task created' : formatEventData(event.data)}</p></div></div></div>`;
    }).join('');
}

async function loadMyTasks(): Promise<void> {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/my`);
        if (!response) return;
        const myTasks = await response.json() as Task[];
        (elements.myTasksCount as HTMLElement).textContent = `${myTasks.length} task${myTasks.length !== 1 ? 's' : ''}`;
        if (myTasks.length === 0) {
            (elements.myTasksList as HTMLElement).innerHTML = `<div class="flex flex-col items-center justify-center py-20 text-[#8a98a8]"><span class="material-symbols-outlined text-4xl mb-4 opacity-30">check_circle</span><p class="text-sm">No tasks assigned to you</p></div>`;
            return;
        }
        const grouped: Record<string, Task[]> = { todo: [], inprogress: [], done: [] };
        myTasks.forEach(task => { if (grouped[task.status]) grouped[task.status].push(task); });
        const statusNames: Record<string, string> = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
        const statusColors: Record<string, string> = { todo: 'bg-amber-500', inprogress: 'bg-primary', done: 'bg-green-500' };
        (elements.myTasksList as HTMLElement).innerHTML = ['todo', 'inprogress', 'done'].map(status => {
            const st = grouped[status];
            if (!st || st.length === 0) return '';
            return `<div class="mb-6"><div class="flex items-center gap-2 mb-3"><span class="size-2 rounded-full ${statusColors[status]}"></span><span class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase">${statusNames[status]} (${st.length})</span></div><div class="flex flex-col gap-2">${st.map(task => `<div class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all" data-task-id="${task.id}"><p class="text-sm font-medium text-[#111418] dark:text-gray-200">${escapeHtml(task.title)}</p>${task.description ? `<p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1">${escapeHtml(task.description)}</p>` : ''}</div>`).join('')}</div></div>`;
        }).join('');
        document.querySelectorAll<HTMLElement>('.task-card-my').forEach(card => {
            card.addEventListener('click', () => {
                const task = myTasks.find(t => t.id === card.dataset.taskId);
                if (task) openTaskPanel(task);
            });
        });
    } catch (e) { console.error(e); }
}

async function loadColumns(): Promise<void> {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/columns`);
        if (!response) return;
        columns = await response.json() as Column[];
    } catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to load columns', 'error'); }
}

// ===== Column CRUD =====
function showCreateListModal(): void { showCreateListModalService({ elements }); }
function hideCreateListModal(): void { hideCreateListModalService({ elements }); }

async function createColumn(): Promise<void> {
    await createColumnService({ elements, activeBoardId, columns, authFetch, API_URL, hideCreateListModal, loadColumns, renderBoard, showToast: (msg: string, type: 'info' | 'success' | 'error') => showToast(elements.toastContainer, msg, type) });
}

async function deleteColumn(columnId: string): Promise<void> {
    closeAllColumnMenus();
    showDeleteListModal(columnId);
}

function showDeleteListModal(columnId: string): void {
    showDeleteListModalService({ columns, confirmDeleteList, hideDeleteListModal }, columnId);
}
function hideDeleteListModal(): void { hideDeleteListModalService(); }

async function confirmDeleteList(columnId: string): Promise<void> {
    await confirmDeleteListService({ authFetch, API_URL, loadColumns, renderBoard, showToast: (msg: string, type: 'info' | 'success' | 'error') => showToast(elements.toastContainer, msg, type) }, columnId);
}

function editColumnTitle(columnId: string): void {
    closeAllColumnMenus();
    const titleEl = document.querySelector<HTMLElement>(`.editable-title[data-column-id="${columnId}"]`);
    if (!titleEl) return;
    const originalTitle = titleEl.textContent || '';
    titleEl.contentEditable = 'true';
    titleEl.focus();
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const finishEdit = async () => {
        titleEl.contentEditable = 'false';
        const newTitle = titleEl.textContent?.trim() || '';
        if (!newTitle || newTitle === originalTitle) { titleEl.textContent = originalTitle; return; }
        try {
            const response = await authFetch(`${API_URL}/api/columns/${columnId}`, { method: 'PUT', body: JSON.stringify({ title: newTitle }) });
            if (response?.ok) { await loadColumns(); showToast(elements.toastContainer, 'List renamed', 'success'); }
            else { titleEl.textContent = originalTitle; showToast(elements.toastContainer, 'Failed to rename list', 'error'); }
        } catch (e) { titleEl.textContent = originalTitle; showToast(elements.toastContainer, 'Failed to rename list', 'error'); }
    };
    titleEl.addEventListener('blur', finishEdit, { once: true });
    titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); titleEl.blur(); }
        else if (e.key === 'Escape') { titleEl.textContent = originalTitle; titleEl.blur(); }
    }, { once: true });
}

function scrollToAddCard(columnId: string): void {
    closeAllColumnMenus();
    const column = document.querySelector<HTMLElement>(`.column[data-column-id="${columnId}"]`);
    if (!column) return;
    const addBtn = column.querySelector<HTMLButtonElement>('.add-card-btn');
    if (addBtn) { addBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); setTimeout(() => addBtn.click(), 300); }
}

function closeAllColumnMenus(): void {
    document.querySelectorAll('.column-menu').forEach(menu => menu.classList.add('hidden'));
}

async function moveColumnLeft(columnId: string): Promise<void> {
    closeAllColumnMenus();
    const index = columns.findIndex(c => c.id === columnId);
    if (index <= 0) return;
    [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
    await updateColumnPositions(); renderBoard();
}

async function moveColumnRight(columnId: string): Promise<void> {
    closeAllColumnMenus();
    const index = columns.findIndex(c => c.id === columnId);
    if (index < 0 || index >= columns.length - 1) return;
    [columns[index + 1], columns[index]] = [columns[index], columns[index + 1]];
    await updateColumnPositions(); renderBoard();
}

async function updateColumnPositions(): Promise<void> {
    try {
        for (let i = 0; i < columns.length; i++) {
            await authFetch(`${API_URL}/api/columns/${columns[i].id}`, { method: 'PUT', body: JSON.stringify({ position: i }) });
        }
    } catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to update column order', 'error'); }
}

// ===== Label Management =====
async function loadLabels(): Promise<void> {
    if (!activeWorkspaceId) return;
    try {
        const globalResponse = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/labels`);
        if (globalResponse?.ok) globalLabels = await globalResponse.json() as Label[];
        if (activeBoardId) {
            const boardResponse = await authFetch(`${API_URL}/api/boards/${activeBoardId}/labels`);
            if (boardResponse?.ok) boardLabels = await boardResponse.json() as Label[];
        }
        labels = [...globalLabels, ...boardLabels];
    } catch (e) { console.error(e); }
}

function openLabelManager(scope = 'global'): void {
    const modal = document.getElementById('labelManagerModal');
    if (!modal) return;
    modal.classList.remove('hidden'); modal.style.display = '';
    const scopeSelect = document.getElementById('labelScopeSelect') as HTMLSelectElement;
    if (scopeSelect) scopeSelect.value = scope;
    renderLabelLists();
}

function closeLabelManager(): void {
    const modal = document.getElementById('labelManagerModal');
    if (!modal) return;
    modal.classList.add('hidden'); modal.style.display = 'none';
    (document.getElementById('labelNameInput') as HTMLInputElement).value = '';
    (document.getElementById('labelColorInput') as HTMLInputElement).value = '#93c5fd';
}

function renderLabelLists(): void {
    const globalList = document.getElementById('labelListGlobal');
    const boardList = document.getElementById('labelListBoard');
    if (!globalList || !boardList) return;
    const renderLabel = (label: Label) => `<div class="flex items-center justify-between p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg"><div class="flex items-center gap-2"><span class="w-4 h-4 rounded" style="background-color: ${label.color || '#93c5fd'}"></span><span class="text-sm text-[#111418] dark:text-white">${escapeHtml(label.name)}</span></div><button data-action="label-delete" data-label-id="${label.id}" class="text-red-500 hover:text-red-700 transition-colors"><span class="material-symbols-outlined text-[16px]">delete</span></button></div>`;
    globalList.innerHTML = globalLabels.length === 0 ? '<p class="text-xs text-gray-400 py-2">No global labels</p>' : globalLabels.map(renderLabel).join('');
    boardList.innerHTML = boardLabels.length === 0 ? '<p class="text-xs text-gray-400 py-2">No board labels</p>' : boardLabels.map(renderLabel).join('');
}

async function createLabel(): Promise<void> {
    const nameInput = document.getElementById('labelNameInput') as HTMLInputElement;
    const colorInput = document.getElementById('labelColorInput') as HTMLInputElement;
    const scopeSelect = document.getElementById('labelScopeSelect') as HTMLSelectElement;
    const name = nameInput.value.trim(), color = colorInput.value, scope = scopeSelect.value;
    if (!name) { showToast(elements.toastContainer, 'Label name is required', 'error'); nameInput.focus(); return; }
    try {
        const url = scope === 'global' ? `${API_URL}/api/workspaces/${activeWorkspaceId}/labels` : `${API_URL}/api/boards/${activeBoardId}/labels`;
        if (scope !== 'global' && !activeBoardId) { showToast(elements.toastContainer, 'No board selected', 'error'); return; }
        const response = await authFetch(url, { method: 'POST', body: JSON.stringify({ name, color }) });
        if (!response?.ok) throw new Error('Failed to create label');
        const newLabel = await response.json() as Label;
        if (scope === 'global') globalLabels.push(newLabel); else boardLabels.push(newLabel);
        labels = [...globalLabels, ...boardLabels];
        nameInput.value = ''; colorInput.value = '#93c5fd';
        renderLabelLists(); showToast(elements.toastContainer, 'Label created successfully', 'success');
    } catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to create label', 'error'); }
}

async function deleteLabel(labelId: string): Promise<void> {
    if (!confirm('Delete this label? It will be removed from all tasks.')) return;
    try {
        const response = await authFetch(`${API_URL}/api/labels/${labelId}`, { method: 'DELETE' });
        if (!response?.ok) throw new Error('Failed to delete label');
        globalLabels = globalLabels.filter(l => l.id !== labelId);
        boardLabels = boardLabels.filter(l => l.id !== labelId);
        labels = [...globalLabels, ...boardLabels];
        renderLabelLists(); showToast(elements.toastContainer, 'Label deleted successfully', 'success');
        if (currentEditingTask) populateTaskPanelLabels(currentEditingTask);
    } catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to delete label', 'error'); }
}

function populateTaskPanelLabels(task: Task): void {
    const container = elements.panelLabelSelect;
    if (!container) return;
    container.innerHTML = '';
    if (labels.length === 0) { container.innerHTML = '<p class="text-xs text-gray-400 py-2 text-center">No labels available. Create labels first.</p>'; return; }
    const taskLabelIds = task.labels ? task.labels.map(l => l.id) : [];
    labels.forEach(label => {
        const labelEl = document.createElement('label');
        labelEl.className = 'flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors';
        labelEl.innerHTML = `<input type="checkbox" value="${label.id}" ${taskLabelIds.includes(label.id) ? 'checked' : ''} class="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary"><span class="w-3 h-3 rounded" style="background-color: ${label.color || '#93c5fd'}"></span><span class="text-sm text-[#111418] dark:text-white flex-1">${escapeHtml(label.name)}</span>`;
        container.appendChild(labelEl);
    });
}

function getSelectedLabelIds(): string[] {
    const container = elements.panelLabelSelect;
    if (!container) return [];
    return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')).map(cb => cb.value);
}

// ===== Board Management =====
async function loadBoards(): Promise<void> {
    await loadBoardsService({ activeWorkspaceId, authFetch, API_URL, setBoards: (v: Board[]) => { boards = v; }, getActiveBoardId: () => activeBoardId, setActiveBoardId: (v: string | null) => { activeBoardId = v; }, renderBoardList, showToast: st });
}

function renderBoardList(): void {
    boards.sort((a, b) => (a.position || 0) - (b.position || 0));
    const isCollapsed = elements.sidebar!.classList.contains('collapsed');
    let displayBoards = boards, overflowBoards: Board[] = [];
    if (isCollapsed) {
        const maxVisible = Math.max(1, Math.floor((elements.boardList as HTMLElement).clientHeight / 42) - 1);
        if (boards.length > maxVisible + 1) { displayBoards = boards.slice(0, maxVisible); overflowBoards = boards.slice(maxVisible); }
    } else {
        const popout = document.getElementById('boardsPopout');
        if (popout) popout.style.display = 'none';
    }
    if (boards.length === 0) { (elements.boardList as HTMLElement).innerHTML = '<div class="board-list-empty px-3 py-4 text-center text-xs text-[#8a98a8]">No boards yet</div>'; return; }
    const renderItem = (board: Board, isOverflow = false) => {
        const isActive = board.id === activeBoardId, isDraggable = !isCollapsed && !isOverflow;
        return `<div class="flex items-center gap-1 group/board board-item ${isDraggable ? 'cursor-move' : ''}" data-board-id="${board.id}" ${isDraggable ? 'draggable="true"' : ''}><a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg flex-1 sidebar-item ${isActive ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white' : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936]'} transition-colors" data-action="switch-board" data-board-id="${board.id}" data-sidebar-tooltip="${escapeHtml(board.name)}"><span class="material-symbols-outlined flex-shrink-0" style="color: ${board.icon_color || '#3b82f6'}">${escapeHtml(normalizeBoardIcon(board.icon))}</span><span class="text-sm font-medium truncate sidebar-text">${escapeHtml(board.name)}</span></a><button data-action="delete-board" data-board-id="${board.id}" data-board-name="${escapeHtml(board.name)}" class="opacity-0 group-hover/board:opacity-100 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#8a98a8] hover:text-red-600 transition-all sidebar-text" title="Delete board"><span class="material-symbols-outlined text-[16px]">delete</span></button></div>`;
    };
    let html = displayBoards.map(b => renderItem(b)).join('');
    if (overflowBoards.length > 0) {
        html += `<div class="flex items-center justify-center py-1 mt-1"><button id="boardsMoreBtn" class="flex items-center justify-center size-8 rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-[#5c6b7f] transition-colors" data-action="toggle-boards-popout" data-sidebar-tooltip="More Boards"><span class="material-symbols-outlined">more_horiz</span></button></div>`;
        const popout = document.getElementById('boardsPopout');
        if (popout) popout.innerHTML = overflowBoards.map(b => renderItem(b, true)).join('');
    }
    (elements.boardList as HTMLElement).innerHTML = html;
    if (!isCollapsed) setupBoardDragAndDrop();
}

let draggedBoardItem: HTMLElement | null = null;
function setupBoardDragAndDrop(): void {
    (elements.boardList as HTMLElement).querySelectorAll<HTMLElement>('.board-item[draggable="true"]').forEach(item => {
        item.addEventListener('dragstart', function (this: HTMLElement, e: DragEvent) { draggedBoardItem = this; e.dataTransfer!.effectAllowed = 'move'; this.classList.add('dragging'); });
        item.addEventListener('dragover', function (this: HTMLElement, e: DragEvent) { e.preventDefault(); if (this === draggedBoardItem) return; this.classList.remove('drag-over-top', 'drag-over-bottom'); const r = this.getBoundingClientRect(); this.classList.add(e.clientY < r.top + r.height / 2 ? 'drag-over-top' : 'drag-over-bottom'); });
        item.addEventListener('dragleave', function (this: HTMLElement) { this.classList.remove('drag-over-top', 'drag-over-bottom'); });
        item.addEventListener('drop', async function (this: HTMLElement, e: DragEvent) {
            e.preventDefault(); this.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
            if (!draggedBoardItem || this === draggedBoardItem) return;
            const [movedBoard] = boards.splice(boards.findIndex(b => b.id === draggedBoardItem!.dataset.boardId), 1);
            const targetId = this.dataset.boardId, r = this.getBoundingClientRect();
            const ti = boards.findIndex(b => b.id === targetId);
            boards.splice(e.clientY >= r.top + r.height / 2 ? ti + 1 : ti, 0, movedBoard);
            boards.forEach((b, i) => { b.position = i; });
            renderBoardList();
            try { await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/boards/reorder`, { method: 'POST', body: JSON.stringify(boards.map((b, i) => ({ id: b.id, position: i }))) }); } catch (e) { console.error(e); }
        });
        item.addEventListener('dragend', function (this: HTMLElement) { this.classList.remove('dragging'); document.querySelectorAll('.board-item').forEach(i => i.classList.remove('drag-over-top', 'drag-over-bottom')); draggedBoardItem = null; });
    });
}

function toggleBoardsPopout(e: Event): void {
    e.stopPropagation();
    const popout = document.getElementById('boardsPopout'); if (!popout) return;
    if (popout.style.display === 'block') { popout.style.display = 'none'; return; }
    const btn = document.getElementById('boardsMoreBtn');
    if (btn) { const r = btn.getBoundingClientRect(); let top = r.top; const ph = popout.offsetHeight || 200; if (top + ph > window.innerHeight - 20) top = window.innerHeight - ph - 20; popout.style.top = `${top}px`; }
    popout.style.display = 'block';
}
window.addEventListener('click', (e) => { const p = document.getElementById('boardsPopout'); if (p?.style.display === 'block' && !p.contains(e.target as Node)) p.style.display = 'none'; });

const st = (m: string, t: 'info' | 'success' | 'error' = 'info') => showToast(elements.toastContainer, m, t);

async function createBoard(name: string, icon = 'dashboard', iconColor = '#3b82f6'): Promise<void> {
    await createBoardService({ activeWorkspaceId, normalizeBoardIcon, authFetch, API_URL, setActiveBoardId: (v: string | null) => { activeBoardId = v; }, loadBoards, renderBoardList, loadColumns, loadTasks, loadActivities, loadLabels, switchView, showToast: st, hideCreateBoardModal }, name, icon, iconColor);
}
async function deleteBoard(boardId: string): Promise<void> {
    await deleteBoardService({ authFetch, API_URL, getBoards: () => boards, setBoards: (v: Board[]) => { boards = v; }, getActiveBoardId: () => activeBoardId, closeTaskPanel, switchBoard, getWebsocket: () => websocket, setWebsocket: (v: WebSocket | null) => { websocket = v; }, setActiveBoardId: (v: string | null) => { activeBoardId = v; }, setTasks: (v: unknown[]) => { tasks = v as Task[]; }, setColumns: (v: unknown[]) => { columns = v as Column[]; }, setKafkaConnected: (v: boolean) => { kafkaConnected = v; }, updateKafkaStatusUI, renderBoard, renderBoardList, showToast: st, hideDeleteBoardModal }, boardId);
}
function showDeleteBoardModal(boardId: string, boardName: string): void { showDeleteBoardModalService({ elements, setBoardToDeleteId: (v: string | null) => { boardToDeleteId = v; } }, boardId, boardName); }
function hideDeleteBoardModal(): void { hideDeleteBoardModalService({ elements, setBoardToDeleteId: (v: string | null) => { boardToDeleteId = v; } }); }
function switchBoard(boardId: string): void { switchBoardService({ getActiveBoardId: () => activeBoardId, setActiveBoardId: (v: string | null) => { activeBoardId = v; }, renderBoardList, loadColumns, loadTasks, loadActivities, loadLabels, switchView }, boardId); }
function showCreateBoardModal(): void { showCreateBoardModalService({ elements }); }
function hideCreateBoardModal(): void { hideCreateBoardModalService({ elements }); }
function showBoardContextMenu(e: MouseEvent, boardId: string): void {
    e.preventDefault(); e.stopPropagation(); currentContextBoardId = boardId;
    const menu = elements.boardContextMenu as HTMLElement;
    menu.style.display = 'block'; menu.classList.remove('hidden');
    let x = e.pageX, y = e.pageY;
    if (x + 192 > window.innerWidth + window.scrollX) x = window.innerWidth + window.scrollX - 202;
    if (y + (menu.offsetHeight || 100) > window.innerHeight + window.scrollY) y = window.innerHeight + window.scrollY - (menu.offsetHeight || 100) - 10;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
}
function hideBoardContextMenu(): void { if (elements.boardContextMenu) { (elements.boardContextMenu as HTMLElement).style.display = 'none'; elements.boardContextMenu.classList.add('hidden'); } currentContextBoardId = null; }
function showEditBoardModal(boardId: string): void { showEditBoardModalService({ elements, getBoards: () => boards, normalizeBoardIcon }, boardId); }
function hideEditBoardModal(): void { hideEditBoardModalService({ elements }); }
async function updateBoard(boardId: string, data: Record<string, unknown>): Promise<void> { await updateBoardService({ authFetch, API_URL, getBoards: () => boards, setBoards: (v: Board[]) => { boards = v; }, renderBoardList, getActiveBoardId: () => activeBoardId, renderBoard, showToast: st }, boardId, data); }
async function loadWorkspaceMembers(): Promise<void> { if (!activeWorkspaceId) return; try { const r = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members`); if (!r) return; workspaceMembers = await r.json() as WorkspaceMember[]; } catch (e) { console.error(e); } }

// ===== Task Card =====
function createTaskCard(task: Task): HTMLElement {
    const card = document.createElement('div');
    const isDone = task.status === 'done';
    card.className = `task-card group flex flex-col gap-2 p-3 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 shadow-sm cursor-pointer transition-all ${isDone ? 'opacity-60 hover:opacity-100' : ''}`;
    card.id = task.id; card.draggable = true; card.dataset.taskId = task.id;
    const pbc: Record<string, string> = { low: '#22c55e', medium: '#f97316', high: '#ef4444' };
    card.style.borderLeftWidth = '4px'; card.style.borderLeftColor = pbc[task.priority] || pbc.medium;
    let labelsHTML = '';
    if (task.labels?.length) { labelsHTML = task.labels.map(l => `<span class="inline-flex items-center flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white" style="background-color: ${l.color || '#93c5fd'}">${escapeHtml(l.name)}</span>`).join(''); }
    else if (task.label) { const label = task.label as string; const ls = labelColors[label] || labelColors.frontend; labelsHTML = `<span class="inline-flex items-center rounded-md ${ls.bg} px-1.5 py-0.5 text-xs font-medium ${ls.text} ring-1 ring-inset ${ls.ring} capitalize">${label}</span>`; }
    const assignee = task.assignee_id ? workspaceMembers.find(m => m.id === task.assignee_id) : null;
    const initials = assignee ? (assignee.full_name || assignee.email || '').split(/[\s@]+/).filter(Boolean).slice(0, 2).map((p: string) => p[0].toUpperCase()).join('') : '';
    // Image thumbnail strip
    let imagesHTML = '';
    if (task.images?.length) {
        const visible = task.images.slice(0, 3);
        const overflow = task.images.length - visible.length;
        imagesHTML = `<div class="flex gap-1 mt-2">${visible.map(url => `<div class="w-12 h-12 rounded-md overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0"><img src="${url}" class="card-thumb w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" draggable="false"></div>`).join('')}${overflow > 0 ? `<div class="w-12 h-12 rounded-md bg-[#eff1f3] dark:bg-[#1e2936] border border-[#e5e7eb] dark:border-[#1e2936] flex-shrink-0 flex items-center justify-center text-xs font-semibold text-[#5c6b7f] dark:text-gray-400">+${overflow}</div>` : ''}</div>`;
    }
    card.innerHTML = `<div class="flex justify-between items-start gap-2"><span class="text-sm font-medium text-[#111418] dark:text-gray-200 leading-snug ${isDone ? 'line-through decoration-gray-400' : ''}">${escapeHtml(task.title)}</span>${task.due_date ? `<span class="text-[10px] text-[#5c6b7f] dark:text-gray-400 flex-shrink-0">${formatDate(task.due_date)}</span>` : ''}</div>${task.description ? `<p class="text-xs text-[#5c6b7f] dark:text-gray-400 line-clamp-2 mt-1">${escapeHtml(task.description)}</p>` : ''}${imagesHTML}<div class="mt-1 flex items-center justify-between gap-2"><div class="relative flex items-center min-h-[24px] flex-1 overflow-hidden"><div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button class="task-comment-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded" title="Add comment"><span class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary">comment</span></button><button class="task-image-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded" title="Add image"><span class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary">add_photo_alternate</span></button></div><div class="task-labels-row absolute left-0 right-0 overflow-hidden transition-all duration-200 group-hover:translate-x-16 group-hover:opacity-0"><div class="task-labels-inner flex gap-1 items-center">${labelsHTML}</div></div></div>${assignee ? `<div class="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold" title="${escapeHtml(assignee.full_name || assignee.email || '')}">${initials}</div>` : ''}</div>`;
    card.querySelector('.task-comment-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openTaskPanel(task, true); });
    card.querySelector('.task-image-btn')?.addEventListener('click', (e) => { e.stopPropagation(); openTaskPanel(task); setTimeout(() => (elements.panelImageUpload as HTMLInputElement)?.click(), 300); });
    // Thumbnail click → open image modal (no task panel)
    if (task.images?.length) {
        card.querySelectorAll<HTMLImageElement>('.card-thumb').forEach((img, i) => {
            img.addEventListener('click', (e) => { e.stopPropagation(); openImageModal(task.images![i]); });
        });
    }
    card.addEventListener('click', () => { if (!card.classList.contains('dragging')) openTaskPanel(task); });
    card.addEventListener('contextmenu', (e) => { if (!card.classList.contains('dragging')) showTaskContextMenu(e as MouseEvent, task); });
    card.addEventListener('dragstart', (e) => handleDragStart(e as DragEvent));
    card.addEventListener('dragend', () => handleDragEnd());
    return card;
}

// ===== Inline Add =====
function showInlineAddForm(columnId: string): void {
    hideInlineAddForm();
    const column = document.querySelector<HTMLElement>(`.column[data-column-id="${columnId}"]`); if (!column) return;
    const formContainer = column.querySelector<HTMLElement>('.inline-add-form')!, addBtn = column.querySelector<HTMLElement>('.add-card-btn')!;
    const labelCBs = labels.length === 0 ? '<p class="text-xs text-gray-400 py-2 text-center">No labels available</p>' : labels.map(l => `<label class="flex items-center gap-2 cursor-pointer hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] px-2 py-1.5 rounded transition-colors"><input type="checkbox" value="${l.id}" class="inline-label-checkbox rounded border-gray-300 w-3.5 h-3.5"><span class="w-3 h-3 rounded" style="background-color: ${l.color || '#93c5fd'}"></span><span class="text-xs text-[#111418] dark:text-white">${escapeHtml(l.name)}</span></label>`).join('');
    formContainer.innerHTML = `<div class="flex flex-col gap-3 p-4 bg-white dark:bg-[#151e29] rounded-lg border-2 border-primary ring-4 ring-primary/20 shadow-xl mb-3 min-w-[320px]"><input type="text" class="inline-title-input w-full text-sm font-semibold text-[#111418] dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400" placeholder="Task title..." autofocus><textarea class="inline-description-input w-full text-xs text-[#5c6b7f] dark:text-gray-300 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder-gray-400 custom-scrollbar" rows="2" placeholder="Add a description (optional)..."></textarea><div class="flex gap-3"><div class="flex-shrink-0"><label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Priority</label><select class="inline-priority-select text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 focus:ring-2 focus:ring-primary/50 focus:outline-none"><option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option></select></div><div class="flex-1 min-w-0"><label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Labels</label><div class="inline-label-container flex flex-col gap-0.5 p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg max-h-[140px] overflow-y-auto custom-scrollbar">${labelCBs}</div></div></div><div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e7eb] dark:border-[#1e2936]"><button class="inline-cancel-btn text-xs text-[#5c6b7f] hover:text-[#111418] px-3 py-2 rounded-lg hover:bg-[#eff1f3] transition-colors">Cancel</button><button class="inline-create-btn flex items-center gap-1.5 bg-primary hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors"><span class="material-symbols-outlined text-[16px]">add</span>Create Task</button></div></div>`;
    formContainer.classList.remove('hidden'); addBtn.classList.add('hidden');
    const titleInput = formContainer.querySelector<HTMLInputElement>('.inline-title-input')!, descInput = formContainer.querySelector<HTMLTextAreaElement>('.inline-description-input')!, prioritySel = formContainer.querySelector<HTMLSelectElement>('.inline-priority-select')!, labelInputs = formContainer.querySelectorAll<HTMLInputElement>('.inline-label-checkbox');
    activeInlineForm = { columnId, formContainer, addBtn };
    setTimeout(() => titleInput.focus(), 50);
    formContainer.querySelector('.inline-cancel-btn')?.addEventListener('click', hideInlineAddForm);
    const doCreate = () => { const t = titleInput.value.trim(); if (t) { addTaskToColumn(t, descInput.value.trim(), prioritySel.value, columnId, Array.from(labelInputs).filter(cb => cb.checked).map(cb => cb.value)); hideInlineAddForm(); } };
    formContainer.querySelector('.inline-create-btn')?.addEventListener('click', doCreate);
    titleInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); descInput.focus(); } else if (e.key === 'Escape') hideInlineAddForm(); });
    descInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideInlineAddForm(); });
}
function hideInlineAddForm(): void { if (activeInlineForm) { activeInlineForm.formContainer.classList.add('hidden'); activeInlineForm.formContainer.innerHTML = ''; activeInlineForm.addBtn.classList.remove('hidden'); activeInlineForm = null; } }

// ===== Task Panel =====
function openTaskPanel(task: Task, focusOnComments = false): void {
    currentEditingTask = task;
    (elements.panelTaskId as HTMLElement).textContent = task.id;
    (elements.panelTaskStatus as HTMLElement).textContent = columns.find(c => c.id === task.column_id)?.title || 'Unknown';
    (elements.panelTitle as HTMLInputElement).value = task.title;
    (elements.panelDescription as HTMLTextAreaElement).value = task.description || '';
    (elements.panelPrioritySelect as HTMLSelectElement).value = task.priority;
    populateTaskPanelLabels(task);
    const panelStatus = elements.panelStatusSelect as HTMLSelectElement;
    panelStatus.innerHTML = '';
    columns.forEach(col => { const o = document.createElement('option'); o.value = col.id; o.textContent = col.title; panelStatus.appendChild(o); });
    panelStatus.value = task.column_id || '';
    const panelDue = elements.panelDueDate as HTMLInputElement;
    panelDue.setAttribute('min', new Date().toISOString().split('T')[0]);
    if (task.due_date) { panelDue.value = new Date(task.due_date).toISOString().split('T')[0]; panelDue.type = 'date'; } else { panelDue.value = ''; panelDue.type = 'text'; }
    const panelAssignee = elements.panelAssigneeSelect as HTMLSelectElement;
    panelAssignee.innerHTML = '<option value="">Unassigned</option>';
    workspaceMembers.forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.full_name || m.email; panelAssignee.appendChild(o); });
    panelAssignee.value = task.assignee_id || '';
    renderTaskImages(task.images || []);
    loadComments(task.id);
    (elements.commentInput as HTMLTextAreaElement).value = ''; currentCommentImages = []; renderCommentImages();
    renderEventLog(task);
    elements.taskPanel!.classList.remove('hidden');
    setTimeout(() => { elements.panelContent!.classList.remove('translate-x-full'); if (focusOnComments) setTimeout(() => { elements.commentInput?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => (elements.commentInput as HTMLElement)?.focus(), 300); }, 200); }, 10);
}
function closeTaskPanel(): void { elements.panelContent!.classList.add('translate-x-full'); setTimeout(() => { elements.taskPanel!.classList.add('hidden'); currentEditingTask = null; }, 150); }

// ===== Images =====
function renderTaskImages(images: string[]): void {
    if (!images?.length) { (elements.panelImagesContainer as HTMLElement).innerHTML = '<div class="col-span-3 text-xs text-[#8a98a8] p-2">No images added yet</div>'; return; }
    (elements.panelImagesContainer as HTMLElement).innerHTML = images.map((url, i) => `<div class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800"><img src="${url}" alt="Task image ${i + 1}" class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" data-action="open-image-modal" data-image-url="${url}"><button type="button" class="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity" data-action="remove-task-image" data-image-index="${i}"><span class="material-symbols-outlined text-[16px]">close</span></button></div>`).join('');
}
async function uploadTaskImage(file: File): Promise<string | null> {
    const fd = new FormData(); fd.append('file', file);
    (elements.imageUploadStatus as HTMLElement).textContent = 'Uploading...'; (elements.imageUploadStatus as HTMLElement).classList.remove('hidden');
    try { const r = await fetch(`${API_URL}/api/upload-image`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: fd }); if (!r.ok) throw new Error('Upload failed'); const d = await r.json() as { url: string }; (elements.imageUploadStatus as HTMLElement).classList.add('hidden'); return d.url; }
    catch (e) { console.error(e); (elements.imageUploadStatus as HTMLElement).textContent = 'Upload failed'; setTimeout(() => (elements.imageUploadStatus as HTMLElement).classList.add('hidden'), 3000); showToast(elements.toastContainer, 'Failed to upload image', 'error'); return null; }
}
function removeTaskImage(index: number): void { if (!currentEditingTask?.images) return; currentEditingTask.images.splice(index, 1); renderTaskImages(currentEditingTask.images); }
function openImageModal(url: string): void {
    const modal = document.createElement('div'); modal.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm';
    modal.innerHTML = `<div class="relative max-w-4xl max-h-[90vh] p-4"><img src="${url}" alt="Full size image" class="max-w-full max-h-full object-contain rounded-lg"><button class="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"><span class="material-symbols-outlined">close</span></button></div>`;
    modal.addEventListener('click', (e) => { if (e.target === modal || (e.target as Element).closest('button')) document.body.removeChild(modal); });
    document.body.appendChild(modal);
}

// ===== Comments =====
async function loadComments(taskId: string): Promise<void> { try { const r = await authFetch(`${API_URL}/api/tasks/${taskId}/comments`); if (!r) return; renderComments(await r.json()); } catch (e) { console.error(e); } }
function renderComments(comments: TaskComment[]): void {
    if (!comments?.length) { (elements.commentsContainer as HTMLElement).innerHTML = '<div class="text-xs text-[#8a98a8] text-center py-4">No comments yet. Be the first to comment!</div>'; return; }
    (elements.commentsContainer as HTMLElement).innerHTML = comments.map(c => {
        const d = new Date(c.created_at);
        const imgsHtml = c.images?.length ? `<div class="grid grid-cols-3 gap-2 mt-2">${c.images.map((url: string) => `<div class="aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936]"><img src="${url}" class="w-full h-full object-cover cursor-pointer hover:opacity-90" data-action="open-image-modal" data-image-url="${url}"></div>`).join('')}</div>` : '';
        const isOwner = currentUser && c.user_id === currentUser.id;
        return `<div class="bg-white dark:bg-[#151e29] rounded-lg p-4 border border-[#e5e7eb] dark:border-[#1e2936]"><div class="flex items-start justify-between mb-2"><div class="flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-sm font-semibold">${c.user_id ? String(c.user_id).substring(0, 2).toUpperCase() : 'U'}</div><div><div class="text-sm font-medium text-[#111418] dark:text-white">User</div><div class="text-xs text-[#5c6b7f] dark:text-gray-400">${formatDateWithYear(c.timestamp)} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div></div></div>${isOwner ? `<button data-action="delete-comment" data-comment-id="${c.id}" class="p-1 text-[#5c6b7f] hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"><span class="material-symbols-outlined text-[18px]">delete</span></button>` : ''}</div><div class="text-sm text-[#111418] dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(c.content)}</div>${imgsHtml}</div>`;
    }).join('');
}
async function postComment(): Promise<void> {
    if (!currentEditingTask) return;
    const content = (elements.commentInput as HTMLTextAreaElement).value.trim();
    if (!content && !currentCommentImages.length) { showToast(elements.toastContainer, 'Comment cannot be empty', 'error'); return; }
    try { const r = await authFetch(`${API_URL}/api/tasks/${currentEditingTask.id}/comments`, { method: 'POST', body: JSON.stringify({ content, images: currentCommentImages }) }); if (!r) return; (elements.commentInput as HTMLTextAreaElement).value = ''; currentCommentImages = []; (elements.commentImagesContainer as HTMLElement).innerHTML = ''; (elements.commentImagesContainer as HTMLElement).classList.add('hidden'); await loadComments(currentEditingTask.id); showToast(elements.toastContainer, 'Comment added', 'success'); }
    catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to post comment', 'error'); }
}
async function deleteComment(commentId: string): Promise<void> {
    if (!confirm('Delete this comment?')) return;
    try { const r = await authFetch(`${API_URL}/api/comments/${commentId}`, { method: 'DELETE' }); if (!r) return; if (currentEditingTask) await loadComments(currentEditingTask.id); showToast(elements.toastContainer, 'Comment deleted', 'success'); }
    catch (e) { console.error(e); showToast(elements.toastContainer, 'Failed to delete comment', 'error'); }
}
async function uploadCommentImage(file: File): Promise<string | null> {
    (elements.commentImageStatus as HTMLElement).textContent = 'Uploading...'; (elements.commentImageStatus as HTMLElement).classList.remove('hidden');
    try { const url = await uploadTaskImage(file); (elements.commentImageStatus as HTMLElement).classList.add('hidden'); return url; }
    catch (e) { (elements.commentImageStatus as HTMLElement).textContent = 'Upload failed'; setTimeout(() => (elements.commentImageStatus as HTMLElement).classList.add('hidden'), 3000); return null; }
}
function renderCommentImages(): void {
    if (!currentCommentImages.length) { (elements.commentImagesContainer as HTMLElement).innerHTML = ''; (elements.commentImagesContainer as HTMLElement).classList.add('hidden'); return; }
    (elements.commentImagesContainer as HTMLElement).classList.remove('hidden');
    (elements.commentImagesContainer as HTMLElement).innerHTML = currentCommentImages.map((url, i) => `<div class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936]"><img src="${url}" class="w-full h-full object-cover"><button type="button" class="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity" data-action="remove-comment-image" data-image-index="${i}"><span class="material-symbols-outlined text-[14px]">close</span></button></div>`).join('');
}
function removeCommentImage(index: number): void { currentCommentImages.splice(index, 1); renderCommentImages(); }

function saveTaskFromPanel(): void { saveTaskFromPanelService({ getCurrentEditingTask: () => currentEditingTask, elements, columns, getSelectedLabelIds, showToast: st, updateTask, closeTaskPanel }); }
function renderEventLog(task: Task): void {
    const evts = globalEvents.filter(e => e.originalTaskId === task.id || e.taskId === task.id);
    if (!evts.length) { (elements.panelEventLog as HTMLElement).innerHTML = '<div class="px-4 py-3 text-center text-gray-400 text-xs">No Kafka events recorded for this task</div>'; return; }
    (elements.panelEventLog as HTMLElement).innerHTML = evts.slice(0, 5).map(e => `<div class="px-4 py-3 border-b border-[#e5e7eb] dark:border-[#1e2936] flex gap-4"><span class="text-[#94a3b8] shrink-0 w-20">${e.time}</span><div class="flex-1 overflow-hidden"><div class="text-blue-600 dark:text-blue-400 font-bold mb-1">${escapeHtml(e.type)}</div><span class="text-[#334155] dark:text-gray-400 block truncate">${e.type === 'TASK_CREATED' ? 'Task created' : formatEventData(e.data)}</span></div></div>`).join('');
}

// ===== Task CRUD =====
async function addTask(title: string, description: string, priority: string, status: string, labelIds: string[] = []): Promise<void> { await addTaskService({ activeBoardId, authFetch, API_URL, tasks, setTasks: (v: Task[]) => { tasks = v; }, renderBoard, notifyKafkaEvent, elements, renderActivityLog, showToast: st }, title, description, priority, status, labelIds); }
async function addTaskToColumn(title: string, description: string, priority: string, columnId: string, labelIds: string[] = []): Promise<void> { await addTaskToColumnService({ activeBoardId, authFetch, API_URL, tasks, setTasks: (v: Task[]) => { tasks = v; }, renderBoard, notifyKafkaEvent, elements, renderActivityLog, showToast: st }, title, description, priority, columnId, labelIds); }
async function updateTask(id: string, updates: Partial<Task>): Promise<void> { await updateTaskService({ authFetch, API_URL, tasks, setTasks: (v: Task[]) => { tasks = v; }, renderBoard, elements, renderActivityLog, notifyKafkaEvent, showToast: st }, id, updates); }
function showDeleteModal(task: Task): void { showDeleteModalService({ elements, setTaskToDeleteId: (v: string | null) => { taskToDeleteId = v; } }, task); }
function hideDeleteModal(): void { hideDeleteModalService({ elements, setTaskToDeleteId: (v: string | null) => { taskToDeleteId = v; } }); }
async function deleteTask(id: string): Promise<void> { await deleteTaskService({ tasks, setTasks: (v: Task[]) => { tasks = v; }, authFetch, API_URL, renderBoard, elements, renderActivityLog, closeTaskPanel, notifyKafkaEvent, showToast: st }, id); }

// ===== Kafka =====
async function sendKafkaEvent(eventType: string, taskId: string, data: Record<string, unknown> = {}): Promise<void> { await sendKafkaEventService({ sendKafkaEventRequest, API_URL, setKafkaConnected: (v: boolean) => { kafkaConnected = v; }, updateKafkaStatusUI }, eventType, taskId, data); }
function connectWebSocket(): void { connectWebSocketService({ getActiveBoardId: () => activeBoardId, getWsUrl, setWebsocket: (v: WebSocket | null) => { websocket = v; }, setKafkaConnected: (v: boolean) => { kafkaConnected = v; }, updateKafkaStatusUI, handleIncomingKafkaEvent, reconnect: connectWebSocket }); }
function handleIncomingKafkaEvent(kafkaEvent: Record<string, unknown>): void { handleIncomingKafkaEventService({ globalEvents, renderActivityLog, elements, currentUser, isDragInProgress: dragDropState.isDragInProgress, loadColumns, loadTasks, currentEditingTask, loadComments }, kafkaEvent); }
function updateKafkaStatusUI(): void { /* visual only */ }
function notifyKafkaEvent(message: string, type: 'info' | 'success' | 'error' = 'info'): void { notifyKafkaEventService({ showKafkaEvent, elements, updateKafkaStatusUI }, message, type); }

// ===== Drag and Drop =====
const dragDropState = { draggedTask: null as HTMLElement | null, draggedTaskId: null as string | null, isDragging: false, isDragInProgress: false, draggedColumn: null as HTMLElement | null };
const COLUMN_DRAG_KEY = 'application/x-column-id';
function handleDragStart(e: DragEvent): void { handleDragStartService({ state: dragDropState, TASK_DRAG_KEY }, e); }
function handleDragEnd(): void { handleDragEndService(dragDropState); }
function handleDragOver(e: DragEvent): void { handleDragOverService({ state: dragDropState }, e); }
function handleDragEnter(e: DragEvent): void { handleDragEnterService({ state: dragDropState }, e); }
function handleDragLeave(e: DragEvent): void { handleDragLeaveService({ state: dragDropState }, e); }
function handleDrop(e: DragEvent): void { handleDropService({ state: dragDropState, TASK_DRAG_KEY, tasks, setTasks: (v: Task[]) => { tasks = v; }, renderBoard, persistTaskDrop, notifyKafkaEvent }, e); }
async function persistTaskDrop(taskId: string, updates: Partial<Task>): Promise<void> { await persistTaskDropService({ authFetch, API_URL, tasks, setTasks: (v: Task[]) => { tasks = v; }, elements, renderActivityLog, notifyKafkaEvent, showToast: st }, taskId, updates); }
function handleColumnDragStart(e: DragEvent): void { handleColumnDragStartService({ state: dragDropState, COLUMN_DRAG_KEY }, e); }
function handleColumnDragEnd(): void { handleColumnDragEndService(dragDropState); }
function handleColumnDragOver(e: DragEvent): void { handleColumnDragOverService({ state: dragDropState }, e); }
function handleColumnDrop(e: DragEvent): void { handleColumnDropService({ state: dragDropState, columns, setColumns: (v: Column[]) => { columns = v; }, updateColumnPositions, renderBoard, showToast: st }, e); }

// ===== Context Menus =====
function showTaskContextMenu(e: MouseEvent, task: Task): void {
    e.preventDefault(); e.stopPropagation(); currentContextTask = task;
    if (elements.contextStatusOptions) {
        elements.contextStatusOptions.innerHTML = columns.map(col => `<button class="context-status-option w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left ${task.column_id === col.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" data-column-id="${col.id}"><span class="material-symbols-outlined text-[18px]">${task.column_id === col.id ? 'check' : 'arrow_forward'}</span>${escapeHtml(col.title)}</button>`).join('');
        document.querySelectorAll<HTMLButtonElement>('.context-status-option').forEach(btn => btn.addEventListener('click', () => { const cid = btn.dataset.columnId; if (currentContextTask && currentContextTask.column_id !== cid) updateTask(currentContextTask.id, { column_id: cid }); hideTaskContextMenu(); }));
    }
    const menu = elements.taskContextMenu as HTMLElement; menu.style.display = 'block'; menu.classList.remove('hidden');
    let x = e.pageX, y = e.pageY;
    if (x + 224 > window.innerWidth + window.scrollX) x = window.innerWidth + window.scrollX - 234;
    if (y + (menu.offsetHeight || 400) > window.innerHeight + window.scrollY) y = window.innerHeight + window.scrollY - (menu.offsetHeight || 400) - 10;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
}
function hideTaskContextMenu(): void { if (elements.taskContextMenu) { (elements.taskContextMenu as HTMLElement).style.display = 'none'; elements.taskContextMenu.classList.add('hidden'); } currentContextTask = null; }
function showColumnContextMenu(e: MouseEvent, columnId: string): void {
    e.preventDefault(); e.stopPropagation(); hideTaskContextMenu(); hideBoardContextMenu(); closeAllColumnMenus(); currentContextColumnId = columnId;
    const idx = columns.findIndex(c => c.id === columnId);
    if (elements.contextColumnMoveLeft) { (elements.contextColumnMoveLeft as HTMLButtonElement).disabled = idx <= 0; (elements.contextColumnMoveLeft as HTMLElement).style.opacity = idx <= 0 ? '0.4' : ''; }
    if (elements.contextColumnMoveRight) { const atEnd = idx >= columns.length - 1; (elements.contextColumnMoveRight as HTMLButtonElement).disabled = atEnd; (elements.contextColumnMoveRight as HTMLElement).style.opacity = atEnd ? '0.4' : ''; }
    const menu = elements.columnContextMenu as HTMLElement; menu.style.display = 'block'; menu.classList.remove('hidden');
    let x = e.pageX, y = e.pageY;
    if (x + 208 > window.innerWidth + window.scrollX) x = window.innerWidth + window.scrollX - 218;
    if (y + (menu.offsetHeight || 200) > window.innerHeight + window.scrollY) y = window.innerHeight + window.scrollY - (menu.offsetHeight || 200) - 10;
    menu.style.left = `${x}px`; menu.style.top = `${y}px`;
}
function hideColumnContextMenu(): void { if (elements.columnContextMenu) { (elements.columnContextMenu as HTMLElement).style.display = 'none'; elements.columnContextMenu.classList.add('hidden'); } currentContextColumnId = null; }

// ===== Theme & Sidebar =====
function initTheme(): void { const s = localStorage.getItem('kafka-kanban-theme'); if (s === 'dark' || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches)) { document.documentElement.classList.add('dark'); updateThemeUI(true); } }
function toggleTheme(): void { const d = document.documentElement.classList.toggle('dark'); localStorage.setItem('kafka-kanban-theme', d ? 'dark' : 'light'); updateThemeUI(d); }
function updateThemeUI(isDark: boolean): void { if (elements.themeIcon) elements.themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode'; if (elements.themeText) elements.themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode'; }
function toggleSidebar(): void { const c = elements.sidebar!.classList.toggle('collapsed'); localStorage.setItem('kafka-kanban-sidebar', c ? 'collapsed' : 'expanded'); renderBoardList(); }
function loadSidebarState(): void { if (localStorage.getItem('kafka-kanban-sidebar') === 'collapsed') elements.sidebar!.classList.add('collapsed'); }

// ===== Event Listener Binding =====
function initEventListeners(): void {
    bindBoardListeners({ elements, showCreateListModal, switchBoard, showDeleteBoardModal, toggleBoardsPopout, scrollToAddCard, moveColumnLeft, moveColumnRight, editColumnTitle, deleteColumn, openImageModal, removeTaskImage, deleteComment, removeCommentImage, deleteLabel, showBoardContextMenu, switchView, toggleTheme, toggleSidebar, openLabelManager, closeLabelManager, createLabel });
    bindTaskListeners({ elements, closeTaskPanel, saveTaskFromPanel, getCurrentEditingTask: () => currentEditingTask, showDeleteModal, showToast: st, uploadTaskImage, renderTaskImages, postComment, uploadCommentImage, getCurrentCommentImages: () => currentCommentImages, renderCommentImages, getTaskToDeleteId: () => taskToDeleteId, deleteTask, hideDeleteModal, getActiveInlineForm: () => activeInlineForm?.formContainer || null, hideInlineAddForm, closeAllColumnMenus, hideTaskContextMenu, hideBoardContextMenu, hideColumnContextMenu, getCurrentContextTask: () => currentContextTask, openTaskPanel, updateTask });
    bindModalListeners({ elements, showCreateBoardModal, hideCreateBoardModal, createBoard, hideCreateListModal, showCreateListModal, createColumn, hideEditBoardModal, updateBoard, getCurrentContextBoardId: () => currentContextBoardId, showEditBoardModal, hideBoardContextMenu, getBoards: () => boards, showDeleteBoardModal, hideColumnContextMenu, getCurrentContextColumnId: () => currentContextColumnId, scrollToAddCard, editColumnTitle, moveColumnLeft, moveColumnRight, deleteColumn, hideDeleteBoardModal, getBoardToDeleteId: () => boardToDeleteId, deleteBoard, hideDeleteListModal, hideTaskContextMenu, closeTaskPanel, hideDeleteModal, closeLabelManager, hideInlineAddForm });
}
function attachBoardEventListeners(): void {
    bindDragDropListeners({ showInlineAddForm, isTaskDragging: () => dragDropState.isDragging, isColumnDragging: () => Boolean(dragDropState.draggedColumn), handleDragOver, handleColumnDragOver, handleDragEnter, handleDragLeave, handleDrop, handleColumnDrop, showColumnContextMenu, handleColumnDragStart, handleColumnDragEnd });
}

// ===== Initialize =====
async function init(): Promise<void> {
    bindStaticDomEvents({ openLabelManager, closeLabelManager });
    initTheme(); loadSidebarState();
    if (!localStorage.getItem('access_token')) { window.location.href = '/login'; return; }
    // Auth confirmed — reveal the page now
    document.body.style.visibility = 'visible';
    try {
        const userRes = await authFetch(`${API_URL}/api/auth/me`); if (!userRes) return;
        currentUser = await userRes.json() as { id: string; full_name?: string };
        const wsRes = await authFetch(`${API_URL}/api/workspaces`);
        const workspaces = await wsRes!.json() as { id: string }[];
        if (workspaces.length > 0) activeWorkspaceId = workspaces[0].id;
        await loadWorkspaceMembers(); await loadBoards(); await loadLabels();
        if (activeBoardId) { await loadColumns().then(loadTasks); connectWebSocket(); } else { renderBoard(); }
        initEventListeners();
        window.addEventListener('resize', () => { if (elements.sidebar!.classList.contains('collapsed')) renderBoardList(); });
        console.log('Kafka Kanban Board initialized');
    } catch (e) { console.error('Initialization error:', e); }
}

export { init };
