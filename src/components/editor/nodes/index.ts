import { StartNode } from './StartNode';
import { MessageNode } from './MessageNode';
import { ButtonsNode } from './ButtonsNode';
import { WaitNode } from './WaitNode';
import { ConditionNode } from './ConditionNode';
import { CardsNode } from './CardsNode';
import { TagNode } from './TagNode';

export const nodeTypes = {
    start: StartNode,
    message: MessageNode,
    buttons: ButtonsNode,
    wait: WaitNode,
    condition_tag: ConditionNode,
    cards: CardsNode,
    add_tag: TagNode,
    remove_tag: TagNode,
};
