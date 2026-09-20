import React from 'react';
import { Check, X } from 'lucide-react';
import { getPasswordValidation } from '../utils/password.utils';

interface PasswordStrengthMeterProps {
  password: string;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  if (!password) return null;

  const rules = getPasswordValidation(password);

  const score = [
    rules.length,
    rules.hasUpper && rules.hasLower,
    rules.hasNumber,
    rules.hasSpecial,
  ].filter(Boolean).length;

  const getStrengthMeta = () => {
    switch (score) {
      case 1:
        return { label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
      case 2:
        return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500' };
      case 3:
        return { label: 'Good', color: 'bg-blue-500', text: 'text-blue-500' };
      case 4:
        return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
      default:
        return { label: 'Very Weak', color: 'bg-zinc-500', text: 'text-zinc-500' };
    }
  };

  const meta = getStrengthMeta();

  return (
    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
      {/* 4-segment Progress Bar */}
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((step) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              step <= score ? meta.color : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Strength Label */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Password strength:</span>
        <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {rules.length ? (
            <Check className="size-3 text-emerald-500 shrink-0" />
          ) : (
            <X className="size-3 text-zinc-400 shrink-0" />
          )}
          <span className={rules.length ? 'text-foreground' : ''}>Min 8 chars</span>
        </div>

        <div className="flex items-center gap-1">
          {rules.hasUpper && rules.hasLower ? (
            <Check className="size-3 text-emerald-500 shrink-0" />
          ) : (
            <X className="size-3 text-zinc-400 shrink-0" />
          )}
          <span className={rules.hasUpper && rules.hasLower ? 'text-foreground' : ''}>
            Upper & lower
          </span>
        </div>

        <div className="flex items-center gap-1">
          {rules.hasNumber ? (
            <Check className="size-3 text-emerald-500 shrink-0" />
          ) : (
            <X className="size-3 text-zinc-400 shrink-0" />
          )}
          <span className={rules.hasNumber ? 'text-foreground' : ''}>At least 1 number</span>
        </div>

        <div className="flex items-center gap-1">
          {rules.hasSpecial ? (
            <Check className="size-3 text-emerald-500 shrink-0" />
          ) : (
            <X className="size-3 text-zinc-400 shrink-0" />
          )}
          <span className={rules.hasSpecial ? 'text-foreground' : ''}>Special char (!@#$)</span>
        </div>
      </div>
    </div>
  );
};
