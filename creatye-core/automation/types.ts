
export type AutomationStatus = 'draft' | 'published' | 'paused';

export interface Automation {
    id: string;
    name: string;
    description?: string;
    type?: 'dm' | 'feed' | 'story' | 'mixed';
    channels?: string[];
    status: AutomationStatus;
    executions: number;
    created_at: string;
    updated_at: string; // From automation_drafts or automations table
    last_pub?: string;
    folder_id?: string;
    user_id: string;
}

export interface AutomationDraft {
    automation_id: string;
    nodes: Node[];
    edges: Edge[];
    triggers?: AutomationTrigger[]; // Can be stored in draft or computed
    updated_at: string;
}

export type NodeType =
    | 'start'
    | 'message'
    | 'buttons'
    | 'cards'
    | 'wait'
    | 'add_tag'
    | 'remove_tag'
    | 'condition_tag';

export interface Node {
    id: string;
    type: NodeType;
    position: { x: number; y: number };
    data: any; // More specific types in schemas
    // React Flow specific
    width?: number;
    height?: number;
    selected?: boolean;
}

export interface Edge {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    type?: string;
    animated?: boolean;
}

export interface Tag {
    id: string;
    name: string;
    color?: string;
}

export type TriggerType = 'contains_keywords' | 'story_reply' | 'post_comment';

export interface AutomationTrigger {
    id?: string;
    type: TriggerType;
    payload: {
        keywords?: string[];
        match?: 'any' | 'all';
        post_id?: string;
    };
}

export interface Folder {
    id: string;
    name: string;
    created_at: string;
    user_id: string;
}
