export type TriggerType = 'keyword' | 'story_reply' | 'comment' | 'date';
export type ActionKind = 'send_dm' | 'add_tag' | 'remove_tag' | 'condition';

export interface Automation {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    status: 'published' | 'draft' | 'paused';
    type: 'dm' | 'story' | 'comment' | 'live' | 'mixed';
    user_id: string;
    folder_id: string | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    channels?: string[];
    executions: number;
    // New field for real count
    executions_count?: number;
}

export interface Folder {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
}
