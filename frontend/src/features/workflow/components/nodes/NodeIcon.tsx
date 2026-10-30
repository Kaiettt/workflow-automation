import {
  Brain,
  Ellipsis,
  Filter,
  GitBranch,
  Layers,
  MessageCircle,
  Pencil,
  Play,
  Reply,
  Send,
  Settings,
  Sparkles,
  Split,
  Webhook,
  Zap,
} from 'lucide-react';
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
  zap: Zap,
  reply: Reply,
  filter: Filter,
  layers: Layers,
  brain: Brain,
  ellipsis: Ellipsis,
  'git-branch': GitBranch,
  split: Split,
  pencil: Pencil,
};

const FALLBACK_COLOR = '#6b7280';

// The catalog gives either an image URL or the name of a built-in icon. Both
// sit in the same rounded tile so every node looks alike: a built-in icon in
// its node colour on a light tint, a logo on white.
export function NodeIcon({ icon, name, color = FALLBACK_COLOR }: NodeIconProps) {
  if (icon?.startsWith('http')) {
    return (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white">
        <img src={icon} alt={name} className="size-5 object-contain" />
      </span>
    );
  }
  const Icon = (icon ? ICONS[icon] : undefined) ?? Settings;
  const tint = /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}1f` : '#f3f4f6';
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: tint }}
    >
      <Icon className="size-5" style={{ color }} aria-label={name} />
    </span>
  );
}
