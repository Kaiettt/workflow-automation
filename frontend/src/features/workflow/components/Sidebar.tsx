

const NODE_TYPES = [
  { type: 'triggerNode', name: 'Schedule', key: 'trigger.schedule' },
  { type: 'actionNode', name: 'Google Calendar', key: 'google.calendar.get_events' },
  { type: 'actionNode', name: 'If', key: 'logic.if' },
  { type: 'actionNode', name: 'Format Text', key: 'data.format_text' },
  { type: 'actionNode', name: 'Send Email', key: 'gmail.send_email' },
];

export function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string, nodeName: string, nodeKey: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/name', nodeName);
    event.dataTransfer.setData('application/reactflow/key', nodeKey);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm z-10">
      <div className="p-4 border-b border-gray-200 font-semibold text-gray-700">
        Nodes
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto flex-1">
        {NODE_TYPES.map((node) => (
          <div
            key={node.key}
            className="p-3 border border-gray-300 rounded-md cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors text-sm shadow-sm"
            onDragStart={(event) => onDragStart(event, node.type, node.name, node.key)}
            draggable
          >
            {node.name}
          </div>
        ))}
      </div>
    </aside>
  );
}
