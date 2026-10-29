import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldShell } from './FieldShell';

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  expression?: boolean;
  placeholder?: string;
  // Field-specific guidance (schema `description`); replaces the generic one.
  hint?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  multiline,
  expression,
  placeholder,
  hint: fieldHint,
}: TextFieldProps) {
  const hint =
    fieldHint ??
    (expression ? 'Use {{$json.column}} or {{$node["Node name"].json.column}}' : undefined);

  return (
    <FieldShell id={id} label={label} expression={expression} hint={hint}>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={5}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={placeholder ?? (expression ? '{{$json.field}}' : `Enter ${label.toLowerCase()}`)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FieldShell>
  );
}
