/**
 * Kafka Kanban Board - Frontend Application
 * Superthread-style task management with inline creation and slide-out panel
 */

import {
    STORAGE_KEY,
    API_URL,
    getWsUrl,
    normalizeBoardIcon,
    columnColorClasses,
    labelColors,
    statusLabels,
    TASK_DRAG_KEY
} from './state.js';
import { authFetch, sendKafkaEventRequest } from './api.js';
import { escapeHtml, formatEventData, formatDate, showToast, showKafkaEvent } from './ui.js';
import { bindStaticDomEvents } from './dom-events.js';
import { bindBoardListeners } from './listeners/board.js';
import { bindTaskListeners } from './listeners/task.js';
import { bindModalListeners } from './listeners/modal.js';
import { bindDragDropListeners } from './listeners/dragdrop.js';
import {
    showCreateListModalService,
    hideCreateListModalService,
    createColumnService,
    showDeleteListModalService,
    hideDeleteListModalService,
    confirmDeleteListService
} from './services/modal-service.js';
import {
    loadBoardsService,
    createBoardService,
    deleteBoardService,
    showDeleteBoardModalService,
    hideDeleteBoardModalService,
    switchBoardService,
    showCreateBoardModalService,
    hideCreateBoardModalService,
    showEditBoardModalService,
    hideEditBoardModalService,
    updateBoardService
} from './services/board-service.js';
import {
    saveTaskFromPanelService,
    addTaskService,
    addTaskToColumnService,
    updateTaskService,
    showDeleteModalService,
    hideDeleteModalService,
    deleteTaskService
} from './services/task-service.js';
import {
    sendKafkaEventService,
    connectWebSocketService,
    handleIncomingKafkaEventService,
    notifyKafkaEventService
} from './services/realtime-service.js';
import {
    cleanupDragStateService,
    handleDragStartService,
    handleDragEndService,
    handleDragOverService,
    getDragAfterElementService,
    handleDragEnterService,
    handleDragLeaveService,
    handleDropService,
    persistTaskDropService,
    handleColumnDragStartService,
    handleColumnDragEndService,
    handleColumnDragOverService,
    handleColumnDropService
} from './services/dragdrop-service.js';

// ===== State Management =====
let tasks = [];
let globalEvents = [];
let currentUser = null;
let activeBoardId = null;
let currentEditingTask = null;
let activeInlineForm = null;
let websocket = null;
let kafkaConnected = false;

// ===== DOM Elements =====
const elements = {
    board: document.getElementById('board'),
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    themeToggle: document.getElementById('themeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    themeText: document.getElementById('themeText'),
    boardHeaderIcon: document.getElementById('boardHeaderIcon'),
    kafkaStatus: document.getElementById('kafkaStatus'),
    // Side Panel
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
    // Comments
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
    // Views
    boardView: document.getElementById('boardView'),
    activityView: document.getElementById('activityView'),
    activityLog: document.getElementById('activityLog'),
    myTasksView: document.getElementById('myTasksView'),
    myTasksList: document.getElementById('myTasksList'),
    myTasksCount: document.getElementById('myTasksCount'),
    // Navigation
    navBoard: document.getElementById('navBoard'),
    navActivity: document.getElementById('navActivity'),
    navMyTasks: document.getElementById('navMyTasks'),
    // Lists
    lists: {
        todo: document.getElementById('todo-list'),
        inprogress: document.getElementById('inprogress-list'),
        done: document.getElementById('done-list')
    },
    counts: {
        todo: document.getElementById('todo-count'),
        inprogress: document.getElementById('inprogress-count'),
        done: document.getElementById('done-count')
    },
    toastContainer: document.getElementById('toastContainer'),
    headerStats: document.getElementById('headerStats'),
    // Delete Modal
    deleteModal: document.getElementById('deleteModal'),
    deleteTaskTitle: document.getElementById('deleteTaskTitle'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    // Board Elements
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
    // Create List Modal
    createListModal: document.getElementById('createListModal'),
    newListTitle: document.getElementById('newListTitle'),
    cancelCreateListBtn: document.getElementById('cancelCreateListBtn'),
    confirmCreateListBtn: document.getElementById('confirmCreateListBtn'),
    // Delete Board Modal
    deleteBoardModal: document.getElementById('deleteBoardModal'),
    deleteBoardName: document.getElementById('deleteBoardName'),
    deleteBoardConfirmInput: document.getElementById('deleteBoardConfirmInput'),
    cancelDeleteBoardBtn: document.getElementById('cancelDeleteBoardBtn'),
    confirmDeleteBoardBtn: document.getElementById('confirmDeleteBoardBtn'),
    // Delete List Modal
    deleteListModal: document.getElementById('deleteListModal'),
    deleteListName: document.getElementById('deleteListName'),
    deleteListConfirmInput: document.getElementById('deleteListConfirmInput'),
    cancelDeleteListBtn: document.getElementById('cancelDeleteListBtn'),
    confirmDeleteListBtn: document.getElementById('confirmDeleteListBtn'),
    // Context Menu
    taskContextMenu: document.getElementById('taskContextMenu'),
    contextOpenTask: document.getElementById('contextOpenTask'),
    contextStatusOptions: document.getElementById('contextStatusOptions'),
    contextPriorityLow: document.getElementById('contextPriorityLow'),
    contextPriorityMedium: document.getElementById('contextPriorityMedium'),
    contextPriorityHigh: document.getElementById('contextPriorityHigh'),
    contextDeleteTask: document.getElementById('contextDeleteTask'),
    // Board Context Menu
    boardContextMenu: document.getElementById('boardContextMenu'),
    contextEditBoard: document.getElementById('contextEditBoard'),
    contextDeleteBoard: document.getElementById('contextDeleteBoard'),
    // Column Context Menu
    columnContextMenu: document.getElementById('columnContextMenu'),
    contextColumnAddTask: document.getElementById('contextColumnAddTask'),
    contextColumnRename: document.getElementById('contextColumnRename'),
    contextColumnMoveLeft: document.getElementById('contextColumnMoveLeft'),
    contextColumnMoveRight: document.getElementById('contextColumnMoveRight'),
    contextColumnDelete: document.getElementById('contextColumnDelete'),
    // Edit Board Modal
    editBoardModal: document.getElementById('editBoardModal'),
    editBoardName: document.getElementById('editBoardName'),
    editBoardIcon: document.getElementById('editBoardIcon'),
    editBoardIconColor: document.getElementById('editBoardIconColor'),
    editIconDropdownButton: document.getElementById('editIconDropdownButton'),
    editIconDropdownMenu: document.getElementById('editIconDropdownMenu'),
    editSelectedIconPreview: document.getElementById('editSelectedIconPreview'),
    cancelEditBoardBtn: document.getElementById('cancelEditBoardBtn'),
    confirmEditBoardBtn: document.getElementById('confirmEditBoardBtn')
};

let workspaceMembers = [];
let boards = [];
let columns = [];
let labels = [];
let activeWorkspaceId = null;
let taskToDeleteId = null;
let currentContextTask = null; // Track task for context menu
let currentContextColumnId = null; // Track column for context menu

// ===== Column Color Classes =====
// ===== Column Color Classes =====

// ===== Task Data Model =====
class Task {
    constructor(title, description = '', priority = 'medium', status = 'todo', label = 'frontend') {
        this.id = this.generateId();
        this.title = title;
        this.description = description;
        this.priority = priority;
        this.status = status;
        this.label = label;
        this.dueDate = '';
        this.createdAt = new Date().toISOString();
        this.updatedAt = new Date().toISOString();
        this.events = [];
    }

    generateId() {
        return 'TASK-' + Date.now().toString(36).toUpperCase();
    }
}

// ===== Storage Functions =====
async function loadTasks() {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/tasks`);
        if (!response) return; // authFetch handles redirect

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to load tasks:', response.status, errorText);
            showToast('Failed to load tasks', 'error');
            return;
        }

        tasks = await response.json();
        renderBoard();
    } catch (e) {
        console.error('Error loading tasks:', e);
        showToast('Error loading tasks', 'error');
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
        console.error('Error saving tasks:', e);
    }
}

function getDefaultTasks() {
    return [
        {
            id: 'TASK-001',
            title: 'Implement Kafka producer service',
            description: 'Create a producer to publish task events to Kafka topics',
            priority: 'high',
            status: 'todo',
            label: 'backend',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        },
        {
            id: 'TASK-002',
            title: 'Design event schema',
            description: 'Define JSON schema for task-created, task-updated events',
            priority: 'medium',
            status: 'todo',
            label: 'design',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        },
        {
            id: 'TASK-003',
            title: 'Setup Kafka consumer',
            description: 'Implement consumer to process real-time task updates',
            priority: 'high',
            status: 'todo',
            label: 'backend',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        },
        {
            id: 'TASK-004',
            title: 'Refactor drag-and-drop logic',
            description: 'Improve drag-and-drop with visual feedback and animations',
            priority: 'medium',
            status: 'inprogress',
            label: 'frontend',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        },
        {
            id: 'TASK-005',
            title: 'Create Kanban UI layout',
            description: 'Build the visual Kanban board with columns',
            priority: 'high',
            status: 'done',
            label: 'frontend',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        },
        {
            id: 'TASK-006',
            title: 'Docker Compose setup',
            description: 'Configure Kafka broker with KRaft mode in Docker',
            priority: 'medium',
            status: 'done',
            label: 'devops',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            events: []
        }
    ];
}

// ===== Render Functions =====
// ===== Board Rendering =====
function renderBoard() {
    const boardEl = document.getElementById('board');
    if (!boardEl) return;

    // Update Kafka status to ready when board is rendered
    updateKafkaStatusUI();
    updateHeaderStats();

    // Update the board title in the header
    const boardTitleEl = document.getElementById('boardTitle');
    if (boardTitleEl) {
        if (boards.length === 0) {
            boardTitleEl.textContent = 'No Boards';
            if (elements.boardHeaderIcon) elements.boardHeaderIcon.textContent = 'dashboard';
        } else if (!activeBoardId) {
            boardTitleEl.textContent = 'Select a Board';
            if (elements.boardHeaderIcon) elements.boardHeaderIcon.textContent = 'dashboard';
        } else {
            const activeBoard = boards.find(b => b.id === activeBoardId);
            boardTitleEl.textContent = activeBoard ? activeBoard.name : 'Board';
            if (elements.boardHeaderIcon) {
                elements.boardHeaderIcon.textContent = normalizeBoardIcon(activeBoard?.icon);
            }
        }
    }

    // No boards exist at all
    if (boards.length === 0) {
        boardEl.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]">
                <span class="material-symbols-outlined text-5xl mb-4 opacity-30">dashboard_customize</span>
                <p class="text-base font-medium mb-2">No boards yet</p>
                <p class="text-sm mb-4">Create your first board to get started</p>
                <button data-action="open-create-board" 
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                    Create Board
                </button>
            </div>
        `;
        return;
    }

    // No active board selected
    if (!activeBoardId) {
        boardEl.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]">
                <span class="material-symbols-outlined text-4xl mb-4 opacity-30">dashboard</span>
                <p class="text-sm">Select a board from the sidebar</p>
            </div>
        `;
        return;
    }

    // Board selected but no columns
    if (columns.length === 0) {
        boardEl.innerHTML = `
            <div class="flex flex-col items-center justify-center w-full h-full text-[#8a98a8]">
                <span class="material-symbols-outlined text-5xl mb-4 opacity-30">view_week</span>
                <p class="text-base font-medium mb-2">No lists yet</p>
                <p class="text-sm mb-4">Create your first list to organize tasks</p>
                <button data-action="open-create-list" 
                    class="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors">
                    <span class="material-symbols-outlined text-[18px]">add</span>
                    Create List
                </button>
            </div>
        `;
        return;
    }

    boardEl.innerHTML = columns.map((col, index) => `
        <div class="column flex flex-col w-80 flex-shrink-0 h-full rounded-xl transition-colors" data-column-id="${col.id}">
            <div class="column-drag-handle flex items-center justify-between mb-3 px-1" draggable="true">
                <div class="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                    <span class="material-symbols-outlined text-[#8a98a8] text-[18px]">drag_indicator</span>
                    <span class="flex items-center justify-center size-5 rounded text-[10px] font-bold text-white ${columnColorClasses[index % columnColorClasses.length]}" 
                          id="count-${col.id}">0</span>
                    <h3 class="text-sm font-semibold text-[#111418] dark:text-white editable-title" 
                        data-column-id="${col.id}" 
                        contenteditable="false">${escapeHtml(col.title)}</h3>
                </div>
                <div class="flex items-center gap-1 relative">
                    <button class="column-menu-btn text-[#8a98a8] hover:text-[#111418] dark:hover:text-white" data-column-id="${col.id}">
                        <span class="material-symbols-outlined text-[18px]">more_horiz</span>
                    </button>
                    <div class="column-menu hidden absolute right-0 top-8 bg-white dark:bg-[#151e29] rounded-lg shadow-xl border border-[#e5e7eb] dark:border-[#1e2936] py-1 w-48 z-10" data-column-id="${col.id}">
                        <button data-action="column-add-card" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left">
                            <span class="material-symbols-outlined text-[18px]">add</span>
                            Add card
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button data-action="column-move-left" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                            Move left
                        </button>
                        <button data-action="column-move-right" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === columns.length - 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                            Move right
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button data-action="column-rename" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                            Rename list
                        </button>
                        <button data-action="column-delete" data-column-id="${col.id}" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                            Delete list
                        </button>
                    </div>
                </div>
            </div>
            <!-- Cards Container -->
            <div class="task-list flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pb-4 pr-1"
                id="list-${col.id}" data-column-id="${col.id}"></div>
            <!-- Inline Add Card Form -->
            <div class="inline-add-form hidden" data-column-id="${col.id}"></div>
            <button
                class="add-card-btn flex items-center justify-center px-2 py-2 mt-2 text-[#5c6b7f] dark:text-gray-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                data-column-id="${col.id}" title="Add Card">
                <span class="material-symbols-outlined text-[20px]">add</span>
            </button>
        </div>
    `).join('') + `
        <div class="flex-shrink-0 h-full flex items-stretch">
            <button id="addListBtn" class="flex flex-col items-center justify-center px-4 w-16 bg-[#f1f3f5] dark:bg-[#1a232e] hover:bg-[#e6e8eb] dark:hover:bg-[#253040] rounded-xl text-[#5c6b7f] dark:text-gray-400 font-medium transition-all shadow-sm">
                <span class="material-symbols-outlined text-2xl">add</span>
            </button>
        </div>
    `;

    // Add event listener for the add list button
    document.getElementById('addListBtn').addEventListener('click', showCreateListModal);

    // Re-attach event listeners for the new DOM elements
    attachBoardEventListeners();

    // Populate tasks
    columns.forEach(col => {
        const colTasks = tasks.filter(t => t.column_id === col.id);
        const listEl = document.getElementById(`list-${col.id}`);
        const countEl = document.getElementById(`count-${col.id}`);

        if (listEl) {
            listEl.innerHTML = '';
            colTasks.forEach(task => {
                listEl.appendChild(createTaskCard(task));
            });
        }
        if (countEl) {
            countEl.textContent = colTasks.length;
        }
    });

}

function updateHeaderStats() {
    if (!elements.headerStats) {
        console.warn('Header stats element not found');
        return;
    }

    if (!activeBoardId || columns.length === 0) {
        elements.headerStats.innerHTML = '';
        return;
    }

    console.log('Updating header stats:', columns.length, 'columns', tasks.length, 'tasks');

    elements.headerStats.innerHTML = columns.map((col, index) => {
        const count = tasks.filter(t => t.column_id === col.id).length;
        const colorClass = columnColorClasses[index % columnColorClasses.length];

        return `
            <div class="flex items-center gap-1.5">
                <span class="size-2 rounded-full ${colorClass}"></span>
                <span class="text-[#5c6b7f] dark:text-gray-400">${escapeHtml(col.title)}: <span class="font-semibold text-[#111418] dark:text-white">${count}</span></span>
            </div>
        `;
    }).join('');
}

function renderEmptyState() {
    return `
        <div class="flex flex-col items-center justify-center py-8 text-[#8a98a8]">
            <span class="material-symbols-outlined text-3xl mb-2 opacity-50">inbox</span>
            <p class="text-sm">No tasks yet</p>
        </div>
    `;
}

// ===== View Switching =====
function switchView(viewName) {
    // Hide all views first
    elements.boardView.classList.add('hidden');
    elements.activityView.classList.add('hidden');
    elements.myTasksView.classList.add('hidden');

    // Reset all nav styles
    [elements.navBoard, elements.navActivity, elements.navMyTasks].forEach(nav => {
        nav.classList.remove('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        nav.classList.add('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
    });

    if (viewName === 'board') {
        elements.boardView.classList.remove('hidden');
        elements.navBoard.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navBoard.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        renderBoard();
    } else if (viewName === 'activity') {
        elements.activityView.classList.remove('hidden');
        elements.navActivity.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navActivity.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        loadActivities();
    } else if (viewName === 'my-tasks') {
        elements.myTasksView.classList.remove('hidden');
        elements.navMyTasks.classList.add('bg-[#eff1f3]', 'dark:bg-[#1e2936]', 'text-[#111418]', 'dark:text-white');
        elements.navMyTasks.classList.remove('hover:bg-[#eff1f3]', 'dark:hover:bg-[#1e2936]', 'text-[#5c6b7f]', 'dark:text-gray-400');
        loadMyTasks();
    }
}

async function loadActivities() {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/activities`);
        if (!response) return;

        const activities = await response.json();

        globalEvents = activities.map(a => ({
            type: a.event_type,
            taskId: a.task_title || a.task_id,
            originalTaskId: a.task_id,
            data: a.data,
            time: new Date(a.timestamp).toLocaleTimeString(),
            timestamp: a.timestamp
        }));

        renderActivityLog();
    } catch (e) {
        console.error('Error loading activities:', e);
    }
}

function renderActivityLog() {
    if (globalEvents.length === 0) {
        elements.activityLog.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-[#8a98a8]">
                <span class="material-symbols-outlined text-4xl mb-4 opacity-30">history</span>
                <p class="text-sm">No activity recorded yet</p>
            </div>
        `;
        return;
    }

    elements.activityLog.innerHTML = globalEvents.map(event => {
        const typeColors = {
            'TASK_CREATED': 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
            'TASK_UPDATED': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
            'TASK_MOVED': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
            'TASK_DELETED': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
            'TASK_REORDERED': 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
            'RECEIVED': 'text-primary bg-primary/10'
        };

        const colorClass = typeColors[event.type] || 'text-gray-600 bg-gray-50';

        return `
            <div class="flex items-start gap-4 p-4 bg-white dark:bg-[#151e29] rounded-xl border border-[#e5e7eb] dark:border-[#1e2936] shadow-sm hover:border-primary/30 transition-colors">
                <div class="p-2 rounded-lg ${colorClass} shrink-0">
                    <span class="material-symbols-outlined text-[20px]">${event.type === 'TASK_DELETED' ? 'delete' : event.type === 'TASK_CREATED' ? 'add_circle' : 'bolt'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                        <h4 class="text-sm font-semibold text-[#111418] dark:text-white truncate">
                            ${event.taskTitle ? escapeHtml(event.taskTitle) : (event.taskId || 'System')}
                        </h4>
                        <span class="text-[10px] font-medium text-[#8a98a8] whitespace-nowrap">${event.time}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${colorClass} uppercase tracking-wider">${event.type.replace('TASK_', '')}</span>
                        <p class="text-xs text-[#5c6b7f] dark:text-gray-400 truncate">${event.type === 'TASK_CREATED' ? 'Task created' : formatEventData(event.data)}</p>
                    </div>
                </div>
                <div class="text-[10px] font-mono text-[#8a98a8] bg-[#f8fafc] dark:bg-[#0d141c] px-2 py-1 rounded border border-[#e5e7eb] dark:border-[#1e2936]">
                    ${event.taskId || 'SYS'}
                </div>
            </div>
        `;
    }).join('');
}

async function loadMyTasks() {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/my`);
        if (!response) return;

        const myTasks = await response.json();
        elements.myTasksCount.textContent = `${myTasks.length} task${myTasks.length !== 1 ? 's' : ''}`;

        if (myTasks.length === 0) {
            elements.myTasksList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-20 text-[#8a98a8]">
                    <span class="material-symbols-outlined text-4xl mb-4 opacity-30">check_circle</span>
                    <p class="text-sm">No tasks assigned to you</p>
                </div>
            `;
            return;
        }

        // Group by status
        const grouped = { todo: [], inprogress: [], done: [] };
        myTasks.forEach(task => {
            if (grouped[task.status]) grouped[task.status].push(task);
        });

        elements.myTasksList.innerHTML = ['todo', 'inprogress', 'done'].map(status => {
            const statusNames = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
            const statusColors = { todo: 'bg-amber-500', inprogress: 'bg-primary', done: 'bg-green-500' };
            const statusTasks = grouped[status];
            if (statusTasks.length === 0) return '';

            return `
                <div class="mb-6">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="size-2 rounded-full ${statusColors[status]}"></span>
                        <span class="text-xs font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase">${statusNames[status]} (${statusTasks.length})</span>
                    </div>
                    <div class="flex flex-col gap-2">
                    ${statusTasks.map(task => `
                        <div class="task-card-my p-4 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 cursor-pointer transition-all" data-task-id="${task.id}">
                            <div class="flex justify-between items-start mb-1">
                                <span class="text-[10px] font-medium text-[#8a98a8]">${task.id}</span>
                                ${task.due_date ? `<span class="text-[10px] font-medium text-[#5c6b7f]">${formatDate(task.due_date)}</span>` : ''}
                            </div>
                            <p class="text-sm font-medium text-[#111418] dark:text-gray-200">${escapeHtml(task.title)}</p>
                            ${task.description ? `<p class="text-xs text-[#5c6b7f] dark:text-gray-400 mt-1">${escapeHtml(task.description)}</p>` : ''}
                        </div>
                    `).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        document.querySelectorAll('.task-card-my').forEach(card => {
            card.addEventListener('click', () => {
                const taskId = card.dataset.taskId;
                const task = myTasks.find(t => t.id === taskId);
                if (task) openTaskPanel(task);
            });
        });
    } catch (e) {
        console.error('Error loading my tasks:', e);
    }
}

async function loadColumns() {
    if (!activeBoardId) return;
    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/columns`);
        if (!response) return;
        columns = await response.json();
    } catch (e) {
        console.error('Error loading columns:', e);
        showToast('Failed to load columns', 'error');
    }
}

function showCreateListModal() {
    showCreateListModalService({ elements });
}

function hideCreateListModal() {
    hideCreateListModalService({ elements });
}

async function createColumn() {
    await createColumnService({
        elements,
        activeBoardId,
        columns,
        authFetch,
        API_URL,
        hideCreateListModal,
        loadColumns,
        renderBoard,
        showToast
    });
}

async function deleteColumn(columnId) {
    // Close any open menus
    closeAllColumnMenus();

    // Show the delete list modal
    showDeleteListModal(columnId);
}

function showDeleteListModal(columnId) {
    showDeleteListModalService({
        columns,
        confirmDeleteList,
        hideDeleteListModal
    }, columnId);
}

function hideDeleteListModal() {
    hideDeleteListModalService();
}

async function confirmDeleteList(columnId) {
    await confirmDeleteListService({
        authFetch,
        API_URL,
        loadColumns,
        renderBoard,
        showToast
    }, columnId);
}

function editColumnTitle(columnId) {
    closeAllColumnMenus();

    const titleEl = document.querySelector(`.editable-title[data-column-id="${columnId}"]`);
    if (!titleEl) return;

    const originalTitle = titleEl.textContent;
    titleEl.contentEditable = true;
    titleEl.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(titleEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finishEdit = async () => {
        titleEl.contentEditable = false;
        const newTitle = titleEl.textContent.trim();

        if (!newTitle || newTitle === originalTitle) {
            titleEl.textContent = originalTitle;
            return;
        }

        try {
            const response = await authFetch(`${API_URL}/api/columns/${columnId}`, {
                method: 'PUT',
                body: JSON.stringify({ title: newTitle })
            });

            if (response.ok) {
                await loadColumns();
                showToast('List renamed', 'success');
            } else {
                titleEl.textContent = originalTitle;
                showToast('Failed to rename list', 'error');
            }
        } catch (e) {
            console.error('Error renaming column:', e);
            titleEl.textContent = originalTitle;
            showToast('Failed to rename list', 'error');
        }
    };

    titleEl.addEventListener('blur', finishEdit, { once: true });
    titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            titleEl.blur();
        } else if (e.key === 'Escape') {
            titleEl.textContent = originalTitle;
            titleEl.blur();
        }
    }, { once: true });
}

function scrollToAddCard(columnId) {
    closeAllColumnMenus();
    const column = document.querySelector(`.column[data-column-id="${columnId}"]`);
    if (!column) return;

    const addBtn = column.querySelector('.add-card-btn');
    if (addBtn) {
        addBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => {
            addBtn.click();
        }, 300);
    }
}

function closeAllColumnMenus() {
    document.querySelectorAll('.column-menu').forEach(menu => {
        menu.classList.add('hidden');
    });
}

async function moveColumnLeft(columnId) {
    closeAllColumnMenus();
    const index = columns.findIndex(c => c.id === columnId);
    if (index <= 0) return;

    // Swap positions
    const temp = columns[index - 1];
    columns[index - 1] = columns[index];
    columns[index] = temp;

    // Update positions in database
    await updateColumnPositions();
    renderBoard();
}

async function moveColumnRight(columnId) {
    closeAllColumnMenus();
    const index = columns.findIndex(c => c.id === columnId);
    if (index < 0 || index >= columns.length - 1) return;

    // Swap positions
    const temp = columns[index + 1];
    columns[index + 1] = columns[index];
    columns[index] = temp;

    // Update positions in database
    await updateColumnPositions();
    renderBoard();
}

async function updateColumnPositions() {
    try {
        // Update all column positions
        for (let i = 0; i < columns.length; i++) {
            await authFetch(`${API_URL}/api/columns/${columns[i].id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ position: i })
            });
        }
    } catch (e) {
        console.error('Error updating column positions:', e);
        showToast('Failed to update column order', 'error');
    }
}

// ===== Label Management =====
let globalLabels = [];
let boardLabels = [];

async function loadLabels() {
    if (!activeWorkspaceId) return;
    try {
        // Load workspace (global) labels
        const globalResponse = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/labels`);
        if (globalResponse && globalResponse.ok) {
            globalLabels = await globalResponse.json();
        }

        // Load board-specific labels if board is active
        if (activeBoardId) {
            const boardResponse = await authFetch(`${API_URL}/api/boards/${activeBoardId}/labels`);
            if (boardResponse && boardResponse.ok) {
                boardLabels = await boardResponse.json();
            }
        }

        // Combine for easier access
        labels = [...globalLabels, ...boardLabels];
    } catch (e) {
        console.error('Error loading labels:', e);
    }
}

function openLabelManager(scope = 'global') {
    const modal = document.getElementById('labelManagerModal');
    modal.classList.remove('hidden');
    modal.style.display = '';

    // Set scope selector
    const scopeSelect = document.getElementById('labelScopeSelect');
    if (scopeSelect) {
        scopeSelect.value = scope;
    }

    renderLabelLists();
}

function closeLabelManager() {
    const modal = document.getElementById('labelManagerModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';

    // Clear inputs
    document.getElementById('labelNameInput').value = '';
    document.getElementById('labelColorInput').value = '#93c5fd';
}

function renderLabelLists() {
    const globalList = document.getElementById('labelListGlobal');
    const boardList = document.getElementById('labelListBoard');

    if (!globalList || !boardList) return;

    // Render global labels
    if (globalLabels.length === 0) {
        globalList.innerHTML = '<p class="text-xs text-gray-400 py-2">No global labels</p>';
    } else {
        globalList.innerHTML = globalLabels.map(label => `
            <div class="flex items-center justify-between p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg">
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded" style="background-color: ${label.color || '#93c5fd'}"></span>
                    <span class="text-sm text-[#111418] dark:text-white">${escapeHtml(label.name)}</span>
                </div>
                <button data-action="label-delete" data-label-id="${label.id}" class="text-red-500 hover:text-red-700 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        `).join('');
    }

    // Render board labels
    if (boardLabels.length === 0) {
        boardList.innerHTML = '<p class="text-xs text-gray-400 py-2">No board labels</p>';
    } else {
        boardList.innerHTML = boardLabels.map(label => `
            <div class="flex items-center justify-between p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg">
                <div class="flex items-center gap-2">
                    <span class="w-4 h-4 rounded" style="background-color: ${label.color || '#93c5fd'}"></span>
                    <span class="text-sm text-[#111418] dark:text-white">${escapeHtml(label.name)}</span>
                </div>
                <button data-action="label-delete" data-label-id="${label.id}" class="text-red-500 hover:text-red-700 transition-colors">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        `).join('');
    }
}

async function createLabel() {
    const nameInput = document.getElementById('labelNameInput');
    const colorInput = document.getElementById('labelColorInput');
    const scopeSelect = document.getElementById('labelScopeSelect');

    const name = nameInput.value.trim();
    const color = colorInput.value;
    const scope = scopeSelect.value;

    if (!name) {
        showToast('Label name is required', 'error');
        nameInput.focus();
        return;
    }

    try {
        let url;
        if (scope === 'global') {
            url = `${API_URL}/api/workspaces/${activeWorkspaceId}/labels`;
        } else {
            if (!activeBoardId) {
                showToast('No board selected', 'error');
                return;
            }
            url = `${API_URL}/api/boards/${activeBoardId}/labels`;
        }

        const response = await authFetch(url, {
            method: 'POST',
            body: JSON.stringify({ name, color })
        });

        if (!response || !response.ok) {
            throw new Error('Failed to create label');
        }

        const newLabel = await response.json();

        if (scope === 'global') {
            globalLabels.push(newLabel);
        } else {
            boardLabels.push(newLabel);
        }

        labels = [...globalLabels, ...boardLabels];

        // Clear inputs
        nameInput.value = '';
        colorInput.value = '#93c5fd';

        renderLabelLists();
        showToast('Label created successfully', 'success');
    } catch (e) {
        console.error('Error creating label:', e);
        showToast('Failed to create label', 'error');
    }
}

async function deleteLabel(labelId) {
    if (!confirm('Delete this label? It will be removed from all tasks.')) {
        return;
    }

    try {
        const response = await authFetch(`${API_URL}/api/labels/${labelId}`, {
            method: 'DELETE'
        });

        if (!response || !response.ok) {
            throw new Error('Failed to delete label');
        }

        globalLabels = globalLabels.filter(l => l.id !== labelId);
        boardLabels = boardLabels.filter(l => l.id !== labelId);
        labels = [...globalLabels, ...boardLabels];

        renderLabelLists();
        showToast('Label deleted successfully', 'success');

        // Refresh task panel if open
        if (currentEditingTask) {
            populateTaskPanelLabels(currentEditingTask);
        }
    } catch (e) {
        console.error('Error deleting label:', e);
        showToast('Failed to delete label', 'error');
    }
}

function populateTaskPanelLabels(task) {
    const container = elements.panelLabelSelect;
    if (!container) return;

    container.innerHTML = '';

    if (labels.length === 0) {
        container.innerHTML = '<p class="text-xs text-gray-400 py-2 text-center">No labels available. Create labels first.</p>';
        return;
    }

    const taskLabelIds = task.labels ? task.labels.map(l => l.id) : [];

    labels.forEach(label => {
        const isChecked = taskLabelIds.includes(label.id);
        const labelEl = document.createElement('label');
        labelEl.className = 'flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer transition-colors';
        labelEl.innerHTML = `
            <input type="checkbox" 
                   value="${label.id}" 
                   ${isChecked ? 'checked' : ''}
                   class="rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary">
            <span class="w-3 h-3 rounded" style="background-color: ${label.color || '#93c5fd'}"></span>
            <span class="text-sm text-[#111418] dark:text-white flex-1">${escapeHtml(label.name)}</span>
        `;
        container.appendChild(labelEl);
    });
}

function getSelectedLabelIds() {
    const container = elements.panelLabelSelect;
    if (!container) return [];

    const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// ===== Board Management =====
async function loadBoards() {
    await loadBoardsService({
        activeWorkspaceId,
        authFetch,
        API_URL,
        setBoards: (value) => {
            boards = value;
        },
        getActiveBoardId: () => activeBoardId,
        setActiveBoardId: (value) => {
            activeBoardId = value;
        },
        renderBoardList,
        showToast
    });
}

function renderBoardList() {
    // Sort boards by position
    boards.sort((a, b) => (a.position || 0) - (b.position || 0));

    const isCollapsed = elements.sidebar.classList.contains('collapsed');
    let displayBoards = boards;
    let overflowBoards = [];

    // If collapsed, use dynamic calculation
    if (isCollapsed) {
        // Calculate max visible items based on container height
        // boardList has flex-1, so clientHeight is the available height for items
        const containerHeight = elements.boardList.clientHeight;
        // Each item is approx 42px (36px content + gap)
        // We use 42px to be safe and ensure "More" button also fits
        const itemHeight = 42;

        let maxVisible = Math.max(1, Math.floor(containerHeight / itemHeight));

        if (boards.length > maxVisible) {
            // Reserve 1 slot for the "More" button
            maxVisible = Math.max(1, maxVisible - 1);

            displayBoards = boards.slice(0, maxVisible);
            overflowBoards = boards.slice(maxVisible);
        }
    } else {
        // Hide popout if expanded or no overflow
        const popout = document.getElementById('boardsPopout');
        if (popout) popout.style.display = 'none';

        // Use all boards when expanded
        displayBoards = boards;
    }

    if (boards.length === 0) {
        elements.boardList.innerHTML = `
            <div class="board-list-empty px-3 py-4 text-center text-xs text-[#8a98a8]">
                No boards yet
            </div>
        `;
        return;
    }

    const renderItem = (board, isOverflow = false) => {
        const isActive = board.id === activeBoardId;
        const iconColor = board.icon_color || '#3b82f6';
        // Only draggable if expanded and not in overflow menu
        const isDraggable = !isCollapsed && !isOverflow;

        return `
            <div class="flex items-center gap-1 group/board board-item ${isDraggable ? 'cursor-move' : ''}" 
                 data-board-id="${board.id}"
                 data-board-context="1"
                 ${isDraggable ? 'draggable="true"' : ''}
                 >
                 
                <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg flex-1 justify-start sidebar-item ${isActive ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white' : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] hover:text-[#111418] dark:hover:text-white'} transition-colors group"
                    data-action="switch-board" data-board-id="${board.id}" data-sidebar-tooltip="${escapeHtml(board.name)}">
                    <span class="material-symbols-outlined transition-colors flex-shrink-0" style="color: ${iconColor}">${escapeHtml(normalizeBoardIcon(board.icon))}</span>
                    <span class="text-sm font-medium truncate sidebar-text whitespace-nowrap">${escapeHtml(board.name)}</span>
                </a>
                <button data-action="delete-board" data-board-id="${board.id}" data-board-name="${escapeHtml(board.name)}"
                    class="opacity-0 group-hover/board:opacity-100 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[#8a98a8] hover:text-red-600 dark:hover:text-red-400 transition-all sidebar-text" 
                    title="Delete board">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                </button>
            </div>
        `;
    };

    let html = displayBoards.map(b => renderItem(b)).join('');

    // Add "More" button for collapsed state overflow
    if (overflowBoards.length > 0) {
        html += `
            <div class="flex items-center justify-center py-1 mt-1 group relative">
                <button id="boardsMoreBtn" class="flex items-center justify-center size-8 rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] text-[#5c6b7f] transition-colors"
                    title="More boards" data-action="toggle-boards-popout" data-sidebar-tooltip="More Boards">
                    <span class="material-symbols-outlined">more_horiz</span>
                </button>
            </div>
        `;

        // Render content into the popout container
        const popout = document.getElementById('boardsPopout');
        if (popout) {
            popout.innerHTML = overflowBoards.map(b => renderItem(b, true)).join('');
        }
    }

    elements.boardList.innerHTML = html;

    if (!isCollapsed) {
        setupBoardDragAndDrop();
    }
}

// ===== Board Drag and Drop & Overflow =====

function setupBoardDragAndDrop() {
    const items = elements.boardList.querySelectorAll('.board-item[draggable="true"]');
    items.forEach(item => {
        item.addEventListener('dragstart', handleBoardDragStart);
        item.addEventListener('dragover', handleBoardDragOver);
        item.addEventListener('dragleave', handleBoardDragLeave);
        item.addEventListener('drop', handleBoardDrop);
        item.addEventListener('dragend', handleBoardDragEnd);
    });
}

let draggedBoardItem = null;

function handleBoardDragStart(e) {
    draggedBoardItem = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
}

function handleBoardDragOver(e) {
    e.preventDefault();
    if (this === draggedBoardItem) return;

    this.classList.remove('drag-over-top', 'drag-over-bottom');

    // Calculate if top or bottom half
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (e.clientY < midY) {
        this.classList.add('drag-over-top');
    } else {
        this.classList.add('drag-over-bottom');
    }
}

function handleBoardDragLeave(e) {
    this.classList.remove('drag-over-top', 'drag-over-bottom');
}

async function handleBoardDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
    if (!draggedBoardItem || this === draggedBoardItem) return;

    const draggedId = draggedBoardItem.dataset.boardId;
    const targetId = this.dataset.boardId;

    // Find indices
    const draggedIdx = boards.findIndex(b => b.id === draggedId);
    let targetIdx = boards.findIndex(b => b.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Remove dragged item
    const [movedBoard] = boards.splice(draggedIdx, 1);

    // Determine drop position (top or bottom of target)
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    // Adjust target index based on drop position relative to element center
    // Note: Since we removed dragged item first, we need to be careful with index check
    // If dragged item was BEFORE target, target index shifted down by 1 in the spliced array logic in some implementations, 
    // but findIndex on CURRENT boards array handles it better if done carefully.
    // Instead, let's just insert at the visualized position.

    // Wait, simple array logic:
    // Insert at targetIdx if top, targetIdx+1 if bottom.
    // But targetIdx is based on original array? No, logic above modified array.
    // Let's reload from scratch to avoid mutable array confusion logic bugs.

    // Revert splice for a sec to think clearly.
    // ... Actually, better:
    // 1. Get current sorted list.
    // 2. Remove dragged item.
    // 3. Find drop index in remaining list.
    // 4. Insert.

    // This is getting complex to do purely in memory while matching DOM.
    // Let's correct:
    // targetIdx calculation needs to account for the removal if draggedItem was before targetItem.

    if (e.clientY >= midY) {
        // Drop after
        // If we want to insert AFTER targetId
        // In the modified array (where dragged is gone), find targetId again
        const freshTargetIdx = boards.findIndex(b => b.id === targetId);
        boards.splice(freshTargetIdx + 1, 0, movedBoard);
    } else {
        // Drop before
        const freshTargetIdx = boards.findIndex(b => b.id === targetId);
        boards.splice(freshTargetIdx, 0, movedBoard);
    }

    // Update positions
    boards.forEach((b, idx) => b.position = idx);

    // Optimistic render
    renderBoardList();

    // Persist
    await updateBoardPositions();
}

function handleBoardDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.board-item').forEach(item => {
        item.classList.remove('drag-over-top', 'drag-over-bottom');
    });
    draggedBoardItem = null;
}

async function updateBoardPositions() {
    if (!activeWorkspaceId || boards.length === 0) return;

    const items = boards.map((b, idx) => ({ id: b.id, position: idx }));

    try {
        await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/boards/reorder`, {
            method: 'POST',
            body: JSON.stringify(items)
        });
    } catch (e) {
        console.error('Failed to reorder boards:', e);
        showToast('Failed to save board order', 'error');
    }
}

function toggleBoardsPopout(e) {
    e.stopPropagation();
    const popout = document.getElementById('boardsPopout');
    if (!popout) return;

    const btn = document.getElementById('boardsMoreBtn');

    if (popout.style.display === 'block') {
        popout.style.display = 'none';
        return;
    }

    // Position the popout relative to the button
    const btnRect = btn.getBoundingClientRect();
    const popoutHeight = popout.offsetHeight || 200; // Estimate if hidden
    const windowHeight = window.innerHeight;

    // Default top position aligned with button
    let top = btnRect.top;

    // Check if it would overflow bottom of screen
    if (top + popoutHeight > windowHeight - 20) {
        top = windowHeight - popoutHeight - 20;
    }

    popout.style.top = `${top}px`;
    popout.style.display = 'block';
}


// Global click to close popout
window.addEventListener('click', (e) => {
    const popout = document.getElementById('boardsPopout');
    if (popout && popout.style.display === 'block') {
        if (!popout.contains(e.target)) {
            popout.style.display = 'none';
        }
    }
});

// Sidebar toggle handler to re-render list



async function createBoard(name, icon = 'dashboard', iconColor = '#3b82f6') {
    await createBoardService({
        activeWorkspaceId,
        normalizeBoardIcon,
        authFetch,
        API_URL,
        setActiveBoardId: (value) => {
            activeBoardId = value;
        },
        loadBoards,
        renderBoardList,
        loadColumns,
        loadTasks,
        loadActivities,
        loadLabels,
        switchView,
        showToast,
        hideCreateBoardModal
    }, name, icon, iconColor);
}

let boardToDeleteId = null;

async function deleteBoard(boardId) {
    await deleteBoardService({
        authFetch,
        API_URL,
        getBoards: () => boards,
        setBoards: (value) => {
            boards = value;
        },
        getActiveBoardId: () => activeBoardId,
        closeTaskPanel,
        switchBoard,
        getWebsocket: () => websocket,
        setWebsocket: (value) => {
            websocket = value;
        },
        setActiveBoardId: (value) => {
            activeBoardId = value;
        },
        setTasks: (value) => {
            tasks = value;
        },
        setColumns: (value) => {
            columns = value;
        },
        setKafkaConnected: (value) => {
            kafkaConnected = value;
        },
        updateKafkaStatusUI,
        renderBoard,
        renderBoardList,
        showToast,
        hideDeleteBoardModal
    }, boardId);
}

function showDeleteBoardModal(boardId, boardName) {
    showDeleteBoardModalService({
        elements,
        setBoardToDeleteId: (value) => {
            boardToDeleteId = value;
        }
    }, boardId, boardName);
}

function hideDeleteBoardModal() {
    hideDeleteBoardModalService({
        elements,
        setBoardToDeleteId: (value) => {
            boardToDeleteId = value;
        }
    });
}

function switchBoard(boardId) {
    switchBoardService({
        getActiveBoardId: () => activeBoardId,
        setActiveBoardId: (value) => {
            activeBoardId = value;
        },
        renderBoardList,
        loadColumns,
        loadTasks,
        loadActivities,
        loadLabels,
        switchView
    }, boardId);
}

// ===== Create Board Modal =====
function showCreateBoardModal() {
    showCreateBoardModalService({ elements });
}

function hideCreateBoardModal() {
    hideCreateBoardModalService({ elements });
}

// ===== Board Context Menu =====
let currentContextBoardId = null;

function showBoardContextMenu(e, boardId) {
    e.preventDefault();
    e.stopPropagation();
    currentContextBoardId = boardId;

    const menu = elements.boardContextMenu;
    menu.style.display = 'block';
    menu.classList.remove('hidden');

    const menuWidth = 192;
    const menuHeight = menu.offsetHeight || 100;
    let x = e.pageX;
    let y = e.pageY;

    if (x + menuWidth > window.innerWidth + window.scrollX) {
        x = window.innerWidth + window.scrollX - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight + window.scrollY) {
        y = window.innerHeight + window.scrollY - menuHeight - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideBoardContextMenu() {
    if (elements.boardContextMenu) {
        elements.boardContextMenu.style.display = 'none';
        elements.boardContextMenu.classList.add('hidden');
    }
    currentContextBoardId = null;
}

// ===== Edit Board Modal =====
function showEditBoardModal(boardId) {
    showEditBoardModalService({
        elements,
        getBoards: () => boards,
        normalizeBoardIcon
    }, boardId);
}

function hideEditBoardModal() {
    hideEditBoardModalService({ elements });
}

async function updateBoard(boardId, data) {
    await updateBoardService({
        authFetch,
        API_URL,
        getBoards: () => boards,
        setBoards: (value) => {
            boards = value;
        },
        renderBoardList,
        getActiveBoardId: () => activeBoardId,
        renderBoard,
        showToast
    }, boardId, data);
}

async function loadWorkspaceMembers() {
    if (!activeWorkspaceId) return;
    try {
        const response = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/members`);
        if (!response) return;
        workspaceMembers = await response.json();
    } catch (e) {
        console.error('Error loading workspace members:', e);
    }
}

function createTaskCard(task) {
    const card = document.createElement('div');
    const isDone = task.status === 'done';

    card.className = `task-card group flex flex-col gap-2 p-3 bg-white dark:bg-[#151e29] rounded-lg border border-[#e5e7eb] dark:border-[#1e2936] hover:border-primary/50 dark:hover:border-primary/50 shadow-sm cursor-pointer transition-all ${isDone ? 'opacity-60 hover:opacity-100' : ''}`;
    card.id = task.id;
    card.draggable = true;
    card.dataset.taskId = task.id;

    const priorityColors = {
        low: 'text-green-600 dark:text-green-400',
        medium: 'text-orange-600 dark:text-orange-400',
        high: 'text-red-600 dark:text-red-400'
    };

    const priorityBorderColors = {
        low: '#22c55e',    // green-500
        medium: '#f97316', // orange-500
        high: '#ef4444'    // red-500
    };

    // Add priority border color to card
    card.style.borderLeftWidth = '4px';
    card.style.borderLeftColor = priorityBorderColors[task.priority] || priorityBorderColors.medium;

    const dueDate = task.due_date;

    // Render labels (if task has new label system)
    let labelsHTML = '';
    if (task.labels && task.labels.length > 0) {
        labelsHTML = task.labels.map(label => `
            <span class="inline-flex items-center flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white" 
                  style="background-color: ${label.color || '#93c5fd'}">
                ${escapeHtml(label.name)}
            </span>
        `).join('');
    } else if (task.label) {
        // Fallback to old label system
        const labelStyle = labelColors[task.label] || labelColors.frontend;
        labelsHTML = `<span class="inline-flex items-center rounded-md ${labelStyle.bg} px-1.5 py-0.5 text-xs font-medium ${labelStyle.text} ring-1 ring-inset ${labelStyle.ring} capitalize">${task.label}</span>`;
    }

    card.innerHTML = `
        <div class="flex justify-between items-start gap-2">
            <span class="text-sm font-medium text-[#111418] dark:text-gray-200 leading-snug ${isDone ? 'line-through decoration-gray-400' : ''}">${escapeHtml(task.title)}</span>
            ${dueDate ? `<span class="text-[10px] font-medium text-[#5c6b7f] dark:text-gray-400 flex-shrink-0">${formatDate(dueDate)}</span>` : ''}
        </div>
        ${task.description ? `<p class="text-xs text-[#5c6b7f] dark:text-gray-400 line-clamp-2 mt-1">${escapeHtml(task.description)}</p>` : ''}
        ${task.images && task.images.length > 0 ? `
            <div class="flex gap-1 overflow-x-auto custom-scrollbar mt-2">
                ${task.images.slice(0, 3).map((url, idx) => `
                    <img src="${url}" alt="Task preview" data-image-url="${url}" 
                         class="task-preview-image w-12 h-12 object-cover rounded border border-[#e5e7eb] dark:border-[#1e2936] hover:opacity-80 transition-opacity cursor-pointer">
                `).join('')}
                ${task.images.length > 3 ? `<div class="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded border border-[#e5e7eb] dark:border-[#1e2936] text-xs font-medium text-gray-600 dark:text-gray-400">+${task.images.length - 3}</div>` : ''}
            </div>
        ` : ''}
        <div class="mt-1 flex items-center justify-between gap-2">
            <div class="relative flex items-center min-h-[24px] flex-1 overflow-hidden">
                <!-- Action buttons (hidden by default, shown on hover) -->
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="task-comment-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded" title="Add comment">
                        <span class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary dark:hover:text-primary">comment</span>
                    </button>
                    <button class="task-image-btn p-1 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] rounded" title="Add image">
                        <span class="material-symbols-outlined text-[16px] text-[#5c6b7f] dark:text-gray-400 hover:text-primary dark:hover:text-primary">add_photo_alternate</span>
                    </button>
                </div>
                <!-- Labels (scrollable, slide away on hover) -->
                <div class="task-labels-row absolute left-0 right-0 overflow-hidden transition-all duration-200 group-hover:translate-x-16 group-hover:opacity-0">
                    <div class="task-labels-inner flex gap-1 items-center">
                        ${labelsHTML || ''}
                    </div>
                </div>
            </div>
            <!-- Assignee avatar -->
            ${(() => {
                if (!task.assignee_id) return '';
                const assignee = workspaceMembers.find(m => m.id === task.assignee_id);
                if (!assignee) return '';
                const name = assignee.full_name || assignee.email || '';
                const initials = name.split(/[\s@]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
                return `<div class="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold" title="${escapeHtml(name)}">${initials}</div>`;
            })()}
        </div>
    `;

    // Add click handlers for preview images
    const previewImages = card.querySelectorAll('.task-preview-image');
    previewImages.forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening task panel
            const imageUrl = img.dataset.imageUrl;
            openImageModal(imageUrl);
        });
    });

    // Quick comment button
    const commentBtn = card.querySelector('.task-comment-btn');
    if (commentBtn) {
        commentBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening task panel
            openTaskPanel(task, true); // true = focus on comments
        });
    }

    // Quick image button
    const imageBtn = card.querySelector('.task-image-btn');
    if (imageBtn) {
        imageBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent opening task panel
            openTaskPanel(task);
            // Trigger image upload after panel opens
            setTimeout(() => {
                if (elements.panelImageUpload) {
                    elements.panelImageUpload.click();
                }
            }, 300);
        });
    }

    // Click to open side panel
    card.addEventListener('click', (e) => {
        if (!card.classList.contains('dragging')) {
            openTaskPanel(task);
        }
    });

    // Right-click to open context menu
    card.addEventListener('contextmenu', (e) => {
        if (!card.classList.contains('dragging')) {
            showTaskContextMenu(e, task);
        }
    });

    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    // Schedule autoscroll check after card is in DOM
    requestAnimationFrame(() => {
        const row   = card.querySelector('.task-labels-row');
        const inner = card.querySelector('.task-labels-inner');
        if (row && inner) {
            const overflow = inner.scrollWidth - row.clientWidth;
            if (overflow > 0) {
                inner.style.setProperty('--label-overflow', `-${overflow}px`);
                inner.classList.add('labels-autoscroll');
            }
        }
    });

    return card;
}

// ===== Inline Add Card =====
function showInlineAddForm(columnId) {
    // Hide any existing form
    hideInlineAddForm();

    const column = document.querySelector(`.column[data-column-id="${columnId}"]`);
    if (!column) return;
    const formContainer = column.querySelector('.inline-add-form');
    const addBtn = column.querySelector('.add-card-btn');

    // Generate label checkboxes
    const labelCheckboxes = labels.length === 0
        ? '<p class="text-xs text-gray-400 py-2 text-center">No labels available</p>'
        : labels.map(label => `
            <label class="flex items-center gap-2 cursor-pointer hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] px-2 py-1.5 rounded transition-colors">
                <input type="checkbox" value="${label.id}" class="inline-label-checkbox rounded border-gray-300 dark:border-gray-600 text-primary focus:ring-primary w-3.5 h-3.5">
                <span class="w-3 h-3 rounded" style="background-color: ${label.color || '#93c5fd'}"></span>
                <span class="text-xs text-[#111418] dark:text-white">${escapeHtml(label.name)}</span>
            </label>
        `).join('');

    formContainer.innerHTML = `
        <div class="flex flex-col gap-3 p-4 bg-white dark:bg-[#151e29] rounded-lg border-2 border-primary ring-4 ring-primary/20 shadow-xl mb-3 min-w-[320px]">
            <!-- Title Input -->
            <input type="text" 
                   class="inline-title-input w-full text-sm font-semibold text-[#111418] dark:text-white bg-transparent border-none p-0 focus:ring-0 placeholder-gray-400" 
                   placeholder="Task title..." 
                   autofocus>
            
            <!-- Description Textarea -->
            <textarea 
                class="inline-description-input w-full text-xs text-[#5c6b7f] dark:text-gray-300 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all resize-none placeholder-gray-400 custom-scrollbar"
                rows="2"
                placeholder="Add a description (optional)..."></textarea>
            
            <!-- Priority and Labels Row -->
            <div class="flex gap-3">
                <!-- Priority Selector -->
                <div class="flex-shrink-0">
                    <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Priority</label>
                    <select class="inline-priority-select text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary/50 focus:outline-none">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>
                
                <!-- Labels Selector -->
                <div class="flex-1 min-w-0">
                    <label class="block text-[10px] font-semibold text-[#5c6b7f] dark:text-gray-400 uppercase mb-1.5">Labels</label>
                    <div class="inline-label-container flex flex-col gap-0.5 p-2 bg-[#fbfcfd] dark:bg-[#0d141c] border border-[#e5e7eb] dark:border-[#1e2936] rounded-lg max-h-[140px] overflow-y-auto custom-scrollbar">
                        ${labelCheckboxes}
                    </div>
                </div>
            </div>
            
            <!-- Action Buttons -->
            <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e7eb] dark:border-[#1e2936]">
                <button class="inline-cancel-btn text-xs font-medium text-[#5c6b7f] dark:text-gray-400 hover:text-[#111418] dark:hover:text-white px-3 py-2 rounded-lg hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors">
                    Cancel
                </button>
                <button class="inline-create-btn flex items-center gap-1.5 bg-primary hover:bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors">
                    <span class="material-symbols-outlined text-[16px]">add</span>
                    Create Task
                </button>
            </div>
        </div>
    `;

    formContainer.classList.remove('hidden');
    addBtn.classList.add('hidden');

    const titleInput = formContainer.querySelector('.inline-title-input');
    const descriptionInput = formContainer.querySelector('.inline-description-input');
    const cancelBtn = formContainer.querySelector('.inline-cancel-btn');
    const createBtn = formContainer.querySelector('.inline-create-btn');
    const prioritySelect = formContainer.querySelector('.inline-priority-select');
    const labelCheckboxElements = formContainer.querySelectorAll('.inline-label-checkbox');

    activeInlineForm = { columnId, formContainer, addBtn };

    // Focus input
    setTimeout(() => titleInput.focus(), 50);

    // Event handlers
    cancelBtn.addEventListener('click', hideInlineAddForm);

    const createTask = () => {
        const title = titleInput.value.trim();
        if (title) {
            const description = descriptionInput.value.trim();
            const selectedLabelIds = Array.from(labelCheckboxElements)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            addTaskToColumn(title, description, prioritySelect.value, columnId, selectedLabelIds);
            hideInlineAddForm();
        }
    };

    createBtn.addEventListener('click', createTask);

    titleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            descriptionInput.focus();
        } else if (e.key === 'Escape') {
            hideInlineAddForm();
        }
    });

    descriptionInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideInlineAddForm();
        }
    });
}

function hideInlineAddForm() {
    if (activeInlineForm) {
        activeInlineForm.formContainer.classList.add('hidden');
        activeInlineForm.formContainer.innerHTML = '';
        activeInlineForm.addBtn.classList.remove('hidden');
        activeInlineForm = null;
    }
}

// ===== Side Panel Functions =====
function openTaskPanel(task, focusOnComments = false) {
    currentEditingTask = task;

    // Populate panel
    elements.panelTaskId.textContent = task.id;
    // Find current column title for display
    const currentCol = columns.find(c => c.id === task.column_id);
    elements.panelTaskStatus.textContent = currentCol ? currentCol.title : 'Unknown';
    elements.panelTitle.value = task.title;
    elements.panelDescription.value = task.description || '';
    elements.panelPrioritySelect.value = task.priority;

    // Populate labels checkboxes
    populateTaskPanelLabels(task);

    // Populate status dropdown from board columns
    elements.panelStatusSelect.innerHTML = '';
    columns.forEach(col => {
        const option = document.createElement('option');
        option.value = col.id;
        option.textContent = col.title;
        elements.panelStatusSelect.appendChild(option);
    });
    elements.panelStatusSelect.value = task.column_id || '';

    // Set min date on due date input to today
    const today = new Date().toISOString().split('T')[0];
    elements.panelDueDate.setAttribute('min', today);

    // Format due_date for the date input (needs YYYY-MM-DD format)
    if (task.due_date) {
        const date = new Date(task.due_date);
        elements.panelDueDate.value = date.toISOString().split('T')[0];
        elements.panelDueDate.type = 'date';
    } else {
        elements.panelDueDate.value = '';
        elements.panelDueDate.type = 'text';
    }

    // Populate assignee dropdown
    elements.panelAssigneeSelect.innerHTML = '<option value="">Unassigned</option>';
    workspaceMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.full_name || member.email;
        elements.panelAssigneeSelect.appendChild(option);
    });
    elements.panelAssigneeSelect.value = task.assignee_id || '';

    // Render images
    renderTaskImages(task.images || []);

    // Load and render comments
    loadComments(task.id);
    // Clear comment input
    elements.commentInput.value = '';
    currentCommentImages = [];
    renderCommentImages();

    // Render event log
    renderEventLog(task);

    // Show panel
    elements.taskPanel.classList.remove('hidden');
    setTimeout(() => {
        elements.panelContent.classList.remove('translate-x-full');

        // If focusOnComments is true, scroll to comments and focus input
        if (focusOnComments) {
            setTimeout(() => {
                const panelBody = elements.panelContent.querySelector('.overflow-y-auto');
                if (panelBody && elements.commentInput) {
                    // Scroll to comments section
                    elements.commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Focus the comment input
                    setTimeout(() => {
                        elements.commentInput.focus();
                    }, 300);
                }
            }, 200);
        }
    }, 10);
}

function closeTaskPanel() {
    elements.panelContent.classList.add('translate-x-full');
    setTimeout(() => {
        elements.taskPanel.classList.add('hidden');
        currentEditingTask = null;
    }, 150);
}

// ===== Image Handling =====
function renderTaskImages(images) {
    if (!images || images.length === 0) {
        elements.panelImagesContainer.innerHTML = '<div class="col-span-3 text-xs text-[#8a98a8] p-2">No images added yet</div>';
        return;
    }

    elements.panelImagesContainer.innerHTML = images.map((url, index) => `
        <div class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800">
            <img src="${url}" alt="Task image ${index + 1}" 
                class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                data-action="open-image-modal" data-image-url="${url}">
            <button type="button" 
                class="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                data-action="remove-task-image" data-image-index="${index}"
                title="Remove image">
                <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
        </div>
    `).join('');
}

async function uploadTaskImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    elements.imageUploadStatus.textContent = 'Uploading...';
    elements.imageUploadStatus.classList.remove('hidden');

    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_URL}/api/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Upload failed');
        }

        const data = await response.json();
        elements.imageUploadStatus.classList.add('hidden');
        return data.url;
    } catch (error) {
        console.error('Error uploading image:', error);
        elements.imageUploadStatus.textContent = 'Upload failed';
        setTimeout(() => {
            elements.imageUploadStatus.classList.add('hidden');
        }, 3000);
        showToast('Failed to upload image', 'error');
        return null;
    }
}

function removeTaskImage(index) {
    if (!currentEditingTask || !currentEditingTask.images) return;

    currentEditingTask.images.splice(index, 1);
    renderTaskImages(currentEditingTask.images);
}

function openImageModal(url) {
    // Create a simple modal to view the image
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm';
    modal.innerHTML = `
        <div class="relative max-w-4xl max-h-[90vh] p-4">
            <img src="${url}" alt="Full size image" class="max-w-full max-h-full object-contain rounded-lg">
            <button class="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
                <span class="material-symbols-outlined">close</span>
            </button>
        </div>
    `;

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('button')) {
            document.body.removeChild(modal);
        }
    });

    document.body.appendChild(modal);
}

// ===== Comment Handling =====
let currentCommentImages = [];

async function loadComments(taskId) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}/comments`);
        if (!response) return;

        const comments = await response.json();
        renderComments(comments);
    } catch (error) {
        console.error('Error loading comments:', error);
        showToast('Failed to load comments', 'error');
    }
}

function renderComments(comments) {
    if (!comments || comments.length === 0) {
        elements.commentsContainer.innerHTML = '<div class="text-xs text-[#8a98a8] text-center py-4">No comments yet. Be the first to comment!</div>';
        return;
    }

    elements.commentsContainer.innerHTML = comments.map(comment => {
        const commentDate = new Date(comment.created_at);
        const formattedDate = commentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const formattedTime = commentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const isOwner = currentUser && comment.user_id === currentUser.id;

        const imagesHtml = comment.images && comment.images.length > 0 ? `
            <div class="grid grid-cols-3 gap-2 mt-2">
                ${comment.images.map(url => `
                    <div class="aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800">
                        <img src="${url}" alt="Comment image" 
                            class="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            data-action="open-image-modal" data-image-url="${url}">
                    </div>
                `).join('')}
            </div>
        ` : '';

        return `
            <div class="bg-white dark:bg-[#151e29] rounded-lg p-4 border border-[#e5e7eb] dark:border-[#1e2936]">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white text-sm font-semibold">
                            ${comment.user_id ? comment.user_id.substring(0, 2).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div class="text-sm font-medium text-[#111418] dark:text-white">User</div>
                            <div class="text-xs text-[#5c6b7f] dark:text-gray-400">${formattedDate} at ${formattedTime}</div>
                        </div>
                    </div>
                    ${isOwner ? `
                        <button data-action="delete-comment" data-comment-id="${comment.id}"
                            class="p-1 text-[#5c6b7f] hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                            title="Delete comment">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    ` : ''}
                </div>
                <div class="text-sm text-[#111418] dark:text-gray-200 whitespace-pre-wrap">${escapeHtml(comment.content)}</div>
                ${imagesHtml}
            </div>
        `;
    }).join('');
}

async function postComment() {
    if (!currentEditingTask) return;

    const content = elements.commentInput.value.trim();
    if (!content && currentCommentImages.length === 0) {
        showToast('Comment cannot be empty', 'error');
        return;
    }

    const commentData = {
        content: content,
        images: currentCommentImages
    };

    try {
        const response = await authFetch(`${API_URL}/api/tasks/${currentEditingTask.id}/comments`, {
            method: 'POST',
            body: JSON.stringify(commentData)
        });

        if (!response) return;

        const newComment = await response.json();

        // Clear input and images
        elements.commentInput.value = '';
        currentCommentImages = [];
        elements.commentImagesContainer.innerHTML = '';
        elements.commentImagesContainer.classList.add('hidden');

        // Reload comments
        await loadComments(currentEditingTask.id);

        showToast('Comment added', 'success');
    } catch (error) {
        console.error('Error posting comment:', error);
        showToast('Failed to post comment', 'error');
    }
}

async function deleteComment(commentId) {
    if (!confirm('Delete this comment?')) return;

    try {
        const response = await authFetch(`${API_URL}/api/comments/${commentId}`, {
            method: 'DELETE'
        });

        if (!response) return;

        // Reload comments
        await loadComments(currentEditingTask.id);

        showToast('Comment deleted', 'success');
    } catch (error) {
        console.error('Error deleting comment:', error);
        showToast('Failed to delete comment', 'error');
    }
}

async function uploadCommentImage(file) {
    elements.commentImageStatus.textContent = 'Uploading...';
    elements.commentImageStatus.classList.remove('hidden');

    try {
        const url = await uploadTaskImage(file);
        elements.commentImageStatus.classList.add('hidden');
        return url;
    } catch (error) {
        console.error('Error uploading comment image:', error);
        elements.commentImageStatus.textContent = 'Upload failed';
        setTimeout(() => {
            elements.commentImageStatus.classList.add('hidden');
        }, 3000);
        return null;
    }
}

function renderCommentImages() {
    if (currentCommentImages.length === 0) {
        elements.commentImagesContainer.innerHTML = '';
        elements.commentImagesContainer.classList.add('hidden');
        return;
    }

    elements.commentImagesContainer.classList.remove('hidden');
    elements.commentImagesContainer.innerHTML = currentCommentImages.map((url, index) => `
        <div class="relative group aspect-square rounded-lg overflow-hidden border border-[#e5e7eb] dark:border-[#1e2936] bg-gray-100 dark:bg-gray-800">
            <img src="${url}" alt="Comment image ${index + 1}" 
                class="w-full h-full object-cover">
            <button type="button" 
                class="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                data-action="remove-comment-image" data-image-index="${index}"
                title="Remove image">
                <span class="material-symbols-outlined text-[14px]">close</span>
            </button>
        </div>
    `).join('');
}

function removeCommentImage(index) {
    currentCommentImages.splice(index, 1);
    renderCommentImages();
}

function saveTaskFromPanel() {
    saveTaskFromPanelService({
        getCurrentEditingTask: () => currentEditingTask,
        elements,
        columns,
        getSelectedLabelIds,
        showToast,
        updateTask,
        closeTaskPanel
    });
}

// Filter events for this task from globalEvents
function renderEventLog(task) {
    const taskEvents = globalEvents.filter(e => e.originalTaskId === task.id || e.taskId === task.id);

    if (taskEvents.length === 0) {
        elements.panelEventLog.innerHTML = `
            <div class="px-4 py-3 text-center text-gray-400 text-xs">No Kafka events recorded for this task</div>
        `;
        return;
    }

    elements.panelEventLog.innerHTML = taskEvents.slice(0, 5).map(event => `
        <div class="group px-4 py-3 border-b border-[#e5e7eb] dark:border-[#1e2936] hover:bg-white dark:hover:bg-[#151e29] transition-colors flex gap-4 cursor-default">
            <span class="text-[#94a3b8] shrink-0 select-none w-20">${event.time}</span>
            <div class="flex-1 overflow-hidden">
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-blue-600 dark:text-blue-400 font-bold">${escapeHtml(event.type)}</span>
                </div>
                <span class="text-[#334155] dark:text-gray-400 block truncate">
                    ${event.type === 'TASK_CREATED' ? 'Task created' : formatEventData(event.data)}
                </span>
            </div>
        </div>
    `).join('');
}

// ===== Task CRUD Operations =====
async function addTask(title, description, priority, status, labelIds = []) {
    await addTaskService({
        activeBoardId,
        authFetch,
        API_URL,
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        renderBoard,
        notifyKafkaEvent,
        elements,
        renderActivityLog,
        showToast
    }, title, description, priority, status, labelIds);
}

async function addTaskToColumn(title, description, priority, columnId, labelIds = []) {
    await addTaskToColumnService({
        activeBoardId,
        authFetch,
        API_URL,
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        renderBoard,
        notifyKafkaEvent,
        elements,
        renderActivityLog,
        showToast
    }, title, description, priority, columnId, labelIds);
}

async function updateTask(id, updates) {
    await updateTaskService({
        authFetch,
        API_URL,
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        renderBoard,
        elements,
        renderActivityLog,
        notifyKafkaEvent,
        showToast
    }, id, updates);
}

// ===== Delete Confirmation =====
function showDeleteModal(task) {
    showDeleteModalService({
        elements,
        setTaskToDeleteId: (value) => {
            taskToDeleteId = value;
        }
    }, task);
}

function hideDeleteModal() {
    hideDeleteModalService({
        elements,
        setTaskToDeleteId: (value) => {
            taskToDeleteId = value;
        }
    });
}

async function deleteTask(id) {
    await deleteTaskService({
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        authFetch,
        API_URL,
        renderBoard,
        elements,
        renderActivityLog,
        closeTaskPanel,
        notifyKafkaEvent,
        showToast
    }, id);
}

function moveTask(taskId, newStatus) {
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
        const oldStatus = task.status;
        task.status = newStatus;
        task.updatedAt = new Date().toISOString();

        // Add Kafka event
        if (!task.events) task.events = [];
        const event = {
            time: new Date().toLocaleTimeString(),
            type: 'TASK_MOVED',
            data: `from: "${statusLabels[oldStatus]}", to: "${statusLabels[newStatus]}"`,
            timestamp: new Date().toISOString()
        };
        task.events.push(event);
        globalEvents.unshift({
            ...event,
            taskId: taskId,
            taskTitle: task.title
        });

        saveTasks();
        renderBoard();
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        notifyKafkaEvent(`Task moved: ${task.title} (${statusLabels[oldStatus]} → ${statusLabels[newStatus]})`);
        sendKafkaEvent('TASK_MOVED', taskId, { from: oldStatus, to: newStatus });

        console.log('Kafka Event → task-moved:', { taskId, from: oldStatus, to: newStatus });
    }
}

// ===== Kafka API Integration =====
async function sendKafkaEvent(eventType, taskId, data = {}) {
    await sendKafkaEventService({
        sendKafkaEventRequest,
        API_URL,
        setKafkaConnected: (value) => {
            kafkaConnected = value;
        },
        updateKafkaStatusUI
    }, eventType, taskId, data);
}

// ===== WebSocket Connection =====
function connectWebSocket() {
    connectWebSocketService({
        getActiveBoardId: () => activeBoardId,
        getWsUrl,
        setWebsocket: (value) => {
            websocket = value;
        },
        setKafkaConnected: (value) => {
            kafkaConnected = value;
        },
        updateKafkaStatusUI,
        handleIncomingKafkaEvent,
        reconnect: connectWebSocket
    });
}

function handleIncomingKafkaEvent(kafkaEvent) {
    handleIncomingKafkaEventService({
        globalEvents,
        renderActivityLog,
        elements,
        currentUser,
        isDragInProgress: dragDropState.isDragInProgress,
        loadColumns,
        loadTasks,
        currentEditingTask,
        loadComments
    }, kafkaEvent);
}

function updateKafkaStatusUI() {
    // The Kafka indicator is now a static visual element in the header
    // No dynamic updates needed since it's always visible as a pulsing light
    // The connection status is managed by the WebSocket connection itself
}

// ===== Kafka Status Display =====
function notifyKafkaEvent(message, type = 'info') {
    notifyKafkaEventService({ showKafkaEvent, elements, updateKafkaStatusUI }, message, type);
}

// ===== Drag and Drop with Reordering =====
const dragDropState = {
    draggedTask: null,
    draggedTaskId: null,
    isDragging: false,
    isDragInProgress: false,
    draggedColumn: null
};

function cleanupDragState() {
    cleanupDragStateService(dragDropState);
}

function handleDragStart(e) {
    handleDragStartService({ state: dragDropState, TASK_DRAG_KEY }, e);
}

function handleDragEnd(e) {
    handleDragEndService(dragDropState);
}

function handleDragOver(e) {
    handleDragOverService({ state: dragDropState }, e);
}

function getDragAfterElement(container, y) {
    return getDragAfterElementService(container, y);
}

function handleDragEnter(e) {
    handleDragEnterService({ state: dragDropState }, e);
}

function handleDragLeave(e) {
    handleDragLeaveService({ state: dragDropState }, e);
}

function handleDrop(e) {
    handleDropService({
        state: dragDropState,
        TASK_DRAG_KEY,
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        renderBoard,
        persistTaskDrop,
        notifyKafkaEvent
    }, e);
}

async function persistTaskDrop(taskId, updates) {
    await persistTaskDropService({
        authFetch,
        API_URL,
        tasks,
        setTasks: (value) => {
            tasks = value;
        },
        elements,
        renderActivityLog,
        notifyKafkaEvent,
        showToast
    }, taskId, updates);
}

// ===== Column Drag and Drop =====
const COLUMN_DRAG_KEY = 'application/x-column-id';

function handleColumnDragStart(e) {
    handleColumnDragStartService({ state: dragDropState, COLUMN_DRAG_KEY }, e);
}

function handleColumnDragEnd(e) {
    handleColumnDragEndService(dragDropState);
}

function handleColumnDragOver(e) {
    handleColumnDragOverService({ state: dragDropState }, e);
}

function handleColumnDrop(e) {
    handleColumnDropService({
        state: dragDropState,
        columns,
        setColumns: (value) => {
            columns = value;
        },
        updateColumnPositions,
        renderBoard,
        showToast
    }, e);
}

// ===== Task Context Menu =====
function showTaskContextMenu(e, task) {
    e.preventDefault();
    e.stopPropagation();

    currentContextTask = task;

    // Populate status options based on available columns
    if (elements.contextStatusOptions) {
        elements.contextStatusOptions.innerHTML = columns.map(col => `
            <button class="context-status-option w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left ${task.column_id === col.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}" data-column-id="${col.id}">
                <span class="material-symbols-outlined text-[18px]">${task.column_id === col.id ? 'check' : 'arrow_forward'}</span>
                ${escapeHtml(col.title)}
            </button>
        `).join('');

        // Add event listeners to status options
        document.querySelectorAll('.context-status-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const columnId = btn.dataset.columnId;
                if (currentContextTask && currentContextTask.column_id !== columnId) {
                    updateTask(currentContextTask.id, { column_id: columnId });
                }
                hideTaskContextMenu();
            });
        });
    }

    // Position the menu at cursor
    const menu = elements.taskContextMenu;
    menu.style.display = 'block';
    menu.classList.remove('hidden');

    // Calculate position to keep menu on screen
    const menuWidth = 224; // w-56 = 14rem = 224px
    const menuHeight = menu.offsetHeight || 400;

    let x = e.pageX;
    let y = e.pageY;

    // Adjust if menu would go off right edge
    if (x + menuWidth > window.innerWidth + window.scrollX) {
        x = window.innerWidth + window.scrollX - menuWidth - 10;
    }

    // Adjust if menu would go off bottom edge
    if (y + menuHeight > window.innerHeight + window.scrollY) {
        y = window.innerHeight + window.scrollY - menuHeight - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideTaskContextMenu() {
    if (elements.taskContextMenu) {
        elements.taskContextMenu.style.display = 'none';
        elements.taskContextMenu.classList.add('hidden');
    }
    currentContextTask = null;
}

// ===== Column Context Menu =====
function showColumnContextMenu(e, columnId) {
    e.preventDefault();
    e.stopPropagation();

    // Close other menus
    hideTaskContextMenu();
    hideBoardContextMenu();
    closeAllColumnMenus();

    currentContextColumnId = columnId;

    const colIndex = columns.findIndex(c => c.id === columnId);

    // Toggle move left/right disabled states
    if (elements.contextColumnMoveLeft) {
        elements.contextColumnMoveLeft.disabled = colIndex <= 0;
        elements.contextColumnMoveLeft.style.opacity = colIndex <= 0 ? '0.4' : '';
        elements.contextColumnMoveLeft.style.cursor = colIndex <= 0 ? 'not-allowed' : '';
    }
    if (elements.contextColumnMoveRight) {
        const atEnd = colIndex >= columns.length - 1;
        elements.contextColumnMoveRight.disabled = atEnd;
        elements.contextColumnMoveRight.style.opacity = atEnd ? '0.4' : '';
        elements.contextColumnMoveRight.style.cursor = atEnd ? 'not-allowed' : '';
    }

    const menu = elements.columnContextMenu;
    menu.style.display = 'block';
    menu.classList.remove('hidden');

    const menuWidth = 208;
    const menuHeight = menu.offsetHeight || 200;
    let x = e.pageX;
    let y = e.pageY;

    if (x + menuWidth > window.innerWidth + window.scrollX) {
        x = window.innerWidth + window.scrollX - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight + window.scrollY) {
        y = window.innerHeight + window.scrollY - menuHeight - 10;
    }

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

function hideColumnContextMenu() {
    if (elements.columnContextMenu) {
        elements.columnContextMenu.style.display = 'none';
        elements.columnContextMenu.classList.add('hidden');
    }
    currentContextColumnId = null;
}

// ===== Theme Toggle =====
function initTheme() {
    const savedTheme = localStorage.getItem('kafka-kanban-theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        updateThemeUI(true);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('kafka-kanban-theme', isDark ? 'dark' : 'light');
    updateThemeUI(isDark);
}

function updateThemeUI(isDark) {
    elements.themeIcon.textContent = isDark ? 'light_mode' : 'dark_mode';
    elements.themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}

// ===== Sidebar Toggle =====
function toggleSidebar() {
    const isCollapsed = elements.sidebar.classList.toggle('collapsed');
    localStorage.setItem('kafka-kanban-sidebar', isCollapsed ? 'collapsed' : 'expanded');
    renderBoardList();
}

function loadSidebarState() {
    const sidebarState = localStorage.getItem('kafka-kanban-sidebar');
    if (sidebarState === 'collapsed') {
        elements.sidebar.classList.add('collapsed');
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    bindBoardListeners({
        elements,
        showCreateListModal,
        switchBoard,
        showDeleteBoardModal,
        toggleBoardsPopout,
        scrollToAddCard,
        moveColumnLeft,
        moveColumnRight,
        editColumnTitle,
        deleteColumn,
        openImageModal,
        removeTaskImage,
        deleteComment,
        removeCommentImage,
        deleteLabel,
        showBoardContextMenu,
        switchView,
        toggleTheme,
        toggleSidebar,
        openLabelManager,
        closeLabelManager,
        createLabel
    });

    bindTaskListeners({
        elements,
        closeTaskPanel,
        saveTaskFromPanel,
        getCurrentEditingTask: () => currentEditingTask,
        showDeleteModal,
        showToast,
        uploadTaskImage,
        renderTaskImages,
        postComment,
        uploadCommentImage,
        getCurrentCommentImages: () => currentCommentImages,
        renderCommentImages,
        getTaskToDeleteId: () => taskToDeleteId,
        deleteTask,
        hideDeleteModal,
        getActiveInlineForm: () => activeInlineForm,
        hideInlineAddForm,
        closeAllColumnMenus,
        hideTaskContextMenu,
        hideBoardContextMenu,
        hideColumnContextMenu,
        getCurrentContextTask: () => currentContextTask,
        openTaskPanel,
        updateTask
    });

    bindModalListeners({
        elements,
        showCreateBoardModal,
        hideCreateBoardModal,
        createBoard,
        hideCreateListModal,
        showCreateListModal,
        createColumn,
        hideEditBoardModal,
        updateBoard,
        getCurrentContextBoardId: () => currentContextBoardId,
        showEditBoardModal,
        hideBoardContextMenu,
        getBoards: () => boards,
        showDeleteBoardModal,
        hideColumnContextMenu,
        getCurrentContextColumnId: () => currentContextColumnId,
        scrollToAddCard,
        editColumnTitle,
        moveColumnLeft,
        moveColumnRight,
        deleteColumn,
        hideDeleteBoardModal,
        getBoardToDeleteId: () => boardToDeleteId,
        deleteBoard,
        hideDeleteListModal,
        hideTaskContextMenu,
        closeTaskPanel,
        hideDeleteModal,
        closeLabelManager,
        hideInlineAddForm
    });
}

function attachBoardEventListeners() {
    bindDragDropListeners({
        showInlineAddForm,
        isTaskDragging: () => dragDropState.isDragging,
        isColumnDragging: () => Boolean(dragDropState.draggedColumn),
        handleDragOver,
        handleColumnDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        handleColumnDrop,
        showColumnContextMenu,
        handleColumnDragStart,
        handleColumnDragEnd
    });
}
// ===== End of Event Listeners =====

// ===== Initialize Application =====
async function init() {
    bindStaticDomEvents({
        openLabelManager,
        closeLabelManager
    });
    initTheme();
    loadSidebarState();

    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    try {
        // Fetch User Info
        const userRes = await authFetch(`${API_URL}/api/auth/me`);
        if (!userRes) return;
        currentUser = await userRes.json();
        console.log('Logged in as:', currentUser.full_name);

        // Fetch Workspaces
        const wsRes = await authFetch(`${API_URL}/api/workspaces`);
        const workspaces = await wsRes.json();

        if (workspaces.length > 0) {
            activeWorkspaceId = workspaces[0].id;
        }

        await loadWorkspaceMembers();
        await loadBoards(); // Sets activeBoardId and renders list
        await loadLabels(); // Load workspace and board labels

        if (activeBoardId) {
            await loadColumns().then(loadTasks);
            connectWebSocket();
        } else {
            // No boards - render empty state
            renderBoard();
        }

        initEventListeners();

        // Add resize listener for dynamic board list overflow
        window.addEventListener('resize', () => {
            if (elements.sidebar.classList.contains('collapsed')) {
                renderBoardList();
            }
        });

        console.log('Kafka Kanban Board initialized');
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

export { init };

