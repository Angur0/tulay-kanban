// ================================
// Core Domain Types
// ================================

export interface Label {
    id: string;
    name: string;
    color: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: 'low' | 'medium' | 'high';
    column_id: string;
    board_id: string;
    due_date?: string | null;
    assignee_id?: string | null;
    label_ids?: string[];
    images?: string[];
    labels?: Label[];
    order: number;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export interface Board {
    id: string;
    name: string;
    icon?: string;
    icon_color?: string;
    workspace_id?: string;
    position?: number;
}

export interface Column {
    id: string;
    title: string;
    board_id: string;
    order: number;
    position?: number;
}

export interface WorkspaceMember {
    id: string;
    username?: string;
    email: string;
    full_name?: string;
}

export interface BoardMemberResponse {
    user_id: string;
    board_id: string;
    role: 'owner' | 'moderator' | 'member' | 'viewer';
    user_email: string;
    user_full_name: string;
}

export interface KafkaEvent {
    type: string;
    taskId?: string;
    taskTitle?: string;
    originalTaskId?: string;
    data?: Record<string, unknown>;
    time: string;
    timestamp?: string;
}

export interface TaskComment {
    id: string;
    task_id?: string;
    user_id: string;
    content: string;
    created_at: string;
    timestamp?: string;
    images?: string[];
}

// ================================
// AppElements — all DOM handles as HTMLElement | null
// for compatibility with document.getElementById()
// We cast to specific types inline when needed.
// ================================

export interface AppElements {
    [key: string]: HTMLElement | null;
}
