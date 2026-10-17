import { Play, Settings, Sparkles } from 'lucide-react';

interface NodeIconProps {
  icon: string | null | undefined;
  name: string;
  color?: string;
}

// The catalog gives either an image URL or the name of a built-in icon.
export function NodeIcon({ icon, name, color }: NodeIconProps) {
  if (icon?.startsWith('http')) {
    return <img src={icon} alt={name} className="w-5 h-5 object-contain" />;
  }
  if (icon === 'play') return <Play className="w-5 h-5" style={{ color }} />;
  if (icon === 'sparkles') return <Sparkles className="w-5 h-5" style={{ color }} />;
  return <Settings className="w-5 h-5 text-gray-500" />;
}
