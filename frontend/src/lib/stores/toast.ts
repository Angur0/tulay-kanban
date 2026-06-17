import { writable } from 'svelte/store';

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
}

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    let counter = 0;

    function add(message: string, type: Toast['type'] = 'info') {
        const id = `toast-${++counter}-${Date.now()}`;
        update(toasts => [...toasts, { id, message, type }]);

        setTimeout(() => remove(id), 2000);
    }

    function remove(id: string) {
        update(toasts => toasts.filter(t => t.id !== id));
    }

    return { subscribe, add, remove };
}

export const toastStore = createToastStore();

export function toastSuccess(message: string) {
    toastStore.add(message, 'success');
}

export function toastError(message: string) {
    toastStore.add(message, 'error');
}

export function toastInfo(message: string) {
    toastStore.add(message, 'info');
}

export function toastWarning(message: string) {
    toastStore.add(message, 'warning');
}
