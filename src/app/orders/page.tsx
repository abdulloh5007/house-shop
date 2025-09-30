'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { useAuth } from '@/components/auth-provider';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { ChevronDown, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatNumber(n: number) {
  return Math.floor(Number(n) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { lang } = useLanguage();
  const t = translations[lang];
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        if (!user?.uid) {
          setOrders([]);
          setLoading(false);
          return;
        }
        const db = getFirestore(app);
        const q = query(collection(db, 'orders'), where('userId', '==', user.uid), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Order[];
        setOrders(rows);
      } catch (e) {
        console.error('Failed to load user orders', e);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.uid]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">{t.loadingOrders || 'Loading orders...'}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {orders.length === 0 ? (
        <div className="text-center py-16 border-dashed border-2 rounded-lg">
          <h2 className="text-xl font-semibold">{t.noOrdersYet || 'No orders yet'}</h2>
          <p className="text-muted-foreground mt-2">
            {t.noOrdersHint || "Looks like you haven't placed any orders."}
          </p>
          <Button asChild className="mt-4">
            <Link href="/">{t.startShopping || 'Start Shopping'}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isOpen = !!expanded[order.id];
            const shortId = order.id.split('_')[1] || order.id;
            const placedOn = new Date((order as any).date).toLocaleDateString();
            const statusRaw = String((order as any).status || 'pending').toLowerCase();
            const statusInfo =
              statusRaw === 'accepted'
                ? {
                    label: t.statusAccepted || 'Одобрен',
                    color:
                      'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
                    icon: CheckCircle2,
                  }
                : statusRaw === 'declined'
                ? {
                    label: t.statusDeclined || 'Отказан',
                    color:
                      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
                    icon: XCircle,
                  }
                : {
                    label: t.statusPending || 'Ожидает',
                    color:
                      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
                    icon: Clock,
                  };
            const Icon = statusInfo.icon;
            return (
              <div key={order.id} className="border rounded-lg overflow-hidden">
                {/* Header row: order id, date, status, toggle */}
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{(t.orderLabel || 'Order #') + shortId}</div>
                    <div className="text-sm text-muted-foreground">{(t.placedOn || 'Placed on') + ' ' + placedOn}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
                        statusInfo.color
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {statusInfo.label}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => toggle(order.id)} aria-label={isOpen ? 'Collapse' : 'Expand'}>
                      <ChevronDown className={cn('h-5 w-5 transition-transform', isOpen ? 'rotate-180' : '')} />
                    </Button>
                  </div>
                </div>

                {/* Details (collapsible) */}
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="space-y-4">
                      {order.items.map((item, idx) => {
                        const idStr = String((item as any)?.id ?? '');
                        const parsedFromId = typeof idStr === 'string' && idStr.includes('__') ? idStr.split('__')[1] : null;
                        const nameStr = String((item as any)?.name ?? '');
                        const nameMatch = nameStr.match(/\(([^)]+)\)$/);
                        const parsedFromName = nameMatch ? nameMatch[1] : null;
                        const size = (item as any).selectedSize ?? parsedFromId ?? parsedFromName;
                        const nameBase = nameStr.replace(/\s*\([^)]*\)\s*$/, '');
                        const itemKey = `${String((item as any).id)}__${String(size ?? 'no-size')}__${idx}`;
                        return (
                          <div key={itemKey} className="flex items-center gap-4">
                            <Image src={(item as any).imageUrl} alt={nameStr} width={64} height={64} className="rounded-md" />
                            <div className="flex-grow min-w-0">
                              <p className="font-medium truncate" title={nameBase}>{nameBase}</p>
                              {size ? (
                                <p className="text-xs text-muted-foreground">{(t.sizeLabel || 'Размер') + ': '}{String(size)}</p>
                              ) : null}
                              <p className="text-sm text-muted-foreground">{(t.quantityShort || 'Qty:') + ' ' + (item as any).quantity}</p>
                            </div>
                            <p className="whitespace-nowrap">{formatNumber(Number((item as any).price) * Number((item as any).quantity))}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between items-center mt-4">
                      <p className='text-lg'>{t.all}</p>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatNumber(Number((order as any).total) || 0)}</p>
                        <p className="text-xs text-muted-foreground">{order.items.length + ' ' + (t.itemsCountSuffix || 'item(s)')}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
