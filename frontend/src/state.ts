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

export interface LabelColorEntry {
    bg: string;
    text: string;
    ring: string;
}

export const labelColors: Record<string, LabelColorEntry> = {
    backend: {
        bg: 'bg-blue-50 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-400',
        ring: 'ring-blue-700/10 dark:ring-blue-400/20',
    },
    frontend: {
        bg: 'bg-green-50 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        ring: 'ring-green-600/20 dark:ring-green-500/20',
    },
    design: {
        bg: 'bg-purple-50 dark:bg-purple-900/30',
        text: 'text-purple-700 dark:text-purple-400',
        ring: 'ring-purple-700/10 dark:ring-purple-400/20',
    },
    devops: {
        bg: 'bg-gray-50 dark:bg-gray-800',
        text: 'text-gray-600 dark:text-gray-400',
        ring: 'ring-gray-500/10 dark:ring-gray-400/20',
    },
};

export const statusLabels: Record<string, string> = {
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done',
};

export const TASK_DRAG_KEY = 'application/x-task-id';
