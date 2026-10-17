import { Input } from '@/components/ui/input';
import { parseNumberInput } from '../../utils/node-config';
import { FieldShell } from './FieldShell';

interface NumberFieldProps {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  integer?: boolean;
  min?: number;
}

// Stores a real number (or nothing when the box is emptied), never the text typed.
export function NumberField({ id, label, value, onChange, integer, min }: NumberFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <Input
        id={id}
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        step={integer ? 1 : 'any'}
        min={min}
        value={value ?? ''}
        onChange={(e) => onChange(parseNumberInput(e.target.value))}
      />
    </FieldShell>
  );
}
