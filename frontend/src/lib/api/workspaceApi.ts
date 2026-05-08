import { authFetch } from '$lib/api';
import { API_URL } from '$lib/constants';

export async function getWorkspaces() {
    const response = await authFetch(`${API_URL}/api/workspaces`);
    if (!response?.ok) return [];
    return response.json();
}
