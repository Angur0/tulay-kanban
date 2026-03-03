import { writable } from 'svelte/store';

// UI State
export const isSidebarCollapsed = writable(false);
export const isDarkMode = writable(false);
export const activeView = writable<'board' | 'activity' | 'my-tasks'>('board');

// Modals
export const activeModal = writable<string | null>(null);

export function toggleSidebar() {
    isSidebarCollapsed.update(v => !v);
}

export function toggleTheme() {
    isDarkMode.update(v => !v);
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
