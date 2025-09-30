import React from 'react';
import { db } from '@/lib/firebase-admin';
import type { Order } from '@/lib/types';
import { cookies } from 'next/headers';
import OrdersClient from './_components/orders-client';

export const dynamic = 'force-dynamic';

function isFirestoreTimestamp(v: any): boolean {
  return !!(
    v && typeof v === 'object' && (
      typeof v.toDate === 'function' ||
      (typeof v._seconds === 'number' && typeof v._nanoseconds === 'number') ||
      (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number')
    )
  );
}

function sanitizeDeep(value: any): any {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (isFirestoreTimestamp(value)) {
    const ms = typeof value.toMillis === 'function'
      ? value.toMillis()
      : typeof value.toDate === 'function'
      ? value.toDate().getTime()
      : (value._seconds ?? value.seconds) * 1000 + Math.floor((value._nanoseconds ?? value.nanoseconds) / 1_000_000);
    return new Date(ms).toISOString();
  }
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (t === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

async function fetchOrders(): Promise<OrderWithUser[]> {
  const snap = await db.collection('orders').orderBy('date', 'desc').get().catch(() => null);
  if (!snap) return [];

  const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

  const results: OrderWithUser[] = [];
  for (const o of orders) {
    const uid = o.userId || o.customerId || null;
    let user: UserMin = { id: uid || 'unknown', displayName: null, username: null, photoURL: null };
    if (uid) {
      const userDoc = await db.collection('users').doc(String(uid)).get().catch(() => null);
      if (userDoc && userDoc.exists) {
        const u = userDoc.data() as any;
        user = { id: userDoc.id, displayName: u.displayName || null, username: u.username || null, photoURL: u.photoURL || null };
      }
    }
    results.push({ ...o, user });
  }
  return results as OrderWithUser[];
}

type UserMin = { id: string; displayName: string | null; username: string | null; photoURL: string | null };

type OrderWithUser = Order & { user?: UserMin } & { id: string };

export default async function AdminOrdersPage() {
  const orders = await fetchOrders();
  // keep cookie read to ensure the language provider can render properly on client via hydration
  await cookies();
  const safeOrders = sanitizeDeep(orders);
  return <OrdersClient orders={safeOrders as any} />;
}
