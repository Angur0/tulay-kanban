import { writable, derived } from 'svelte/store';
import type { Label } from '$lib/types';

// ================================
// Filter State
// ================================

export type PriorityFilter = 'all' | 'low' | 'medium' | 'high';

export interface TaskFilters {
    priority: PriorityFilter;
    labelIds: string[];
    assignedToMe: boolean;
    searchQuery: string;
    showHiddenLists: boolean;
}

const DEFAULT_FILTERS: TaskFilters = {
    priority: 'all',
    labelIds: [],
    assignedToMe: false,
    searchQuery: '',
    showHiddenLists: false,
};

export const taskFilters = writable<TaskFilters>({ ...DEFAULT_FILTERS });

export const isFilterBarOpen = writable(false);
export const isSearchOpen = writable(false);

// ================================
// Filter Actions
// ================================

export function setPriorityFilter(priority: PriorityFilter) {
    taskFilters.update(f => ({ ...f, priority }));
}

export function toggleLabelFilter(labelId: string) {
    taskFilters.update(f => {
        const has = f.labelIds.includes(labelId);
        return {
            ...f,
            labelIds: has
                ? f.labelIds.filter(id => id !== labelId)
                : [...f.labelIds, labelId],
        };
    });
}

export function toggleAssignedToMe() {
    taskFilters.update(f => ({ ...f, assignedToMe: !f.assignedToMe }));
}

export function toggleShowHiddenLists() {
    taskFilters.update(f => ({ ...f, showHiddenLists: !f.showHiddenLists }));
}

export function setTaskSearchQuery(query: string) {
    taskFilters.update(f => ({ ...f, searchQuery: query }));
}

export function resetFilters() {
    taskFilters.set({ ...DEFAULT_FILTERS });
}

export function openSearch() {
    isSearchOpen.set(true);
}

export function closeSearch() {
    isSearchOpen.set(false);
}

// ================================
// Derived: hasActiveFilters
// ================================

export const hasActiveFilters = derived(taskFilters, ($f) => {
    return (
        $f.priority !== 'all' ||
        $f.labelIds.length > 0 ||
        $f.assignedToMe ||
        $f.searchQuery.trim().length > 0 ||
        $f.showHiddenLists
    );
});
