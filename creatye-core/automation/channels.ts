
export const CHANNELS = {
    dm: { label: 'Mensagem Direta', id: 'dm' },
    feed_comment: { label: 'Comentário no Feed', id: 'feed_comment' },
    live_comment: { label: 'Comentário em Live', id: 'live_comment' },
    story_mention: { label: 'Menção à Story', id: 'story_mention' },
    story_reply: { label: 'Resposta à Story', id: 'story_reply' },
} as const;

export type ChannelId = keyof typeof CHANNELS;

export const CHANNEL_LIST: ChannelId[] = [
    'dm',
    'feed_comment',
    'live_comment',
    'story_mention',
    'story_reply'
];
