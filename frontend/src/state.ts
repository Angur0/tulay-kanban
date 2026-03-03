export const STORAGE_KEY = 'kafka-kanban-tasks';
export const API_URL = window.location.origin;

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
export const getWsUrl = (boardId: string): string =>
    `${wsProtocol}://${window.location.host}/ws/${boardId}`;

export const BOARD_ICONS = new Set<string>([
    'dashboard',
    'folder',
    'campaign',
    'code',
    'shopping_bag',
    'rocket_launch',
    'design_services',
    'event',
    'school',
    'inventory_2',
]);

export function normalizeBoardIcon(icon?: string | null): string {
    return icon && BOARD_ICONS.has(icon) ? icon : 'dashboard';
}

export const columnColorClasses: string[] = [
    'bg-amber-500',
    'bg-primary',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-yellow-500',
];


export const statusLabels: Record<string, string> = {
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done',
};

export const TASK_DRAG_KEY = 'application/x-task-id';

export let currentUser: { id: string; email: string; full_name: string } | null = null;
export function setCurrentUser(user: { id: string; email: string; full_name: string } | null) {
    currentUser = user;
}

export let currentBoardRole: 'owner' | 'moderator' | 'member' | 'viewer' = 'viewer';
export function setCurrentBoardRole(role: 'owner' | 'moderator' | 'member' | 'viewer') {
    currentBoardRole = role;
}
