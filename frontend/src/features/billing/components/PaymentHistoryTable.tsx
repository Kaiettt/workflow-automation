import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PaymentOrder } from '../types/billing.types';

const statuses: Record<string, string> = { PENDING: 'Pending', COMPLETED: 'Completed', FAILED: 'Failed', CANCELLED: 'Cancelled' };

export function PaymentHistoryTable({ orders }: { orders: PaymentOrder[] }) {
  return <Card>
    <CardHeader><CardTitle>Payment history</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      {orders.length === 0 ? <p className="text-sm text-muted-foreground">No payments yet.</p> : <table className="w-full text-left text-sm">
        <thead><tr className="border-b text-muted-foreground"><th className="p-2">Order</th><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Status</th></tr></thead>
        <tbody>{orders.map((order) => <tr key={order.id} className="border-b last:border-0"><td className="p-2 font-mono">{order.orderCode}</td><td className="p-2">{new Intl.DateTimeFormat('vi-VN').format(new Date(order.createdAt))}</td><td className="p-2">{order.amountVnd.toLocaleString('vi-VN')} ₫</td><td className="p-2">{statuses[order.status] ?? order.status}</td></tr>)}</tbody>
      </table>}
    </CardContent>
  </Card>;
}
