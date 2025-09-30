import React from 'react';
import { db } from '@/lib/firebase-admin';
import OrdersChartClient from '../_components/orders-chart-client';

export const dynamic = 'force-dynamic';

async function fetchOrderMeta() {
  const snap = await db.collection('orders').select('date', 'items').get().catch(() => null);
  if (!snap) return [] as Array<{ date: string; qty: number }>;
  return snap.docs.map((d) => {
    const raw: any = d.data();
    const value = raw?.date;
    let iso: string | null = null;
    if (!value) iso = null;
    else if (typeof value?.toDate === 'function') iso = value.toDate().toISOString();
    else if (value instanceof Date) iso = value.toISOString();
    else if (typeof value === 'string' || typeof value === 'number') iso = new Date(value).toISOString();
    else if (typeof value?._seconds === 'number') iso = new Date((value._seconds * 1000) + Math.floor((value._nanoseconds || 0) / 1_000_000)).toISOString();

    const items = Array.isArray(raw?.items) ? raw.items : [];
    const qty = items.reduce((sum: number, it: any) => sum + Number(it?.quantity || 0), 0);

    return { date: iso || new Date().toISOString(), qty };
  });
}

export default async function OrdersChartPage() {
  const orders = await fetchOrderMeta();
  return <OrdersChartClient orders={orders} />;
}
