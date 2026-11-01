import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface BooleanFieldProps {
  id: string;
  label: string;
  value: boolean;
  hint?: string;
  onChange: (value: boolean) => void;
}

export function BooleanField({ id, label, value, hint, onChange }: BooleanFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="capitalize">
          {label}
        </Label>
        <Switch id={id} size="sm" checked={value} onCheckedChange={onChange} />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
