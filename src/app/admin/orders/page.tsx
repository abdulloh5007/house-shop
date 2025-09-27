import React from 'react';
import { db } from '@/lib/firebase-admin';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import Image from 'next/image';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

// This page lists orders with minimal info in a clean card, with a Details button linking to /admin/orders/[orderId]

async function fetchOrders(): Promise<OrderWithUser[]> {
  // Assume orders are persisted in Firestore collection 'orders'
  // If you store elsewhere, adapt accordingly.
  const snap = await db.collection('orders').orderBy('date', 'desc').get().catch(() => null);
  if (!snap) return [];

  const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any[];

  // Enrich with user minimal profile for avatar/name/username
  const results: OrderWithUser[] = [];
  for (const o of orders) {
    const uid = o.userId || o.customerId || null;
    let user: UserMin = { id: uid || 'unknown', displayName: o.customer?.name || null, username: null, photoURL: null };
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

function initials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const [a, b] = [parts[0], parts[1]];
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || (a?.[0]?.toUpperCase() ?? 'U');
}

export default async function AdminOrdersPage() {
  const orders = await fetchOrders();

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto">
        <Card className="rounded-2xl border bg-card overflow-hidden">
          {orders.map((order, idx) => {
            const showSeparator = idx < orders.length - 1;
            const u = order.user;
            const name = u?.displayName || 'Без имени';
            const uname = u?.username ? `@${u.username}` : '';
            const itemCount = order.items?.length || 0;

            return (
              <React.Fragment key={order.id}>
                <div className="w-full flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      {u?.photoURL ? (
                        <AvatarImage src={u.photoURL} alt={name} />
                      ) : (
                        <AvatarFallback className="text-sm font-medium">
                          {initials(name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium truncate" title={name}>{name}</div>
                      <div className="text-sm text-muted-foreground truncate">
                        Заказ №{order.id.split('_')[1] || order.id} • {new Date(order.date).toLocaleDateString()} • {itemCount} шт.
                      </div>
                      {uname && (
                        <div className="text-xs text-muted-foreground truncate" title={uname}>{uname}</div>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="secondary" size="sm" className="rounded-full">
                    <Link href={`/admin/orders/${order.id}`}>Детали</Link>
                  </Button>
                </div>
                {showSeparator && <div className="h-px bg-border" />}
              </React.Fragment>
            );
          })}
          {orders.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground">Заказы не найдены.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
