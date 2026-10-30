import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { getDefaultConfig, orderedProperties } from '../../utils/node-config';
import type { PropertySchema } from '../../utils/node-config';
import { ConfigField } from './ConfigField';

interface ListFieldProps {
  id: string;
  label: string;
  nodeKey: string;
  // Schema of one row: an object whose properties are the row fields.
  itemSchema: PropertySchema;
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
}

// A short random id: the output of a Switch rule is named after it, so rules can
// be reordered or deleted without rewiring the others.
function newRowId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// A list of objects (conditions, rules, fields), one bordered group per row.
export function ListField({ id, label, nodeKey, itemSchema, rows, onChange }: ListFieldProps) {
  const fields = orderedProperties(itemSchema);
  const unit = label.toLowerCase().replace(/s$/, '');

  const addRow = () => {
    const row = getDefaultConfig(itemSchema);
    if (itemSchema['x-rowId'] === true) row.id = newRowId();
    onChange([...rows, row]);
  };
  const updateRow = (index: number, key: string, value: unknown) =>
    onChange(
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row };
        if (value === undefined) delete next[key];
        else next[key] = value;
        return next;
      }),
    );

  return (
    <div className="space-y-2" id={id}>
      <Label className="capitalize">{label}</Label>
      {rows.map((row, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-gray-200 p-3">
          {fields.map(([key, schema]) => (
            <ConfigField
              key={key}
              idPrefix={`${id}-${index}-`}
              nodeKey={nodeKey}
              fieldKey={key}
              schema={schema}
              config={row}
              onChange={(fieldKey, value) => updateRow(index, fieldKey, value)}
              onConnectOAuth={() => undefined}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <Trash2 className="size-3.5" />
            Remove {unit}
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
        <Plus className="size-3.5" />
        Add {unit}
      </Button>
    </div>
  );
}
