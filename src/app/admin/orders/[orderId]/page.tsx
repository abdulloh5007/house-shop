import React from 'react';
import { db } from '@/lib/firebase-admin';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Params { params: Promise<{ orderId: string }> }

type UserMin = { id: string; displayName: string | null; username: string | null; photoURL: string | null };

function initials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const [a, b] = [parts[0], parts[1]];
  return ((a?.[0] ?? '') + (b?.[0] ?? '')).toUpperCase() || (a?.[0]?.toUpperCase() ?? 'U');
}

async function fetchOrder(id: string): Promise<(Order & { user?: UserMin }) | null> {
  const doc = await db.collection('orders').doc(id).get().catch(() => null);
  if (!doc || !doc.exists) return null;
  const order = { id: doc.id, ...(doc.data() as any) } as Order & { userId?: string; customerId?: string };

  const uid = (order as any).userId || (order as any).customerId || null;
  if (uid) {
    const udoc = await db.collection('users').doc(String(uid)).get().catch(() => null);
    if (udoc && udoc.exists) {
      const u = udoc.data() as any;
      (order as any).user = { id: udoc.id, displayName: u.displayName || null, username: u.username || null, photoURL: u.photoURL || null } as UserMin;
    }
  }
  return order as any;
}

export default async function AdminOrderDetailsPage({ params }: Params) {
  const { orderId } = await params;
  const order = await fetchOrder(orderId);
  if (!order) {
    return <div className="container mx-auto px-4 py-6 text-center text-muted-foreground">Заказ не найден.</div>;
  }

  const u = (order as any).user as UserMin | undefined;
  const name = u?.displayName || 'Без имени';
  const uname = u?.username ? `@${u.username}` : '';

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {u?.photoURL ? (
                <AvatarImage src={u.photoURL} alt={name} />
              ) : (
                <AvatarFallback className="text-sm font-medium">{initials(name)}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <div className="text-base font-semibold truncate" title={name}>{name}</div>
              {uname && <div className="text-sm text-muted-foreground truncate" title={uname}>{uname}</div>}
            </div>
            <div className="ml-auto text-right text-sm text-muted-foreground">
              <div>Заказ №{order.id.split('_')[1] || order.id}</div>
              <div>{new Date(order.date).toLocaleString()}</div>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="px-4 py-4 space-y-3">
            {order.items.map((item, idx) => {
              const nameBase = item.name.replace(/\s*\([^)]*\)\s*$/, '');
              const nameMatch = item.name.match(/\(([^)]+)\)$/);
              const parsedFromName = nameMatch ? nameMatch[1] : null;
              const parsedFromId = typeof (item as any).id === 'string' && (item as any).id.includes('__') ? (item as any).id.split('__')[1] : null;
              const size = (item as any).selectedSize ?? parsedFromId ?? parsedFromName;
              return (
                <div key={(item as any).id ?? idx} className="flex items-center gap-4">
                  <Image src={item.imageUrl} alt={nameBase} width={64} height={64} className="rounded-md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={nameBase}>{nameBase}</div>
                    {size ? (
                      <div className="text-xs text-muted-foreground">Размер: {String(size)}</div>
                    ) : null}
                    <div className="text-sm text-muted-foreground">Количество: {item.quantity}</div>
                  </div>
                  <div className="font-medium">${(item.price * item.quantity).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
          <div className="h-px bg-border" />
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Итого</div>
            <div className="text-lg font-bold">${order.total.toFixed(2)}</div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <form action={`/api/admin/orders/${order.id}/decline`} method="post">
            <Button type="submit" variant="destructive" className="w-full h-11 rounded-xl">Отказать</Button>
          </form>
          <form action={`/api/admin/orders/${order.id}/accept`} method="post">
            <Button type="submit" className="w-full h-11 rounded-xl">Принять</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
