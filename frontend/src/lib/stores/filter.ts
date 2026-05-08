import { writable, derived } from 'svelte/store';
import type { Label } from '$lib/types';

// ================================
// Filter & Sort State
// ================================

export type PriorityFilter = 'all' | 'low' | 'medium' | 'high';
export type SortOption = 'default' | 'priority-asc' | 'priority-desc' | 'due-date' | 'title';

export interface TaskFilters {
    priority: PriorityFilter;
    labelIds: string[];
    sortBy: SortOption;
    searchQuery: string;
}

const DEFAULT_FILTERS: TaskFilters = {
    priority: 'all',
    labelIds: [],
    sortBy: 'default',
    searchQuery: '',
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

export function setSortBy(sortBy: SortOption) {
    taskFilters.update(f => ({ ...f, sortBy }));
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
        $f.sortBy !== 'default' ||
        $f.searchQuery.trim().length > 0
    );
});
