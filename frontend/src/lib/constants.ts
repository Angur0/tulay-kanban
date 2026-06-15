export const STORAGE_KEY = 'tulay-kanban-tasks';
// Backend is proxied through the Vite dev server — use the same origin as the page.
export const API_URL = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.host}`
    : 'http://localhost:5173';

export const BOARD_ICONS = new Set<string>([
    'dashboard', 'folder', 'campaign', 'code', 'shopping_bag',
    'rocket_launch', 'design_services', 'event', 'school', 'inventory_2',
]);

export function normalizeBoardIcon(icon?: string | null): string {
    return icon && BOARD_ICONS.has(icon) ? icon : 'dashboard';
}

export const columnColorClasses: string[] = [
    'bg-amber-500', 'bg-primary', 'bg-green-500', 'bg-purple-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
];

export const statusLabels: Record<string, string> = {
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done',
};

export const TASK_DRAG_KEY = 'application/x-task-id';
