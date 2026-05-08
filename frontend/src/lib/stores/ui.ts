import { writable } from 'svelte/store';

// UI State
export const isSidebarCollapsed = writable(false);
function getInitialDarkMode(): boolean {
    if (typeof window === 'undefined') return false;

    const saved = localStorage.getItem('theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;

    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const isDarkMode = writable(getInitialDarkMode());
export const activeView = writable<'board' | 'activity' | 'my-tasks'>('board');

// Modals
export const activeModal = writable<string | null>(null);

export function toggleSidebar() {
    isSidebarCollapsed.update(v => !v);
}

export function toggleTheme() {
    if (typeof document !== 'undefined' && document.startViewTransition) {
        document.startViewTransition(() => {
            isDarkMode.update(v => !v);
        });
    } else {
        if (typeof document !== 'undefined') {
            document.documentElement.classList.add('theme-transition');
        }
        isDarkMode.update(v => !v);
        if (typeof window !== 'undefined') {
            window.setTimeout(() => {
                document.documentElement.classList.remove('theme-transition');
            }, 300);
        }
    }
}

if (typeof window !== 'undefined') {
    isDarkMode.subscribe((isDark) => {
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('light', !isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

export function switchView(view: 'board' | 'activity' | 'my-tasks') {
    activeView.set(view);
}

export function openModal(modalId: string) {
    activeModal.set(modalId);
}

export function closeModal() {
    activeModal.set(null);
}
