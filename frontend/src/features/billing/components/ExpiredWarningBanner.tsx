import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ExpiredWarningBanner({ busy, onSwitch }: { busy: boolean; onSwitch: () => void }) {
  return <Card role="status" className="border-amber-500/40 bg-amber-50/60"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
    <p className="text-sm">Your paid subscription has expired. Switch to the Free plan to continue.</p>
    <Button size="sm" disabled={busy} onClick={onSwitch}>{busy ? 'Switching…' : 'Switch to Free'}</Button>
  </CardContent></Card>;
}
