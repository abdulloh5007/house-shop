import React from 'react';
import { db } from '@/lib/firebase-admin';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import type { Order } from '@/lib/types';
import { translations } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { cookies } from 'next/headers';
import { OrderActions } from '@/app/admin/orders/_components/order-actions';

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

  // Infer language from cookie set by language-provider
  const cookieStore = await cookies();
  const lang = (cookieStore.get('lang')?.value as 'ru' | 'uz') || 'ru';
  const t = translations[lang];

  const formatUZS = (n: number) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const locale = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
  const formatDateTimeText = (value: string | number | Date) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

  const u = (order as any).user as UserMin | undefined;
  const name = u?.displayName || 'Без имени';
  const uname = u?.username ? `@${u.username}` : '';

  return (
    <div className="container mx-auto px-4 py-6 pb-44">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Order meta above card */}
        <div className="text-sm text-muted-foreground text-center">
          Заказ №{(order as any).number ?? (order.id.split('_')[1] || order.id)} • {formatDateTimeText(order.date)}
        </div>

        {/* Customer card */}
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
                    <div className="text-sm text-muted-foreground">Кол-во: {item.quantity}</div>
                  </div>
                  <div className="font-medium">{formatUZS(item.price * item.quantity)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 max-w-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">{t.subtotal || 'Итого'}</div>
            <div className="text-lg font-bold">{formatUZS(order.total)}</div>
          </div>

          <OrderActions orderId={order.id} />
        </div>
      </div>

      </div>
  );
}
