import { MessageCircle, Play, Send, Settings, Sparkles, Webhook } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NodeIconProps {
  icon: string | null | undefined;
  name: string;
  color?: string;
}

// Built-in icons the catalog may name.
const ICONS: Record<string, LucideIcon> = {
  play: Play,
  sparkles: Sparkles,
  webhook: Webhook,
  'message-circle': MessageCircle,
  send: Send,
};

// The catalog gives either an image URL or the name of a built-in icon.
export function NodeIcon({ icon, name, color }: NodeIconProps) {
  if (icon?.startsWith('http')) {
    return <img src={icon} alt={name} className="w-5 h-5 object-contain" />;
  }
  const Icon = icon ? ICONS[icon] : undefined;
  if (Icon) return <Icon className="w-5 h-5" style={{ color }} />;
  return <Settings className="w-5 h-5 text-gray-500" />;
}
