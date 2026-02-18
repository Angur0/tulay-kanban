/**
 * Kafka Kanban Board - Frontend Application
 * Superthread-style task management with inline creation and slide-out panel
 */

// ===== State Management =====
const STORAGE_KEY = 'kafka-kanban-tasks';
const API_URL = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;
const getWsUrl = (boardId) => `ws://${window.location.host}/ws/${boardId}`;

let tasks = [];
let globalEvents = [];
let currentUser = null;
let activeBoardId = null;
let currentEditingTask = null;
let activeInlineForm = null;
let websocket = null;
let kafkaConnected = false;

const BOARD_ICONS = new Set([
    'dashboard',
    'folder',
    'campaign',
    'code',
    'shopping_bag',
    'rocket_launch',
    'design_services',
    'event',
    'school',
    'inventory_2'
]);

function normalizeBoardIcon(icon) {
    return BOARD_ICONS.has(icon) ? icon : 'dashboard';
}

// Authenticated Fetch Wrapper
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/login';
        return null;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return null;
    }
    return response;
}

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

// ===== Label Colors =====
const labelColors = {
    backend: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        ring: 'ring-blue-700/10 dark:ring-blue-400/20'
    },
    frontend: {
        bg: 'bg-green-50 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        ring: 'ring-green-600/20 dark:ring-green-500/20'
    },
    design: {
        bg: 'bg-purple-50 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400',
        ring: 'ring-purple-700/10 dark:ring-purple-400/20'
    },
    devops: {
        bg: 'bg-gray-50 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        ring: 'ring-gray-500/10 dark:ring-gray-400/20'
    }
};

// ===== Status Labels =====
const statusLabels = {
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done'
};

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
                <button onclick="document.getElementById('createBoardBtn').click()" 
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
                <button onclick="showCreateListModal()" 
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
                    <span class="flex items-center justify-center size-5 rounded bg-${col.color || 'gray-100'} dark:bg-gray-800 text-[10px] font-bold text-gray-600 dark:text-gray-300" 
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
                        <button onclick="scrollToAddCard('${col.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left">
                            <span class="material-symbols-outlined text-[18px]">add</span>
                            Add card
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button onclick="moveColumnLeft('${col.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                            Move left
                        </button>
                        <button onclick="moveColumnRight('${col.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left" ${index === columns.length - 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                            Move right
                        </button>
                        <div class="border-t border-[#e5e7eb] dark:border-[#1e2936] my-1"></div>
                        <button onclick="editColumnTitle('${col.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#111418] dark:text-white hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] transition-colors text-left">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                            Rename list
                        </button>
                        <button onclick="deleteColumn('${col.id}')" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left">
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

    // Generate colors dynamically for all columns
    const colorClasses = [
        'bg-amber-500',
        'bg-primary',
        'bg-green-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-indigo-500',
        'bg-red-500',
        'bg-yellow-500'
    ];

    elements.headerStats.innerHTML = columns.map((col, index) => {
        const count = tasks.filter(t => t.column_id === col.id).length;
        const colorClass = colorClasses[index % colorClasses.length];

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
    elements.createListModal.classList.remove('hidden');
    elements.newListTitle.value = '';
    elements.newListTitle.focus();
}

function hideCreateListModal() {
    elements.createListModal.classList.add('hidden');
    elements.newListTitle.value = '';
}

async function createColumn() {
    const title = elements.newListTitle.value.trim();
    if (!title) return;

    hideCreateListModal();

    try {
        const response = await authFetch(`${API_URL}/api/boards/${activeBoardId}/columns`, {
            method: 'POST',
            body: JSON.stringify({
                title,
                position: columns.length,
                color: 'blue-100' // Default color for now
            })
        });

        if (!response) return;
        await loadColumns();
        renderBoard();
        showToast('List created', 'success');
    } catch (e) {
        console.error('Error creating column:', e);
        showToast('Failed to create list', 'error');
    }
}

async function deleteColumn(columnId) {
    // Close any open menus
    closeAllColumnMenus();

    // Show the delete list modal
    showDeleteListModal(columnId);
}

function showDeleteListModal(columnId) {
    const column = columns.find(c => c.id === columnId);
    if (!column) return;

    const modal = document.getElementById('deleteListModal');
    const listNameEl = document.getElementById('deleteListName');
    const confirmInput = document.getElementById('deleteListConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteListBtn');

    listNameEl.textContent = column.title;
    confirmInput.value = '';
    confirmBtn.disabled = true;
    modal.classList.remove('hidden');

    // Enable confirm button when input matches list name
    const inputHandler = () => {
        confirmBtn.disabled = confirmInput.value !== column.title;
    };

    confirmInput.addEventListener('input', inputHandler);

    // Store columnId for confirmation
    confirmBtn.onclick = async () => {
        await confirmDeleteList(columnId);
        hideDeleteListModal();
    };

    // Focus input
    setTimeout(() => confirmInput.focus(), 100);
}

function hideDeleteListModal() {
    const modal = document.getElementById('deleteListModal');
    const confirmInput = document.getElementById('deleteListConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteListBtn');

    modal.classList.add('hidden');
    confirmInput.value = '';
    confirmBtn.disabled = true;
    confirmBtn.onclick = null;
}

async function confirmDeleteList(columnId) {
    try {
        const response = await authFetch(`${API_URL}/api/columns/${columnId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            await loadColumns();
            renderBoard();
            showToast('List deleted', 'success');
        } else {
            const data = await response.json();
            showToast(data.detail || 'Failed to delete list', 'error');
        }
    } catch (e) {
        console.error('Error deleting column:', e);
        showToast('Make sure list is empty before deleting', 'error');
    }
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
                <button onclick="deleteLabel('${label.id}')" class="text-red-500 hover:text-red-700 transition-colors">
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
                <button onclick="deleteLabel('${label.id}')" class="text-red-500 hover:text-red-700 transition-colors">
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

// Expose label management functions to global scope for inline onclick handlers
window.openLabelManager = openLabelManager;
window.closeLabelManager = closeLabelManager;
window.deleteLabel = deleteLabel;

// ===== Board Management =====
async function loadBoards() {
    if (!activeWorkspaceId) return;
    try {
        const response = await authFetch(`${API_URL}/api/workspaces/${activeWorkspaceId}/boards`);
        if (!response) return;
        boards = await response.json();
        // If no active board, select the first one
        if (!activeBoardId && boards.length > 0) {
            activeBoardId = boards[0].id;
        }
        renderBoardList();
    } catch (e) {
        console.error('Error loading boards:', e);
        showToast('Failed to load boards', 'error');
    }
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
                 ${isDraggable ? 'draggable="true"' : ''}
                 oncontextmenu="showBoardContextMenu(event, '${board.id}'); return false;">
                 
                <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg flex-1 justify-start sidebar-item ${isActive ? 'bg-[#eff1f3] dark:bg-[#1e2936] text-[#111418] dark:text-white' : 'text-[#5c6b7f] dark:text-gray-400 hover:bg-[#eff1f3] dark:hover:bg-[#1e2936] hover:text-[#111418] dark:hover:text-white'} transition-colors group"
                    onclick="switchBoard('${board.id}'); return false;" data-sidebar-tooltip="${escapeHtml(board.name)}">
                    <span class="material-symbols-outlined transition-colors flex-shrink-0" style="color: ${iconColor}">${escapeHtml(normalizeBoardIcon(board.icon))}</span>
                    <span class="text-sm font-medium truncate sidebar-text whitespace-nowrap">${escapeHtml(board.name)}</span>
                </a>
                <button onclick="showDeleteBoardModal('${board.id}', '${escapeHtml(board.name)}'); event.stopPropagation(); return false;" 
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
                    title="More boards" onclick="toggleBoardsPopout(event)" data-sidebar-tooltip="More Boards">
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
    if (!activeWorkspaceId) return;
    console.log('createBoard called with icon:', icon, 'normalized:', normalizeBoardIcon(icon), 'color:', iconColor);
    try {
        const response = await authFetch(`${API_URL}/api/boards`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                icon: normalizeBoardIcon(icon),
                icon_color: iconColor,
                workspace_id: activeWorkspaceId
            })
        });

        if (!response) return;
        const newBoard = await response.json();
        console.log('Board created:', newBoard);
        // Set the new board as active BEFORE loadBoards so the auto-select in
        // loadBoards doesn't stomp it, and so switchBoard's early-return guard
        // (activeBoardId === boardId) won't fire and skip loadColumns/loadTasks.
        // We bypass switchBoard entirely and do the initialization inline.
        activeBoardId = newBoard.id;
        await loadBoards();
        renderBoardList();
        await loadColumns();
        await loadTasks();
        loadActivities();
        loadLabels();
        switchView('board');
        showToast('Board created successfully', 'success');
        hideCreateBoardModal();
    } catch (e) {
        console.error('Error creating board:', e);
        showToast('Failed to create board', 'error');
    }
}

let boardToDeleteId = null;

async function deleteBoard(boardId) {
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'DELETE'
        });

        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Failed to delete board');
        }

        // Remove board from local array
        boards = boards.filter(b => b.id !== boardId);

        // If we deleted the active board, switch to another board
        if (activeBoardId === boardId) {
            closeTaskPanel();
            if (boards.length > 0) {
                switchBoard(boards[0].id);
            } else {
                // Close WebSocket if it's open
                if (websocket) {
                    websocket.onclose = null;
                    websocket.close();
                    websocket = null;
                }

                activeBoardId = null;
                tasks = [];
                columns = [];
                kafkaConnected = false;
                updateKafkaStatusUI();
                renderBoard();
            }
        }

        renderBoardList();
        showToast('Board deleted successfully', 'success');
        hideDeleteBoardModal();
    } catch (e) {
        console.error('Error deleting board:', e);
        showToast(e.message || 'Failed to delete board', 'error');
    }
}

function showDeleteBoardModal(boardId, boardName) {
    boardToDeleteId = boardId;
    elements.deleteBoardName.textContent = boardName;
    elements.deleteBoardConfirmInput.value = '';
    elements.confirmDeleteBoardBtn.disabled = true;
    elements.deleteBoardModal.classList.remove('hidden');

    // Store board name for validation
    elements.deleteBoardConfirmInput.dataset.boardName = boardName;

    // Focus input
    setTimeout(() => elements.deleteBoardConfirmInput.focus(), 100);
}

function hideDeleteBoardModal() {
    elements.deleteBoardModal.classList.add('hidden');
    elements.deleteBoardConfirmInput.value = '';
    elements.confirmDeleteBoardBtn.disabled = true;
    boardToDeleteId = null;
}

function switchBoard(boardId) {
    if (activeBoardId === boardId) return;
    activeBoardId = boardId;

    // Close popout if open
    const popout = document.getElementById('boardsPopout');
    if (popout) popout.style.display = 'none';

    renderBoardList();
    loadColumns().then(loadTasks);
    loadActivities();
    loadLabels(); // Reload labels for the new board

    // Switch to board view if not already there
    switchView('board');
}

// ===== Create Board Modal =====
function showCreateBoardModal() {
    elements.newBoardName.value = '';
    if (elements.newBoardIcon) {
        elements.newBoardIcon.value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            elements.selectedIconPreview.style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) {
        elements.newBoardIconColor.value = '#3b82f6';
        // Reset color selection
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.color === '#3b82f6') {
                btn.classList.add('active');
            }
        });
    }
    if (elements.iconDropdownMenu) {
        elements.iconDropdownMenu.classList.add('hidden');
    }
    elements.createBoardModal.classList.remove('hidden');
    setTimeout(() => elements.newBoardName.focus(), 50);
}

function hideCreateBoardModal() {
    elements.createBoardModal.classList.add('hidden');
    if (elements.iconDropdownMenu) {
        elements.iconDropdownMenu.classList.add('hidden');
    }
    // Reset form values when closing
    elements.newBoardName.value = '';
    if (elements.newBoardIcon) {
        elements.newBoardIcon.value = 'dashboard';
        if (elements.selectedIconPreview) {
            elements.selectedIconPreview.textContent = 'dashboard';
            elements.selectedIconPreview.style.color = '#3b82f6';
        }
    }
    if (elements.newBoardIconColor) {
        elements.newBoardIconColor.value = '#3b82f6';
    }
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
    const board = boards.find(b => b.id === boardId);
    if (!board) return;

    elements.editBoardName.value = board.name;
    elements.editBoardIcon.value = board.icon || 'dashboard';
    elements.editBoardIconColor.value = board.icon_color || '#3b82f6';

    if (elements.editSelectedIconPreview) {
        elements.editSelectedIconPreview.textContent = normalizeBoardIcon(board.icon || 'dashboard');
        elements.editSelectedIconPreview.style.color = board.icon_color || '#3b82f6';
    }

    // Highlight the current icon
    document.querySelectorAll('.edit-icon-option').forEach(btn => {
        btn.classList.remove('bg-blue-100', 'dark:bg-blue-900/30');
        if (btn.dataset.icon === (board.icon || 'dashboard')) {
            btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
        }
    });

    // Highlight the current color
    document.querySelectorAll('.edit-color-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.color === (board.icon_color || '#3b82f6')) {
            btn.classList.add('active');
        }
    });

    if (elements.editIconDropdownMenu) {
        elements.editIconDropdownMenu.classList.add('hidden');
    }

    elements.editBoardModal.classList.remove('hidden');
    elements.editBoardModal.dataset.boardId = boardId;
    setTimeout(() => elements.editBoardName.focus(), 50);
}

function hideEditBoardModal() {
    elements.editBoardModal.classList.add('hidden');
    if (elements.editIconDropdownMenu) {
        elements.editIconDropdownMenu.classList.add('hidden');
    }
    elements.editBoardName.value = '';
    elements.editBoardModal.dataset.boardId = '';
}

async function updateBoard(boardId, data) {
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        if (!response || !response.ok) {
            throw new Error('Failed to update board');
        }
        const updated = await response.json();
        // Update local board data
        const idx = boards.findIndex(b => b.id === boardId);
        if (idx !== -1) {
            boards[idx] = { ...boards[idx], ...updated };
        }
        renderBoardList();
        if (activeBoardId === boardId) {
            renderBoard();
        }
        showToast('Board updated successfully', 'success');
    } catch (e) {
        console.error('Error updating board:', e);
        showToast('Failed to update board', 'error');
    }
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
        labelsHTML = `<div class="flex flex-wrap gap-1">${task.labels.map(label => `
            <span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium text-white" 
                  style="background-color: ${label.color || '#93c5fd'}">
                ${escapeHtml(label.name)}
            </span>
        `).join('')}</div>`;
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
                <!-- Labels (flush to corner, slide away on hover) -->
                <div class="absolute left-0 max-w-full transition-all duration-200 group-hover:translate-x-16 group-hover:opacity-0">
                    ${labelsHTML || ''}
                </div>
            </div>
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
                onclick="openImageModal('${url}')">
            <button type="button" 
                class="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                onclick="removeTaskImage(${index})"
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
                            onclick="openImageModal('${url}')">
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
                        <button onclick="deleteComment('${comment.id}')" 
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
                onclick="removeCommentImage(${index})"
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function saveTaskFromPanel() {
    if (!currentEditingTask) return;

    // Validate due date is not in the past
    const dueDateValue = elements.panelDueDate.value;
    if (dueDateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dueDateValue);
        if (selectedDate < today) {
            showToast('Due date cannot be in the past', 'error');
            elements.panelDueDate.focus();
            return;
        }
    }

    // Get the new column_id from the status dropdown
    const newColumnId = elements.panelStatusSelect.value;
    const newColumn = columns.find(c => c.id === newColumnId);

    const updates = {
        title: elements.panelTitle.value.trim(),
        description: elements.panelDescription.value.trim(),
        column_id: newColumnId,
        status: newColumn ? newColumn.title.toLowerCase().replace(/\s+/g, '') : currentEditingTask.status,
        priority: elements.panelPrioritySelect.value,
        label_ids: getSelectedLabelIds(),
        due_date: dueDateValue || null,
        assignee_id: elements.panelAssigneeSelect.value || null,
        images: currentEditingTask.images || []
    };

    if (!updates.title) {
        elements.panelTitle.focus();
        return;
    }

    updateTask(currentEditingTask.id, updates);
    closeTaskPanel();
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
    if (!activeBoardId) return;

    const taskData = {
        title,
        description,
        priority,
        status,
        label_ids: labelIds,
        board_id: activeBoardId
    };

    try {
        const response = await authFetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (!response) return; // authFetch handles redirect

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }

        const newTask = await response.json();
        tasks.push(newTask);
        renderBoard();
        showKafkaEvent('Task created: ' + newTask.title, 'success');

        // Notification is handled by WebSocket now, but for immediate UI feedback:
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

async function addTaskToColumn(title, description, priority, columnId, labelIds = []) {
    if (!activeBoardId) return;

    const taskData = {
        title,
        description,
        priority,
        label_ids: labelIds,
        board_id: activeBoardId,
        column_id: columnId
    };

    try {
        const response = await authFetch(`${API_URL}/api/tasks`, {
            method: 'POST',
            body: JSON.stringify(taskData)
        });

        if (!response) return; // authFetch handles redirect

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to create task:', response.status, errorText);
            showToast('Failed to create task', 'error');
            return;
        }

        const newTask = await response.json();
        tasks.push(newTask);
        renderBoard();
        showKafkaEvent('Task created: ' + newTask.title, 'success');

        // Notification is handled by WebSocket now, but for immediate UI feedback:
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
    } catch (e) {
        console.error('Error adding task:', e);
        showToast('Failed to create task', 'error');
    }
}

async function updateTask(id, updates) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error('Failed to update task');

        const updatedTask = await response.json();

        const index = tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            // Merge server fields without clobbering in-memory order
            tasks[index] = { ...tasks[index], ...updatedTask };
        }

        renderBoard();
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        showKafkaEvent('Task updated: ' + updatedTask.title, 'success');
    } catch (e) {
        console.error('Error updating task:', e);
        showToast('Failed to update task', 'error');
    }
}

// ===== Delete Confirmation =====
function showDeleteModal(task) {
    taskToDeleteId = task.id;
    elements.deleteTaskTitle.textContent = task.title;
    elements.deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    elements.deleteModal.classList.add('hidden');
    taskToDeleteId = null;
}

async function deleteTask(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    // No confirm() call here - modal handles it

    try {
        const response = await authFetch(`${API_URL}/api/tasks/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete task');

        tasks = tasks.filter(t => t.id !== id);
        renderBoard();
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        closeTaskPanel();
        showKafkaEvent('Task deleted: ' + task.title, 'success');
    } catch (e) {
        console.error('Error deleting task:', e);
        showToast('Failed to delete task', 'error');
    }
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
        showKafkaEvent(`Task moved: ${task.title} (${statusLabels[oldStatus]} → ${statusLabels[newStatus]})`);
        sendKafkaEvent('TASK_MOVED', taskId, { from: oldStatus, to: newStatus });

        console.log('Kafka Event → task-moved:', { taskId, from: oldStatus, to: newStatus });
    }
}

// ===== Kafka API Integration =====
async function sendKafkaEvent(eventType, taskId, data = {}) {
    const event = {
        type: eventType,
        taskId: taskId,
        data: data,
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/api/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });
        const result = await response.json();
        console.log('Kafka API response:', result);

        if (result.status === 'sent') {
            kafkaConnected = true;
            updateKafkaStatusUI();
        }
    } catch (error) {
        console.error('Failed to send Kafka event:', error);
        kafkaConnected = false;
        updateKafkaStatusUI();
    }
}

// ===== WebSocket Connection =====
function connectWebSocket() {
    if (!activeBoardId) return;

    try {
        const wsUrl = getWsUrl(activeBoardId);
        websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
            console.log('WebSocket connected to board:', activeBoardId);
            kafkaConnected = true;
            updateKafkaStatusUI();
        };

        websocket.onmessage = (event) => {
            console.log('WebSocket message:', event.data);
            try {
                const kafkaEvent = JSON.parse(event.data);
                handleIncomingKafkaEvent(kafkaEvent);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        websocket.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 3s...');
            kafkaConnected = false;
            updateKafkaStatusUI();
            setTimeout(connectWebSocket, 3000);
        };

        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            kafkaConnected = false;
            updateKafkaStatusUI();
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
    }
}

function handleIncomingKafkaEvent(kafkaEvent) {
    // Add to global events (Activity log)
    globalEvents.unshift({
        type: kafkaEvent.type,
        taskId: kafkaEvent.taskId,
        originalTaskId: kafkaEvent.taskId,
        data: kafkaEvent.data || {},
        time: new Date().toLocaleTimeString(),
        timestamp: new Date().toISOString()
    });

    if (!elements.activityView.classList.contains('hidden')) renderActivityLog();

    // Sync tasks on relevant events (non-blocking)
    // Skip re-sync if: (1) a drag is in progress (avoid clobbering optimistic update),
    // or (2) the event was triggered by the current user (optimistic update already applied).
    if (['TASK_CREATED', 'TASK_UPDATED', 'TASK_MOVED', 'TASK_DELETED'].includes(kafkaEvent.type)) {
        const isOwnEvent = currentUser && kafkaEvent.user_id === currentUser.id;
        if (!isDragInProgress && !isOwnEvent) {
            loadColumns().then(loadTasks); // Fire and forget - don't block
        }
    }

    // Handle comment events
    if (['COMMENT_ADDED', 'COMMENT_UPDATED', 'COMMENT_DELETED'].includes(kafkaEvent.type)) {
        // If the task panel is open for this task, reload comments
        if (currentEditingTask && currentEditingTask.id === kafkaEvent.taskId) {
            loadComments(kafkaEvent.taskId);
        }
    }
}

function updateKafkaStatusUI() {
    // The Kafka indicator is now a static visual element in the header
    // No dynamic updates needed since it's always visible as a pulsing light
    // The connection status is managed by the WebSocket connection itself
}

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    // Remove any existing toasts to prevent stacking
    elements.toastContainer.innerHTML = '';

    const toast = document.createElement('div');

    const colors = {
        info: 'bg-[#111418] dark:bg-[#1e2936] border-[#e5e7eb] dark:border-[#2a3645] text-white',
        success: 'bg-emerald-600 border-emerald-500 text-white',
        error: 'bg-red-600 border-red-500 text-white'
    };

    const icons = {
        info: 'info',
        success: 'check_circle',
        error: 'error'
    };

    toast.className = `${colors[type]} px-4 py-3 rounded-lg border flex items-center gap-3 transform transition-all duration-300 translate-y-8 opacity-0 pointer-events-auto min-w-[300px] max-w-[400px]`;

    toast.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">${icons[type]}</span>
        <span class="text-sm font-medium flex-1">${escapeHtml(message)}</span>
        <button class="text-white/70 hover:text-white transition-colors" onclick="this.parentElement.remove()">
            <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
    `;

    elements.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-8', 'opacity-0');
    });

    // Auto dismiss
    setTimeout(() => {
        toast.classList.add('translate-y-8', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== Kafka Status Display =====
function showKafkaEvent(message, type = 'info') {
    // Only update status text if it's a connectivity message
    if (message.includes('Connected') || message.includes('Disconnected')) {
        elements.kafkaStatus.textContent = message;
        setTimeout(() => {
            updateKafkaStatusUI();
        }, 2000);
    }

    // Show toast for event
    showToast(message, type);
}

// ===== Drag and Drop with Reordering =====
let draggedTask = null;
let draggedTaskId = null;
let isDragging = false;
let isDragInProgress = false; // Prevents WebSocket re-renders during active drag

const TASK_DRAG_KEY = 'application/x-task-id';

function cleanupDragState() {
    if (draggedTask) {
        draggedTask.classList.remove('dragging');
        draggedTask.style.opacity = '';
    }
    draggedTask = null;
    draggedTaskId = null;
    isDragging = false;
    isDragInProgress = false;
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
}

function handleDragStart(e) {
    const card = e.currentTarget; // always the card since listener is on the card
    if (!card || !card.classList.contains('task-card')) return;

    // Clean up any stale state
    cleanupDragState();

    draggedTask = card;
    draggedTaskId = card.dataset.taskId;
    isDragging = true;
    isDragInProgress = true;

    e.dataTransfer.effectAllowed = 'move';
    // Use a dedicated MIME type so task drops and column drops never collide
    e.dataTransfer.setData(TASK_DRAG_KEY, draggedTaskId);
    // Fallback for browsers that only expose text/plain in drop handlers
    e.dataTransfer.setData('text/plain', draggedTaskId);

    // Slight delay so the drag image is captured before we hide the card
    setTimeout(() => {
        if (draggedTask) {
            draggedTask.classList.add('dragging');
            draggedTask.style.opacity = '0.4';
        }
    }, 0);
}

function handleDragEnd(e) {
    cleanupDragState();
}

function handleDragOver(e) {
    // Only handle if a task drag is active
    if (!isDragging) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Find task-list: either the target itself or its ancestor.
    // Also fall back to the column's task-list if hovering over the header area.
    let taskList = e.target.closest('.task-list');
    if (!taskList) {
        const column = e.target.closest('.column');
        if (column) taskList = column.querySelector('.task-list');
    }
    if (!taskList) return;

    const afterElement = getDragAfterElement(taskList, e.clientY);

    // Remove existing indicators
    document.querySelectorAll('.drop-indicator').forEach(indicator => indicator.remove());

    // Create drop indicator
    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator h-1 bg-primary rounded-full my-1 transition-all';

    if (afterElement == null) {
        taskList.appendChild(indicator);
    } else {
        taskList.insertBefore(indicator, afterElement);
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleDragEnter(e) {
    if (!isDragging) return;
    e.preventDefault();
    const column = e.target.closest('.column');
    if (column) {
        column.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (!isDragging) return;
    const column = e.target.closest('.column');
    const relatedColumn = e.relatedTarget?.closest('.column');

    if (column && column !== relatedColumn) {
        column.classList.remove('drag-over');
        column.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    }
}

function handleDrop(e) {
    // Only handle task drops — ignore column drags
    if (!isDragging) return;

    e.preventDefault();
    e.stopPropagation(); // prevent handleColumnDrop from also firing

    // Read task ID from our dedicated key (fallback to text/plain)
    const taskId = e.dataTransfer.getData(TASK_DRAG_KEY) ||
        e.dataTransfer.getData('text/plain');
    const column = e.target.closest('.column');

    // Clean up visual state immediately
    document.querySelectorAll('.drop-indicator').forEach(el => el.remove());
    document.querySelectorAll('.column').forEach(col => col.classList.remove('drag-over'));

    if (!column || !taskId) {
        cleanupDragState();
        return;
    }

    const newColumnId = column.dataset.columnId;
    const taskList = column.querySelector('.task-list');
    if (!newColumnId || !taskList) {
        cleanupDragState();
        return;
    }

    // Snapshot the after-element task ID from the DOM BEFORE we mutate anything
    const afterElement = getDragAfterElement(taskList, e.clientY);
    const afterTaskId = afterElement ? afterElement.dataset.taskId : null;

    // Get the task being moved
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
        cleanupDragState();
        return;
    }

    const task = tasks[taskIndex];
    const oldColumnId = task.column_id;
    const columnChanged = oldColumnId !== newColumnId;

    // Remove task from array
    tasks.splice(taskIndex, 1);

    // Update column_id
    task.column_id = newColumnId;
    task.updated_at = new Date().toISOString();

    // Find insertion position using the snapshotted afterTaskId
    if (afterTaskId) {
        const afterIndex = tasks.findIndex(t => t.id === afterTaskId);
        if (afterIndex !== -1) {
            tasks.splice(afterIndex, 0, task);
        } else {
            tasks.push(task);
        }
    } else {
        // Insert at end of the column group
        const lastIndexOfColumn = tasks.reduce((last, t, i) => t.column_id === newColumnId ? i : last, -1);
        if (lastIndexOfColumn === -1) {
            tasks.push(task);
        } else {
            tasks.splice(lastIndexOfColumn + 1, 0, task);
        }
    }

    // Clean up drag state now that array is stable
    cleanupDragState();

    // Optimistically re-render immediately with the new order
    renderBoard();

    // Persist to backend without re-rendering on response
    if (columnChanged) {
        persistTaskDrop(taskId, { column_id: newColumnId });
    } else {
        showKafkaEvent(`Task reordered: ${task.title}`);
    }
}

async function persistTaskDrop(taskId, updates) {
    try {
        const response = await authFetch(`${API_URL}/api/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        if (!response || !response.ok) throw new Error('Failed to update task');
        const updatedTask = await response.json();
        // Patch only the changed fields on the in-memory task, no re-render
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = { ...tasks[index], ...updatedTask };
        }
        if (!elements.activityView.classList.contains('hidden')) renderActivityLog();
        showKafkaEvent('Task moved: ' + updatedTask.title, 'success');
    } catch (err) {
        console.error('Error persisting task drop:', err);
        showToast('Failed to save task move', 'error');
    }
}

// ===== Column Drag and Drop =====
let draggedColumn = null;

const COLUMN_DRAG_KEY = 'application/x-column-id';

function handleColumnDragStart(e) {
    // Only allow drag from the handle itself (not task cards inside the column)
    const handle = e.target.closest('.column-drag-handle');
    if (!handle) {
        e.preventDefault();
        return;
    }

    draggedColumn = handle.closest('.column');
    if (!draggedColumn) {
        e.preventDefault();
        return;
    }

    e.dataTransfer.effectAllowed = 'move';
    // Use a dedicated MIME type so column drops never collide with task drops
    e.dataTransfer.setData(COLUMN_DRAG_KEY, draggedColumn.dataset.columnId);

    // Apply the same dragging style as task cards
    setTimeout(() => {
        if (draggedColumn) draggedColumn.classList.add('dragging');
    }, 0);
}

function handleColumnDragEnd(e) {
    if (draggedColumn) {
        draggedColumn.classList.remove('dragging');
        draggedColumn = null;
    }
    // Remove all column drop indicators
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());
}

function handleColumnDragOver(e) {
    if (!draggedColumn) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const board = document.getElementById('board');
    const targetColumn = e.target.closest('.column');
    if (!targetColumn || targetColumn === draggedColumn || !board) return;

    // Remove existing indicators
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());

    // Determine whether to insert before or after the target column
    const rect = targetColumn.getBoundingClientRect();
    const insertBefore = e.clientX < rect.left + rect.width / 2;

    // Create a vertical indicator line (same primary colour as task indicator)
    const indicator = document.createElement('div');
    indicator.className = 'column-drop-indicator';

    if (insertBefore) {
        board.insertBefore(indicator, targetColumn);
    } else {
        board.insertBefore(indicator, targetColumn.nextSibling);
    }
}

function handleColumnDrop(e) {
    if (!draggedColumn) return;

    e.preventDefault();

    // Clean up indicator immediately
    document.querySelectorAll('.column-drop-indicator').forEach(el => el.remove());

    const targetColumn = e.target.closest('.column');
    if (!targetColumn || targetColumn === draggedColumn) {
        handleColumnDragEnd(e);
        return;
    }

    const draggedId = draggedColumn.dataset.columnId;
    const targetId = targetColumn.dataset.columnId;

    const draggedIndex = columns.findIndex(c => c.id === draggedId);
    const targetIndex = columns.findIndex(c => c.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
        handleColumnDragEnd(e);
        return;
    }

    const rect = targetColumn.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const dropBefore = e.clientX < midpoint;

    const [movedColumn] = columns.splice(draggedIndex, 1);

    let newIndex = targetIndex;
    if (draggedIndex < targetIndex) {
        newIndex = dropBefore ? targetIndex - 1 : targetIndex;
    } else {
        newIndex = dropBefore ? targetIndex : targetIndex + 1;
    }

    columns.splice(newIndex, 0, movedColumn);

    updateColumnPositions().then(() => {
        renderBoard();
        showToast('Column moved', 'success');
    });

    handleColumnDragEnd(e);
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
    // Panel close buttons
    elements.closePanelBtn.addEventListener('click', closeTaskPanel);
    elements.cancelPanelBtn.addEventListener('click', closeTaskPanel);
    elements.panelOverlay.addEventListener('click', closeTaskPanel);

    // Panel save
    elements.savePanelBtn.addEventListener('click', saveTaskFromPanel);

    // Panel delete
    elements.deleteTaskBtn.addEventListener('click', () => {
        if (currentEditingTask) {
            showDeleteModal(currentEditingTask);
        }
    });

    // Image upload
    elements.panelAddImageBtn.addEventListener('click', () => {
        elements.panelImageUpload.click();
    });

    elements.panelImageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showToast('Image must be smaller than 5MB', 'error');
            e.target.value = '';
            return;
        }

        const imageUrl = await uploadTaskImage(file);
        if (imageUrl && currentEditingTask) {
            if (!currentEditingTask.images) {
                currentEditingTask.images = [];
            }
            currentEditingTask.images.push(imageUrl);
            renderTaskImages(currentEditingTask.images);
        }

        // Clear the input so the same file can be uploaded again
        e.target.value = '';
    });

    // Comment functionality
    elements.submitCommentBtn.addEventListener('click', postComment);

    elements.commentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            postComment();
        }
    });

    elements.addCommentImageBtn.addEventListener('click', () => {
        elements.commentImageUpload.click();
    });

    elements.commentImageUpload.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        // Validate file sizes (max 5MB each)
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                showToast('Each image must be smaller than 5MB', 'error');
                e.target.value = '';
                return;
            }
        }

        // Upload all files
        for (const file of files) {
            const imageUrl = await uploadCommentImage(file);
            if (imageUrl) {
                currentCommentImages.push(imageUrl);
            }
        }

        renderCommentImages();

        // Clear the input so the same files can be uploaded again
        e.target.value = '';
    });

    // Delete Modal
    elements.cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', async () => {
        if (taskToDeleteId) {
            await deleteTask(taskToDeleteId);
            hideDeleteModal();
            closeTaskPanel(); // Close the side panel too
        }
    });

    // Close modal on outside click
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal || e.target.classList.contains('bg-gray-900/50')) {
            hideDeleteModal();
        }
    });

    // Board Creation
    elements.createBoardBtn.addEventListener('click', showCreateBoardModal);
    elements.cancelCreateBoardBtn.addEventListener('click', hideCreateBoardModal);

    elements.confirmCreateBoardBtn.addEventListener('click', () => {
        const name = elements.newBoardName.value.trim();
        if (name) {
            const iconValue = elements.newBoardIcon?.value || 'dashboard';
            const colorValue = elements.newBoardIconColor?.value || '#3b82f6';
            console.log('Creating board with icon:', iconValue, 'color:', colorValue);
            createBoard(name, iconValue, colorValue);
        }
    });

    // List Creation
    elements.cancelCreateListBtn.addEventListener('click', hideCreateListModal);
    elements.confirmCreateListBtn.addEventListener('click', createColumn);

    // Board Edit
    elements.cancelEditBoardBtn.addEventListener('click', hideEditBoardModal);
    elements.confirmEditBoardBtn.addEventListener('click', () => {
        const boardId = elements.editBoardModal.dataset.boardId;
        const name = elements.editBoardName.value.trim();
        if (boardId && name) {
            const icon = elements.editBoardIcon?.value || 'dashboard';
            const iconColor = elements.editBoardIconColor?.value || '#3b82f6';
            updateBoard(boardId, { name, icon, icon_color: iconColor });
            hideEditBoardModal();
        }
    });

    // Edit board modal - icon dropdown
    if (elements.editIconDropdownButton && elements.editIconDropdownMenu) {
        elements.editIconDropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.editIconDropdownMenu.classList.toggle('hidden');
        });

        document.querySelectorAll('.edit-icon-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.dataset.icon;
                elements.editBoardIcon.value = icon;
                elements.editSelectedIconPreview.textContent = icon;
                document.querySelectorAll('.edit-icon-option').forEach(b => b.classList.remove('bg-blue-100', 'dark:bg-blue-900/30'));
                btn.classList.add('bg-blue-100', 'dark:bg-blue-900/30');
                elements.editIconDropdownMenu.classList.add('hidden');
            });
        });
    }

    // Edit board modal - color options
    document.querySelectorAll('.edit-color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const color = btn.dataset.color;
            elements.editBoardIconColor.value = color;
            elements.editSelectedIconPreview.style.color = color;
            document.querySelectorAll('.edit-color-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Edit board modal - Enter key
    elements.editBoardName.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.confirmEditBoardBtn.click();
        }
    });

    // Close edit board modal on outside click
    elements.editBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.editBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideEditBoardModal();
        }
    });

    // Board context menu event listeners
    if (elements.contextEditBoard) {
        elements.contextEditBoard.addEventListener('click', () => {
            if (currentContextBoardId) {
                showEditBoardModal(currentContextBoardId);
                hideBoardContextMenu();
            }
        });
    }

    if (elements.contextDeleteBoard) {
        elements.contextDeleteBoard.addEventListener('click', () => {
            if (currentContextBoardId) {
                const board = boards.find(b => b.id === currentContextBoardId);
                if (board) {
                    showDeleteBoardModal(currentContextBoardId, board.name);
                }
                hideBoardContextMenu();
            }
        });
    }

    // Column Context Menu buttons
    if (elements.contextColumnAddTask) {
        elements.contextColumnAddTask.addEventListener('click', () => {
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                scrollToAddCard(id);
            }
        });
    }

    if (elements.contextColumnRename) {
        elements.contextColumnRename.addEventListener('click', () => {
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                editColumnTitle(id);
            }
        });
    }

    if (elements.contextColumnMoveLeft) {
        elements.contextColumnMoveLeft.addEventListener('click', () => {
            if (currentContextColumnId && !elements.contextColumnMoveLeft.disabled) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                moveColumnLeft(id);
            }
        });
    }

    if (elements.contextColumnMoveRight) {
        elements.contextColumnMoveRight.addEventListener('click', () => {
            if (currentContextColumnId && !elements.contextColumnMoveRight.disabled) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                moveColumnRight(id);
            }
        });
    }

    if (elements.contextColumnDelete) {
        elements.contextColumnDelete.addEventListener('click', () => {
            if (currentContextColumnId) {
                const id = currentContextColumnId;
                hideColumnContextMenu();
                deleteColumn(id);
            }
        });
    }

    // Allow Enter key to create list
    elements.newListTitle.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createColumn();
        }
    });

    // Board Deletion
    elements.cancelDeleteBoardBtn.addEventListener('click', hideDeleteBoardModal);
    elements.deleteBoardConfirmInput.addEventListener('input', () => {
        const boardName = elements.deleteBoardConfirmInput.dataset.boardName;
        elements.confirmDeleteBoardBtn.disabled = elements.deleteBoardConfirmInput.value !== boardName;
    });
    elements.confirmDeleteBoardBtn.addEventListener('click', async () => {
        if (boardToDeleteId) {
            await deleteBoard(boardToDeleteId);
        }
    });

    // List Deletion
    elements.cancelDeleteListBtn.addEventListener('click', hideDeleteListModal);

    // Close create board modal on outside click
    elements.createBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.createBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideCreateBoardModal();
        }
    });

    // Icon dropdown functionality
    if (elements.iconDropdownButton && elements.iconDropdownMenu) {
        elements.iconDropdownButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            elements.iconDropdownMenu.classList.toggle('hidden');
        });

        // Handle icon selection
        const iconOptions = document.querySelectorAll('.icon-option');
        iconOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const icon = option.dataset.icon;

                elements.newBoardIcon.value = icon;
                elements.selectedIconPreview.textContent = icon;
                // Apply current color to the new icon
                if (elements.newBoardIconColor) {
                    elements.selectedIconPreview.style.color = elements.newBoardIconColor.value;
                }
                elements.iconDropdownMenu.classList.add('hidden');
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!elements.iconDropdownButton?.contains(e.target) && !elements.iconDropdownMenu?.contains(e.target)) {
                elements.iconDropdownMenu?.classList.add('hidden');
            }
        });
    }

    // Color selection functionality
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const color = option.dataset.color;

            // Update hidden input
            elements.newBoardIconColor.value = color;

            // Update icon preview color
            if (elements.selectedIconPreview) {
                elements.selectedIconPreview.style.color = color;
            }

            // Update active state
            colorOptions.forEach(btn => btn.classList.remove('active'));
            option.classList.add('active');
        });
    });

    // Close create list modal on outside click
    elements.createListModal.addEventListener('click', (e) => {
        if (e.target === elements.createListModal || e.target.classList.contains('bg-gray-900/50')) {
            hideCreateListModal();
        }
    });

    // Close delete board modal on outside click
    elements.deleteBoardModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteBoardModal || e.target.classList.contains('bg-gray-900/50')) {
            hideDeleteBoardModal();
        }
    });

    // Create board on Enter key
    elements.newBoardName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const name = elements.newBoardName.value.trim();
            if (name) {
                const iconValue = elements.newBoardIcon?.value || 'dashboard';
                const colorValue = elements.newBoardIconColor?.value || '#3b82f6';
                createBoard(name, iconValue, colorValue);
            }
        } else if (e.key === 'Escape') {
            hideCreateBoardModal();
        }
    });



    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.boardContextMenu && !elements.boardContextMenu.classList.contains('hidden')) {
                hideBoardContextMenu();
            } else if (elements.columnContextMenu && !elements.columnContextMenu.classList.contains('hidden')) {
                hideColumnContextMenu();
            } else if (elements.taskContextMenu && !elements.taskContextMenu.classList.contains('hidden')) {
                hideTaskContextMenu();
            } else if (!elements.editBoardModal.classList.contains('hidden')) {
                hideEditBoardModal();
            } else if (!elements.taskPanel.classList.contains('hidden')) {
                closeTaskPanel();
            } else if (!elements.deleteModal.classList.contains('hidden')) {
                hideDeleteModal();
            } else if (!elements.deleteBoardModal.classList.contains('hidden')) {
                hideDeleteBoardModal();
            } else if (!elements.deleteListModal.classList.contains('hidden')) {
                hideDeleteListModal();
            } else if (!elements.createListModal.classList.contains('hidden')) {
                hideCreateListModal();
            } else if (!elements.createBoardModal.classList.contains('hidden')) {
                hideCreateBoardModal();
            } else if (document.getElementById('labelManagerModal') && !document.getElementById('labelManagerModal').classList.contains('hidden')) {
                closeLabelManager();
            } else {
                hideInlineAddForm();
            }
        }
    });

    // Navigation
    elements.navBoard.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('board');
    });

    elements.navActivity.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('activity');
    });

    elements.navMyTasks.addEventListener('click', (e) => {
        e.preventDefault();
        switchView('my-tasks');
    });

    // Theme
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Sidebar Toggle
    elements.sidebarToggle.addEventListener('click', toggleSidebar);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('access_token');
        window.location.href = '/login';
    });

    // Label Manager
    const labelManagerBtn = document.getElementById('labelManagerBtn');
    if (labelManagerBtn) {
        labelManagerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openLabelManager('global');
        });
    }

    const labelCloseBtn = document.getElementById('labelCloseBtn');
    if (labelCloseBtn) {
        labelCloseBtn.addEventListener('click', closeLabelManager);
    }

    const labelCreateBtn = document.getElementById('labelCreateBtn');
    if (labelCreateBtn) {
        labelCreateBtn.addEventListener('click', createLabel);
    }

    // Close boards popout when clicking outside
    document.addEventListener('click', (e) => {
        const popout = document.getElementById('boardsPopout');
        const moreBtn = document.getElementById('boardsMoreBtn');
        if (popout && popout.style.display === 'block' &&
            !popout.contains(e.target) &&
            (!moreBtn || !moreBtn.contains(e.target))) {
            popout.style.display = 'none';
        }
    });

    const panelLabelNew = document.getElementById('panelLabelNew');
    if (panelLabelNew) {
        panelLabelNew.addEventListener('click', () => {
            openLabelManager('board');
        });
    }

    // Close label manager modal on outside click
    const labelManagerModal = document.getElementById('labelManagerModal');
    if (labelManagerModal) {
        labelManagerModal.addEventListener('click', (e) => {
            if (e.target === labelManagerModal || e.target.classList.contains('bg-gray-900/50')) {
                closeLabelManager();
            }
        });
    }

    // Global click to close inline forms and column menus
    document.addEventListener('click', (e) => {
        if (activeInlineForm && !e.target.closest('.inline-add-form') && !e.target.closest('.add-card-btn') && !e.target.closest('#addTaskBtn')) {
            hideInlineAddForm();
        }

        // Close column menus when clicking outside
        if (!e.target.closest('.column-menu') && !e.target.closest('.column-menu-btn')) {
            closeAllColumnMenus();
        }

        // Close context menu when clicking outside
        if (!e.target.closest('#taskContextMenu') && !e.target.closest('.task-card')) {
            hideTaskContextMenu();
        }

        // Close board context menu when clicking outside
        if (!e.target.closest('#boardContextMenu')) {
            hideBoardContextMenu();
        }

        // Close column context menu when clicking outside
        if (!e.target.closest('#columnContextMenu')) {
            hideColumnContextMenu();
        }
    });

    // Context Menu Event Listeners
    if (elements.contextOpenTask) {
        elements.contextOpenTask.addEventListener('click', () => {
            if (currentContextTask) {
                openTaskPanel(currentContextTask);
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityLow) {
        elements.contextPriorityLow.addEventListener('click', () => {
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'low' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityMedium) {
        elements.contextPriorityMedium.addEventListener('click', () => {
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'medium' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextPriorityHigh) {
        elements.contextPriorityHigh.addEventListener('click', () => {
            if (currentContextTask) {
                updateTask(currentContextTask.id, { priority: 'high' });
                hideTaskContextMenu();
            }
        });
    }

    if (elements.contextDeleteTask) {
        elements.contextDeleteTask.addEventListener('click', () => {
            if (currentContextTask) {
                showDeleteModal(currentContextTask);
                hideTaskContextMenu();
            }
        });
    }

    // Horizontal scroll with mouse wheel and touchpad
    elements.boardView.addEventListener('wheel', (e) => {
        const taskList = e.target.closest('.task-list');

        // If inside a task list, check if it can scroll vertically
        if (taskList) {
            const canScrollUp = taskList.scrollTop > 0;
            const canScrollDown = taskList.scrollTop < (taskList.scrollHeight - taskList.clientHeight);
            const scrollingDown = e.deltaY > 0;
            const scrollingUp = e.deltaY < 0;

            // Allow vertical scroll if the list can scroll in that direction
            if ((scrollingDown && canScrollDown) || (scrollingUp && canScrollUp)) {
                return; // Let it scroll vertically
            }
        }

        // Enable horizontal scrolling for touchpad swiping (has deltaX)
        if (Math.abs(e.deltaX) > 0) {
            // Touchpad horizontal swipe detected
            e.preventDefault();
            elements.boardView.scrollLeft += e.deltaX;
        } else if (Math.abs(e.deltaY) > 0) {
            // Mouse wheel - convert to horizontal scroll when over headers, buttons, or empty space
            e.preventDefault();
            elements.boardView.scrollLeft += e.deltaY;
        }
    }, { passive: false });
}

function attachBoardEventListeners() {
    // Add card buttons in columns
    document.querySelectorAll('.add-card-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showInlineAddForm(btn.dataset.columnId);
        });
    });

    // Column menu buttons
    document.querySelectorAll('.column-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const columnId = btn.dataset.columnId;
            const menu = document.querySelector(`.column-menu[data-column-id="${columnId}"]`);

            // Close other menus
            document.querySelectorAll('.column-menu').forEach(m => {
                if (m !== menu) m.classList.add('hidden');
            });

            // Toggle this menu
            menu.classList.toggle('hidden');
        });
    });

    // Task drag-and-drop: dragover/enter/leave/drop on each column
    document.querySelectorAll('.column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            // Route to the correct handler based on what's being dragged
            if (isDragging) {
                handleDragOver(e);
            } else if (draggedColumn) {
                handleColumnDragOver(e);
            } else {
                // Unknown drag — still prevent default so drop can fire
                e.preventDefault();
            }
        });
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
        column.addEventListener('drop', (e) => {
            // Route drop to the correct handler
            if (isDragging) {
                handleDrop(e);
            } else if (draggedColumn) {
                handleColumnDrop(e);
            }
        });

        // Column context menu
        column.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.task-card')) return;
            const columnId = column.dataset.columnId;
            if (columnId) showColumnContextMenu(e, columnId);
        });
    });

    // Column drag-and-drop: dragstart/end only from the header handle
    document.querySelectorAll('.column-drag-handle').forEach(handle => {
        handle.addEventListener('dragstart', handleColumnDragStart);
        handle.addEventListener('dragend', handleColumnDragEnd);
    });
}
// ===== End of Event Listeners =====

// ===== Utility Functions =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatEventData(data) {
    if (!data) return '';
    if (typeof data === 'string') return escapeHtml(data);

    // Handle specific fields to make them more readable
    const parts = [];
    if (data.title) parts.push(`Title: "${data.title}"`);
    if (data.status) parts.push(`Status: ${statusLabels[data.status] || data.status}`);
    if (data.priority) parts.push(`Priority: ${data.priority}`);
    if (data.from && data.to) parts.push(`Moved from ${statusLabels[data.from] || data.from} to ${statusLabels[data.to] || data.to}`);
    if (data.description) parts.push(`Description updated`);
    if (data.assignee_id) parts.push(`Assignee updated`);

    // Fallback if generic object
    if (parts.length === 0 && Object.keys(data).length > 0) {
        return escapeHtml(JSON.stringify(data).substring(0, 100) + (JSON.stringify(data).length > 100 ? '...' : ''));
    }

    return escapeHtml(parts.join(', '));
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// ===== Initialize Application =====
async function init() {
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

// Start the application
document.addEventListener('DOMContentLoaded', init);

