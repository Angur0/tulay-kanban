/**
 * Export API — backend-driven Gantt chart image/PDF export
 *
 * Replaces legacy client-side html2canvas export with server-rendered output.
 * All exports are saved to server storage and a URL is returned.
 */
import { get } from 'svelte/store';
import { activeBoard } from '$lib/stores/board';
import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';

/**
 * Export the current board's tasks as a PNG or PDF image.
 *
 * @param boardId - The board ID to export
 * @param format  - 'png' or 'pdf' (default: 'png')
 * @returns Object with `url` pointing to the generated file
 */
export async function exportGanttImage(
	boardId: string,
	format: 'png' | 'pdf' = 'png',
	viewMode: string = 'Week'
): Promise<{ url: string }> {
	const params = new URLSearchParams({ format, view_mode: viewMode });
	const response = await authFetch(`${API_URL}/api/boards/${boardId}/export-gantt?${params}`, {
		method: 'POST',
	});

	if (!response) {
		throw new Error('Unauthorized: No token found');
	}

	if (!response.ok) {
		if (response.status === 400) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.detail || 'EMPTY_BOARD');
		}
		if (response.status === 403) {
			throw new Error('Not authorized to access this board');
		}
		if (response.status === 404) {
			throw new Error('Board not found');
		}
		throw new Error(`Export failed: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Export the current board's tasks as CSV (backend-generated).
 *
 * @param boardId - The board ID to export
 * @returns Object with `csv` containing the raw CSV string
 */
export async function exportBoardCSV(boardId: string): Promise<{ csv: string }> {
	const response = await authFetch(`${API_URL}/api/boards/${boardId}/export-csv`, {
		method: 'GET',
	});

	if (!response) {
		throw new Error('Unauthorized: No token found');
	}

	if (!response.ok) {
		if (response.status === 400) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data.detail || 'EMPTY_BOARD');
		}
		throw new Error(`CSV export failed: ${response.statusText}`);
	}

	return response.json();
}

/**
 * Trigger a browser download for a given URL.
 * Used after the backend generates the exported file.
 */
export function triggerDownload(url: string, filename?: string): void {
	const link = document.createElement('a');
	link.href = url;
	if (filename) {
		link.download = filename;
	}
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
}

