export const MATCH_TYPES = {
    any: 'Qualquer mensagem',
    contains: 'Conter',
    exact: 'Ser',
    starts_with: 'Começar com'
} as const;

export type MatchTypeId = keyof typeof MATCH_TYPES;

export const POST_OPTIONS = {
    any_post: 'Qualquer publicação ou anúncio',
    specific_post: 'Publicação específica'
} as const;
