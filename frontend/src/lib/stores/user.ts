import { writable } from 'svelte/store';
import type { WorkspaceMember } from '$lib/types';

export const currentUser = writable<{ id: string; email: string; full_name: string } | null>(null);
export const activeWorkspaceId = writable<string | null>(null);
export const currentBoardRole = writable<'owner' | 'moderator' | 'member' | 'viewer'>('viewer');
export const workspaceMembers = writable<WorkspaceMember[]>([]);

export function setCurrentUser(user: { id: string; email: string; full_name: string } | null) {
    currentUser.set(user);
}

export function setActiveWorkspaceId(id: string | null) {
    activeWorkspaceId.set(id);
}

export function setCurrentBoardRole(role: 'owner' | 'moderator' | 'member' | 'viewer') {
    currentBoardRole.set(role);
}

export function setWorkspaceMembers(members: WorkspaceMember[]) {
    workspaceMembers.set(members);
}
