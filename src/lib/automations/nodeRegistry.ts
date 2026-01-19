import { MessageSquare, Zap, Clock, Tag, Split, Image, List, MousePointer, PlusCircle, MinusCircle } from 'lucide-react';

export const NODE_REGISTRY = {
    // start: { label: 'Início', type: 'start', category: 'base', icon: Zap, description: 'Ponto de partida' },
    message: {
        label: 'Texto Simples',
        type: 'message',
        category: 'action',
        icon: MessageSquare,
        description: 'Envia uma mensagem de texto simples'
    },
    buttons: {
        label: 'Botões',
        type: 'buttons',
        category: 'action',
        icon: MousePointer,
        description: 'Mensagem com até 3 botões'
    },
    cards: {
        label: 'Carrossel / Cartões',
        type: 'cards',
        category: 'action',
        icon: Image,
        description: 'Carrossel de imagens com botões'
    },
    condition_tag: {
        label: 'Condição (Tag)',
        type: 'condition_tag',
        category: 'logic',
        icon: Split,
        description: 'Verifica se o contato tem uma tag'
    },
    wait: {
        label: 'Aguardar',
        type: 'wait',
        category: 'logic',
        icon: Clock,
        description: 'Pausa o fluxo por um tempo'
    },
    add_tag: {
        label: 'Adicionar Tag',
        type: 'add_tag',
        category: 'logic',
        icon: PlusCircle,
        description: 'Adiciona uma etiqueta ao contato'
    },
    remove_tag: {
        label: 'Remover Tag',
        type: 'remove_tag',
        category: 'logic',
        icon: MinusCircle,
        description: 'Remove uma etiqueta do contato'
    },
};
