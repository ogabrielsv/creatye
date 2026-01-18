import { z } from 'zod';

export const NodeBaseSchema = z.object({
    id: z.string(),
    type: z.string(), // We will refine this
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
});

// 1. Start Node
export const StartNodeDataSchema = z.object({
    label: z.string().optional(),
});

// 2. Message Node
export const MessageNodeDataSchema = z.object({
    content: z.string().min(1, "A mensagem não pode estar vazia"),
});

// 3. Buttons Node
export const ButtonItemSchema = z.object({
    id: z.string(),
    label: z.string().min(1, "O botão precisa de um texto"),
    action: z.enum(['next_node', 'open_url']),
    url: z.string().url().optional(),
});

export const ButtonsNodeDataSchema = z.object({
    content: z.string().optional(),
    buttons: z.array(ButtonItemSchema).max(3, "Máximo de 3 botões permitidos pelo Instagram"),
});

// 4. Cards (Carousel) Node
export const CardItemSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Título obrigatório"),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    buttons: z.array(ButtonItemSchema).max(3),
});

export const CardsNodeDataSchema = z.object({
    cards: z.array(CardItemSchema).max(10, "Máximo de 10 cards"),
});

// 5. Wait Node
export const WaitNodeDataSchema = z.object({
    duration: z.number().min(1),
    unit: z.enum(['minutes', 'hours', 'days']),
});

// 6. Tag Nodes (Add/Remove)
export const TagNodeDataSchema = z.object({
    tagId: z.string().uuid("Selecione uma tag válida"),
});

// 7. Condition Tag Node
// Logica: se tem tag X -> Sai pelo handle 'true', senao 'false'
export const ConditionTagNodeDataSchema = z.object({
    tagId: z.string().uuid("Selecione uma tag para a condição"),
});

// Trigger Schema
export const TriggerPayloadSchema = z.object({
    keywords: z.array(z.string()).min(1, "Adicione pelo menos uma palavra-chave").optional(),
    match: z.enum(['any', 'all']).default('any').optional(),
});

export const AutomationTriggerSchema = z.object({
    type: z.enum(['contains_keywords', 'story_reply', 'post_comment']),
    payload: TriggerPayloadSchema,
});
