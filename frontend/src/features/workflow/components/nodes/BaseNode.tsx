import { useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '../../store/designer.store';
import { hasNamedOutputs, outputHandleId, resolveOutputs } from '../../utils/node-outputs';
import { NodeIcon } from './NodeIcon';

export interface WorkflowNodeProps {
  id?: string;
  selected?: boolean;
  data: {
    name: string;
    key: string;
    config?: Record<string, unknown>;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  TRIGGER: 'Trigger',
  LOGIC: 'Logic',
  DATA_PROCESSING: 'Data',
  INTEGRATION: 'Action',
  AI: 'AI',
};

// Saved edges may point at any of the four sides, so every side keeps a
// handle; they only show while the node is hovered or selected.
const SIDES = [
  [Position.Top, 'top'],
  [Position.Bottom, 'bottom'],
  [Position.Left, 'left'],
  [Position.Right, 'right'],
] as const;

// Vertical room for each named output so the handles never overlap.
const OUTPUT_ROW_PX = 28;

const HANDLE_CLASS =
  '!size-2.5 !border-2 !border-white !bg-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-data-[selected=true]:opacity-100';

interface BaseNodeProps extends WorkflowNodeProps {
  trigger?: boolean;
}

// The card every workflow node uses: icon tile, name, and what kind of node it
// is. The node colour only accents the card (left bar, icon tint).
export function BaseNode({ id, selected, data, trigger = false }: BaseNodeProps) {
  const nodeTypes = useDesignerStore((state) => state.nodeTypes);
  const validationIssues = useDesignerStore((state) => state.validationIssues);
  const nodeType = nodeTypes.find((t) => t.key === data.key);
  const color = nodeType?.color || (trigger ? '#6b7280' : '#3b82f6');
  const errorCount = id ? validationIssues.filter((i) => i.nodeId === id).length : 0;
  const outputs = resolveOutputs(nodeType?.configSchema, data.config);
  const named = hasNamedOutputs(outputs);

  // The outputs follow the node's config (a Switch gains one per rule). React Flow
  // only learns about a handle when told, so without this a new output cannot be dragged from.
  const updateNodeInternals = useUpdateNodeInternals();
  const outputKeys = outputs.map((output) => output.key).join('|');
  useEffect(() => {
    if (id) updateNodeInternals(id);
  }, [id, named, outputKeys, updateNodeInternals]);

  // Nodes get renamed freely: keep the original type visible underneath.
  const kind =
    nodeType && nodeType.displayName !== data.name
      ? nodeType.displayName
      : (CATEGORY_LABELS[nodeType?.category ?? ''] ?? (trigger ? 'Trigger' : 'Action'));

  return (
    <div className="group relative" data-selected={selected ? 'true' : 'false'}>
      {errorCount > 0 && (
        <div
          title={`${errorCount} issue${errorCount > 1 ? 's' : ''} require attention`}
          className="absolute -top-2.5 -right-2.5 z-30 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-white animate-in zoom-in-75"
        >
          {errorCount}
        </div>
      )}

      <div
        className={cn(
          'relative flex w-64 items-center gap-3 overflow-hidden border bg-white py-3 pr-4 pl-4 shadow-sm transition-all hover:shadow-md',
          // Triggers have a rounded start, like the first step of a flow.
          trigger ? 'rounded-l-[28px] rounded-r-xl' : 'rounded-xl',
          selected && 'ring-2 ring-offset-1',
          errorCount > 0 ? 'border-rose-400 ring-rose-400/70' : 'border-gray-200',
        )}
        style={{
          ...(selected && errorCount === 0 ? ({ '--tw-ring-color': color } as React.CSSProperties) : {}),
          ...(named ? { minHeight: outputs.length * OUTPUT_ROW_PX } : {}),
        }}
      >
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: errorCount > 0 ? '#fb7185' : color }}
        />
        <NodeIcon icon={nodeType?.icon} name={data.name} color={color} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug font-semibold break-words text-gray-800" title={data.name}>
            {data.name}
          </p>
          <p className="truncate text-[11px] text-gray-500">{kind}</p>
        </div>
        {errorCount > 0 && <AlertCircle className="size-4 shrink-0 text-rose-500" />}
      </div>

      {SIDES.map(([position, side]) => (
        <span key={side}>
          <Handle type="target" position={position} id={`${side}-target`} className={HANDLE_CLASS} />
          {!named && (
            <Handle type="source" position={position} id={`${side}-source`} className={HANDLE_CLASS} />
          )}
        </span>
      ))}

      {/* One labelled handle per output (IF: true / false, Switch: one per rule). */}
      {named &&
        outputs.map((output, index) => (
          <Handle
            key={output.key}
            type="source"
            position={Position.Right}
            id={outputHandleId(output.key)}
            style={{ top: `${((index + 1) / (outputs.length + 1)) * 100}%` }}
            className="!size-3 !border-2 !border-white !bg-slate-500"
          >
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-[10px] font-medium text-gray-600">
              {output.label}
            </span>
          </Handle>
        ))}
    </div>
  );
}
