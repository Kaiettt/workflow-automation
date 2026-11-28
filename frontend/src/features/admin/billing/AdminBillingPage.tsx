import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageControls } from '../components/PageControls';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { PlanEditDialog } from './PlanEditDialog';
import { useAdminBillingPayments, useAdminBillingPlans, useAdminBillingRevenue, useAdminBillingSubscriptions } from './useAdminBilling';
import type { BillingPlanAdmin, BillingPaymentAdmin, BillingSubscriptionAdmin } from '../types/admin.types';

type Tab = 'plans' | 'subscriptions' | 'payments' | 'revenue';
const money = (amount: number) => `${amount.toLocaleString('vi-VN')} ₫`;
const date = (value: string | null) => value ? new Date(value).toLocaleString() : '—';

function StateMessage({ loading, error, empty }: { loading: boolean; error: boolean; empty: boolean }) {
  if (loading) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading billing data…</p>;
  if (error) return <p role="alert" className="p-6 text-sm text-destructive">Could not load billing data. Try again.</p>;
  if (empty) return <p className="p-6 text-sm text-muted-foreground">No billing records found.</p>;
  return null;
}

function PlansPanel() {
  const { data, isLoading, isError } = useAdminBillingPlans();
  const [editing, setEditing] = useState<BillingPlanAdmin | null>(null);
  return <section aria-label="Subscription plans" className="overflow-hidden rounded-lg border">
    <StateMessage loading={isLoading} error={isError} empty={!isLoading && !isError && data?.length === 0} />
    {!!data?.length && <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Plan</th><th className="p-3">Price</th><th className="p-3">Monthly quota</th><th className="p-3">Status</th><th className="p-3">Revision</th><th className="p-3"><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.map((plan) => <tr key={plan.id} className="border-b"><td className="p-3">{plan.name} <span className="text-muted-foreground">({plan.code})</span></td><td className="p-3">{money(plan.priceVnd)}</td><td className="p-3">{plan.monthlyQuota.toLocaleString()}</td><td className="p-3">{plan.isActive ? 'Active' : 'Inactive'}</td><td className="p-3">{plan.revision}</td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => setEditing(plan)}>Edit</Button></td></tr>)}</tbody></table></div>}
    <PlanEditDialog plan={editing} open={editing !== null} onClose={() => setEditing(null)} />
  </section>;
}

function SubscriptionsPanel() {
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState('');
  const plansQuery = useAdminBillingPlans();
  const filter = { page, pageSize: 20, q: q.trim() || undefined, status: isSubscriptionStatus(status) ? status : undefined, planId: planId || undefined };
  const query = useAdminBillingSubscriptions(filter);
  return <section aria-label="Subscriptions" className="space-y-3">
    <div className="flex flex-wrap gap-2"><Input type="search" aria-label="Search subscriptions by email" placeholder="Search user email" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} /><select aria-label="Filter subscription status" className="rounded-md border bg-background px-3 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="EXPIRED">Expired</option><option value="CANCELLED">Cancelled</option></select><select aria-label="Filter subscription plan" className="rounded-md border bg-background px-3 text-sm" value={planId} onChange={(event) => { setPlanId(event.target.value); setPage(1); }}><option value="">All plans</option>{plansQuery.data?.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}</select></div>
    <div className="overflow-hidden rounded-lg border"><StateMessage loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && query.data?.items.length === 0} />{!!query.data?.items.length && <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{['User', 'Plan', 'Status', 'Quota used', 'Period ends', 'Auto renew'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{query.data.items.map((item) => <tr className="border-b" key={item.id}><td className="p-3">{item.userEmail}</td><td className="p-3">{item.planName} ({item.planCode})</td><td className="p-3">{item.status}</td><td className="p-3">{item.usedQuota.toLocaleString()} / {item.monthlyQuota.toLocaleString()}</td><td className="p-3">{date(item.currentPeriodEnd)}</td><td className="p-3">{item.autoRenew ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>}{query.data && <PageControls page={page} total={query.data.total} pageSize={query.data.pageSize} onChange={setPage} />}</div>
  </section>;
}

function PaymentsPanel() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const query = useAdminBillingPayments({ page, pageSize: 20, status: isPaymentStatus(status) ? status : undefined, from: from ? new Date(`${from}T00:00:00.000Z`).toISOString() : undefined, to: to ? nextDateExclusive(to) : undefined });
  return <section aria-label="Payment orders" className="space-y-3">
    <div className="flex flex-wrap items-end gap-3"><select aria-label="Filter payment status" className="rounded-md border bg-background px-3 py-2 text-sm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All payment statuses</option><option value="PENDING">Pending</option><option value="COMPLETED">Completed</option><option value="FAILED">Failed</option></select><div><label className="mb-1 block text-sm" htmlFor="payment-from">Created from</label><Input id="payment-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></div><div><label className="mb-1 block text-sm" htmlFor="payment-to">Created through</label><Input id="payment-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></div></div>
    <div className="overflow-hidden rounded-lg border"><StateMessage loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && query.data?.items.length === 0} />{!!query.data?.items.length && <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{['Order', 'User', 'Plan', 'Amount', 'Status', 'Transaction', 'Bank', 'Paid at', 'Created'].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{query.data.items.map((item) => <tr className="border-b" key={item.id}><td className="p-3">{item.orderCode}</td><td className="p-3">{item.userEmail}</td><td className="p-3">{item.planName}</td><td className="p-3">{money(item.amountVnd)}</td><td className="p-3">{item.status}</td><td className="p-3">{item.transactionNo ?? '—'}</td><td className="p-3">{item.bankCode ?? '—'}</td><td className="p-3">{date(item.payDate)}</td><td className="p-3">{date(item.createdAt)}</td></tr>)}</tbody></table></div>}{query.data && <PageControls page={page} total={query.data.total} pageSize={query.data.pageSize} onChange={setPage} />}</div>
  </section>;
}

function RevenuePanel() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const queryFrom = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : '';
  const queryTo = to ? nextDateExclusive(to) : '';
  const query = useAdminBillingRevenue(queryFrom, queryTo);
  const dateRangeValid = Boolean(from && to && from <= to);
  return <section aria-label="Revenue by plan" className="space-y-3">
    <div className="flex flex-wrap items-end gap-3"><div><label className="mb-1 block text-sm" htmlFor="revenue-from">From</label><Input id="revenue-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></div><div><label className="mb-1 block text-sm" htmlFor="revenue-to">To</label><Input id="revenue-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></div></div>
    <div className="overflow-hidden rounded-lg border">{!from || !to ? <p className="p-6 text-sm text-muted-foreground">Select a date range to view revenue.</p> : !dateRangeValid ? <p role="alert" className="p-6 text-sm text-destructive">The end date must be on or after the start date.</p> : <><StateMessage loading={query.isLoading} error={query.isError} empty={!query.isLoading && !query.isError && query.data?.length === 0} />{!!query.data?.length && <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Plan</th><th className="p-3">Completed orders</th><th className="p-3">Revenue</th></tr></thead><tbody>{query.data.map((item) => <tr className="border-b" key={item.planId}><td className="p-3">{item.planName} ({item.planCode})</td><td className="p-3">{item.orderCount.toLocaleString()}</td><td className="p-3">{money(item.revenueVnd)}</td></tr>)}</tbody></table>}</>}</div>
  </section>;
}

function isSubscriptionStatus(value: string): value is BillingSubscriptionAdmin['status'] {
  return value === 'ACTIVE' || value === 'EXPIRED' || value === 'CANCELLED';
}
function isPaymentStatus(value: string): value is BillingPaymentAdmin['status'] {
  return value === 'PENDING' || value === 'COMPLETED' || value === 'FAILED';
}
function nextDateExclusive(value: string): string {
  return new Date(Date.parse(`${value}T00:00:00.000Z`) + 86_400_000).toISOString();
}

export function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>('plans');
  const tabs: readonly Tab[] = ['plans', 'subscriptions', 'payments', 'revenue'];
  const content = { plans: <PlansPanel />, subscriptions: <SubscriptionsPanel />, payments: <PaymentsPanel />, revenue: <RevenuePanel /> }[tab];
  const selectAdjacentTab = (current: Tab, direction: -1 | 1) => {
    const currentIndex = tabs.indexOf(current);
    const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex] ?? 'plans';
    setTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`billing-tab-${nextTab}`)?.focus());
  };
  return <div className="space-y-6"><AdminPageHeader title="Billing management" description="Manage subscription plans and review customer subscriptions, payment orders, and revenue." eyebrow="Subscriptions & payments" />
    <div role="tablist" aria-label="Billing sections" className="flex flex-wrap gap-2">{tabs.map((item) => <Button key={item} id={`billing-tab-${item}`} role="tab" tabIndex={tab === item ? 0 : -1} aria-controls="billing-tab-panel" aria-selected={tab === item} variant={tab === item ? 'default' : 'outline'} onKeyDown={(event) => { if (event.key === 'ArrowRight') { event.preventDefault(); selectAdjacentTab(item, 1); } if (event.key === 'ArrowLeft') { event.preventDefault(); selectAdjacentTab(item, -1); } }} onClick={() => setTab(item)}>{item[0]?.toUpperCase()}{item.slice(1)}</Button>)}</div>
    <div id="billing-tab-panel" role="tabpanel" tabIndex={0} aria-labelledby={`billing-tab-${tab}`}>{content}</div>
  </div>;
}
