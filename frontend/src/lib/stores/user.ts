import { writable } from 'svelte/store';
import type { WorkspaceMember, User } from '$lib/types';

export const currentUser = writable<User | null>(null);
export const activeWorkspaceId = writable<string | null>(null);
export const currentBoardRole = writable<'owner' | 'editor' | 'moderator' | 'member' | 'viewer'>('viewer');
export const workspaceMembers = writable<WorkspaceMember[]>([]);

export function setCurrentUser(user: User | null) {
    currentUser.set(user);
}

export function setActiveWorkspaceId(id: string | null) {
    activeWorkspaceId.set(id);
}

export function setCurrentBoardRole(role: 'owner' | 'editor' | 'moderator' | 'member' | 'viewer') {
    currentBoardRole.set(role);
}

export function setWorkspaceMembers(members: WorkspaceMember[]) {
    workspaceMembers.set(members);
}
