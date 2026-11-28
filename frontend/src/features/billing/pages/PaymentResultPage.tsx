import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePaymentOrder } from '../api/billing.api';

export function PaymentResultPage() {
  const [params] = useSearchParams();
  const txnRef = params.get('txnRef')?.trim() ?? '';
  const order = usePaymentOrder(txnRef);

  let title = 'Could not verify payment';
  let description = 'Return to billing to check your payment history.';
  if (order.isPending && txnRef) { title = 'Checking payment…'; description = 'We are confirming the order status with the billing service.'; }
  else if (order.data?.status === 'COMPLETED') { title = 'Payment successful'; description = `Order ${order.data.orderCode} is complete.`; }
  else if (order.data) { title = order.data.status === 'PENDING' ? 'Payment pending' : 'Payment unsuccessful'; description = `Order ${order.data.orderCode}: ${order.data.status.toLowerCase()}.`; }
  else if (!txnRef) { description = 'The payment return did not include an order reference.'; }

  return <main className="container mx-auto flex min-h-[70vh] max-w-2xl items-center px-4 py-12">
    <Card className="w-full"><CardHeader><CardTitle>{title}</CardTitle><p className="text-sm text-muted-foreground">{description}</p></CardHeader><CardContent className="space-y-4">
      {order.isError && <p role="alert" className="text-sm text-muted-foreground">We could not retrieve this order. Payment status has not been confirmed.</p>}
      {order.isPending && txnRef && <p role="status" className="text-sm text-muted-foreground">Verifying with the server…</p>}
      <Button nativeButton={false} render={<Link to="/billing" />}>Return to billing dashboard</Button>
    </CardContent></Card>
  </main>;
}
