import { statusLabels } from './state.ts';

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

export function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatEventData(data: unknown): string {
    if (!data) return '';
    if (typeof data === 'string') return escapeHtml(data);

    const d = data as Record<string, unknown>;
    const parts: string[] = [];
    if (d['title']) parts.push(`Title: "${d['title']}"`);
    if (d['status'] && typeof d['status'] === 'string')
        parts.push(`Status: ${statusLabels[d['status']] || d['status']}`);
    if (d['priority']) parts.push(`Priority: ${d['priority']}`);
    if (d['from'] && d['to']) {
        const from = d['from'] as string;
        const to = d['to'] as string;
        parts.push(`Moved from ${statusLabels[from] || from} to ${statusLabels[to] || to}`);
    }
    if (d['description']) parts.push('Description updated');
    if (d['assignee_id']) parts.push('Assignee updated');

    if (parts.length === 0 && Object.keys(d).length > 0) {
        const serialized = JSON.stringify(d);
        return escapeHtml(serialized.substring(0, 100) + (serialized.length > 100 ? '...' : ''));
    }

    return escapeHtml(parts.join(', '));
}

export function formatDate(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return shortDateFormatter.format(date);
}

export function formatDateWithYear(dateString?: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return fullDateFormatter.format(date);
}

export function showToast(
    toastContainer: HTMLElement | null,
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
): void {
    if (!toastContainer) return;

    toastContainer.innerHTML = '';

    const toast = document.createElement('div');

    const colors: Record<string, string> = {
        info: 'bg-[#111418] dark:bg-[#1e2936] border-[#e5e7eb] dark:border-[#2a3645] text-white',
        success: 'bg-emerald-600 border-emerald-500 text-white',
        error: 'bg-red-600 border-red-500 text-white',
    };

    const icons: Record<string, string> = {
        info: 'info',
        success: 'check_circle',
        error: 'error',
    };

    toast.className = `${colors[type]} px-4 py-3 rounded-lg border flex items-center gap-3 transform transition-all duration-300 translate-y-8 opacity-0 pointer-events-auto min-w-[300px] max-w-[400px]`;

    toast.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">${icons[type]}</span>
    <span class="text-sm font-medium flex-1">${escapeHtml(message)}</span>
    <button class="text-white/70 hover:text-white transition-colors" data-action="dismiss-toast">
      <span class="material-symbols-outlined text-[16px]">close</span>
    </button>
  `;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-8', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('translate-y-8', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

export function showKafkaEvent(
    kafkaStatusEl: HTMLElement | null,
    updateKafkaStatusUI: (() => void) | null,
    toastContainer: HTMLElement | null,
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
): void {
    if (kafkaStatusEl && (message.includes('Connected') || message.includes('Disconnected'))) {
        kafkaStatusEl.textContent = message;
        setTimeout(() => {
            if (typeof updateKafkaStatusUI === 'function') {
                updateKafkaStatusUI();
            }
        }, 2000);
    }

    showToast(toastContainer, message, type);
}
