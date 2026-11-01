import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FieldShell } from './FieldShell';

interface EnumFieldProps {
  id: string;
  label: string;
  options: string[];
  // Shown instead of the raw option value.
  labels?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
}

export function EnumField({ id, label, options, labels, value, onChange }: EnumFieldProps) {
  const labelOf = (option: string) => labels?.[option] ?? option;
  return (
    <FieldShell id={id} label={label}>
      <Select
        value={value || null}
        onValueChange={(next) => next !== null && onChange(next)}
        items={options.map((option) => ({ value: option, label: labelOf(option) }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {labelOf(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
