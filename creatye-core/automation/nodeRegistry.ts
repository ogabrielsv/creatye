import {
    Play,
    MessageSquare,
    List,
    GalleryHorizontal,
    Clock,
    Tag,
    Tags,
    Split,
    LucideIcon
} from 'lucide-react';
import { NodeType } from './types';

interface NodeDefinition {
    type: NodeType;
    label: string;
    description: string;
    icon: LucideIcon;
    defaultData: any;
    category: 'base' | 'logic' | 'action';
}

export const NODE_REGISTRY: Record<NodeType, NodeDefinition> = {
    start: {
        type: 'start',
        label: 'Início',
        description: 'Ponto de partida do fluxo',
        icon: Play,
        category: 'base',
        defaultData: { label: 'Início' }
    },
    message: {
        type: 'message',
        label: 'Mensagem',
        description: 'Envia texto simples',
        icon: MessageSquare,
        category: 'action',
        defaultData: { content: 'Olá! Tudo bem?' }
    },
    buttons: {
        type: 'buttons',
        label: 'Botões',
        description: 'Texto com até 3 botões',
        icon: List,
        category: 'action',
        defaultData: { content: 'Escolha uma opção:', buttons: [] }
    },
    cards: {
        type: 'cards',
        label: 'Carrossel',
        description: 'Cards com imagem e botões',
        icon: GalleryHorizontal,
        category: 'action',
        defaultData: { cards: [] }
    },
    wait: {
        type: 'wait',
        label: 'Aguardar',
        description: 'Pausa por um tempo (delay)',
        icon: Clock,
        category: 'logic',
        defaultData: { duration: 1, unit: 'minutes' }
    },
    add_tag: {
        type: 'add_tag',
        label: 'Adicionar Tag',
        description: 'Atribui uma etiqueta ao lead',
        icon: Tag,
        category: 'logic',
        defaultData: { tagId: '' }
    },
    remove_tag: {
        type: 'remove_tag',
        label: 'Remover Tag',
        description: 'Remove uma etiqueta do lead',
        icon: Tags,
        category: 'logic',
        defaultData: { tagId: '' }
    },
    condition_tag: {
        type: 'condition_tag',
        label: 'Tem Tag?',
        description: 'Verifica se o lead possui uma tag',
        icon: Split,
        category: 'logic',
        defaultData: { tagId: '' }
    }
};
