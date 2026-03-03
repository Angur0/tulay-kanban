import { authFetch } from '$lib/api';
import { API_URL, normalizeBoardIcon } from '$lib/constants';
import { activeWorkspaceId } from '$lib/stores/user';
import { boards, activeBoardId, setBoards, setActiveBoardId, boardMembers, setBoardMembers } from '$lib/stores/board';
import { get } from 'svelte/store';
import type { Board } from '$lib/types';

export async function loadBoards() {
    const wsId = get(activeWorkspaceId);
    if (!wsId) return;

    try {
        const response = await authFetch(`${API_URL}/api/workspaces/${wsId}/boards`);
        if (!response) return;

        const loadedBoards = await response.json();
        setBoards(loadedBoards);

        const currentActive = get(activeBoardId);
        if (!currentActive && loadedBoards.length > 0) {
            setActiveBoardId(loadedBoards[0].id);
        }
    } catch (e) {
        console.error('Failed to load boards', e);
    }
}

export async function createBoard(name: string, icon: string, iconColor: string) {
    const wsId = get(activeWorkspaceId);
    if (!wsId) return;

    try {
        const response = await authFetch(`${API_URL}/api/boards`, {
            method: 'POST',
            body: JSON.stringify({
                name,
                icon: normalizeBoardIcon(icon),
                icon_color: iconColor,
                workspace_id: wsId
            }),
        });

        if (!response) return;
        const newBoard = await response.json();
        setActiveBoardId(newBoard.id);
        await loadBoards();

        return newBoard;
    } catch (e) {
        console.error('Failed to create board', e);
        throw e;
    }
}

export async function deleteBoard(boardId: string) {
    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}`, { method: 'DELETE' });
        if (!response?.ok) throw new Error('Failed to delete board');

        const currentBoards = get(boards);
        const nextBoards = currentBoards.filter(b => b.id !== boardId);
        setBoards(nextBoards);

        if (get(activeBoardId) === boardId) {
            setActiveBoardId(nextBoards.length > 0 ? nextBoards[0].id : null);
        }
    } catch (e) {
        console.error('Failed to delete board', e);
        throw e;
    }
}

export async function loadBoardMembers() {
    const boardId = get(activeBoardId);
    if (!boardId) return;

    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}/members`);
        if (!response) return;

        const members = await response.json();
        setBoardMembers(members);
    } catch (e) {
        console.error('Failed to load board members', e);
    }
}

export async function addBoardMember(email: string, role: string) {
    const boardId = get(activeBoardId);
    if (!boardId) return { success: false, error: 'No active board' };

    try {
        const response = await authFetch(`${API_URL}/api/boards/${boardId}/members`, {
            method: 'POST',
            body: JSON.stringify({ user_email: email, role })
        });

        if (!response?.ok) {
            const err = await response?.json().catch(() => ({}));
            return { success: false, error: err?.detail || 'Failed to add member' };
        }

        await loadBoardMembers();
        return { success: true };
    } catch (e) {
        return { success: false, error: 'Error adding member' };
    }
}
