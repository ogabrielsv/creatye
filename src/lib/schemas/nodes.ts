import { z } from 'zod';

// Base Node Schema
const BaseNodeSchema = z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({
        x: z.number(),
        y: z.number(),
    }),
    data: z.record(z.any()), // Specific data validation below
});

// Message Block
export const MessageNodeDataSchema = z.object({
    message: z.string().min(1, "Mensagem é obrigatória"),
});

// Buttons Block
export const ButtonItemSchema = z.object({
    id: z.string(),
    label: z.string().min(1, "Texto do botão obrigatório"),
    type: z.enum(['link', 'next']),
    url: z.string().url().optional(),
});

export const ButtonsNodeDataSchema = z.object({
    message: z.string().min(1, "Mensagem é obrigatória"),
    buttons: z.array(ButtonItemSchema).max(3, "Máximo de 3 botões"),
});

// Cards Block (Carousel)
export const CardItemSchema = z.object({
    id: z.string(),
    imageUrl: z.string().url("URL da imagem inválida").optional().or(z.literal('')),
    title: z.string().min(1, "Título obrigatório"),
    description: z.string().optional(),
    buttons: z.array(ButtonItemSchema).max(3),
});

export const CardsNodeDataSchema = z.object({
    cards: z.array(CardItemSchema).max(10, "Máximo de 10 cartões"),
});

// Tags Blocks
export const TagNodeDataSchema = z.object({
    tag: z.string().min(1, "Tag é obrigatória"),
});

// Wait Block
export const WaitNodeDataSchema = z.object({
    delaySeconds: z.number().min(1, "Tempo mínimo de 1 segundo"),
});

// Condition Block
export const ConditionNodeDataSchema = z.object({
    tag: z.string().min(1, "Tag para condição é obrigatória"),
});

// Union for all node data types
export const NodeDataSchema = z.union([
    MessageNodeDataSchema,
    ButtonsNodeDataSchema,
    CardsNodeDataSchema,
    TagNodeDataSchema,
    WaitNodeDataSchema,
    ConditionNodeDataSchema,
]);

export type MessageNodeData = z.infer<typeof MessageNodeDataSchema>;
export type ButtonsNodeData = z.infer<typeof ButtonsNodeDataSchema>;
export type CardsNodeData = z.infer<typeof CardsNodeDataSchema>;
export type TagNodeData = z.infer<typeof TagNodeDataSchema>;
export type WaitNodeData = z.infer<typeof WaitNodeDataSchema>;
export type ConditionNodeData = z.infer<typeof ConditionNodeDataSchema>;
