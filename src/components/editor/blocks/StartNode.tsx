import { Handle, Position } from 'reactflow';

export default function StartNode() {
    return (
        <div className="w-[100px] h-[50px] rounded-full border-2 border-green-500 bg-white dark:bg-zinc-900 flex items-center justify-center shadow-lg">
            <span className="font-bold text-sm text-green-600">INÍCIO</span>
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-green-500" />
        </div>
    );
}
