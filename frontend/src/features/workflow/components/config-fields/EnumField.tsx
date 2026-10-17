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
  value: string;
  onChange: (value: string) => void;
}

export function EnumField({ id, label, options, value, onChange }: EnumFieldProps) {
  return (
    <FieldShell id={id} label={label}>
      <Select
        value={value || null}
        onValueChange={(next) => next !== null && onChange(next)}
        items={options.map((option) => ({ value: option, label: option }))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}
