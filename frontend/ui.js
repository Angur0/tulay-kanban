import { statusLabels } from './state.js';

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
});

const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
});

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatEventData(data) {
    if (!data) return '';
    if (typeof data === 'string') return escapeHtml(data);

    const parts = [];
    if (data.title) parts.push(`Title: "${data.title}"`);
    if (data.status) parts.push(`Status: ${statusLabels[data.status] || data.status}`);
    if (data.priority) parts.push(`Priority: ${data.priority}`);
    if (data.from && data.to) parts.push(`Moved from ${statusLabels[data.from] || data.from} to ${statusLabels[data.to] || data.to}`);
    if (data.description) parts.push('Description updated');
    if (data.assignee_id) parts.push('Assignee updated');

    if (parts.length === 0 && Object.keys(data).length > 0) {
        const serialized = JSON.stringify(data);
        return escapeHtml(serialized.substring(0, 100) + (serialized.length > 100 ? '...' : ''));
    }

    return escapeHtml(parts.join(', '));
}

export function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return shortDateFormatter.format(date);
}

export function formatDateWithYear(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return fullDateFormatter.format(date);
}

export function showToast(toastContainer, message, type = 'info') {
    if (!toastContainer) return;

    toastContainer.innerHTML = '';

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

export function showKafkaEvent(kafkaStatusEl, updateKafkaStatusUI, toastContainer, message, type = 'info') {
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
