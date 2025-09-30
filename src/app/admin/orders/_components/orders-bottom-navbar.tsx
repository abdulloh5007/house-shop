"use client";

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';

export function OrdersBottomNavbar() {
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (params.get('status') || 'new').toLowerCase();
  const { lang } = useLanguage();
  const t = translations[lang];

  const isOrdersList = pathname === '/admin/orders';
  const isChart = pathname.startsWith('/admin/orders/chart');

  const items = [
    {
      href: '/admin/orders?status=new',
      icon: Sparkles,
      label: t.ordersFilterNew || 'Новые',
      active: isOrdersList && (!params.get('status') || status === 'new'),
    },
    {
      href: '/admin/orders?status=accepted',
      icon: CheckCircle2,
      label: t.ordersFilterAccepted || 'Одобренные',
      active: isOrdersList && status === 'accepted',
    },
    {
      href: '/admin/orders?status=declined',
      icon: XCircle,
      label: t.ordersFilterDeclined || 'Отказанные',
      active: isOrdersList && status === 'declined',
    },
  ];

  return (
    <div className="fixed bottom-2 left-0 right-0 z-50 px-4">
      <div className="container mx-auto h-16 flex items-center justify-between rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg p-2 max-w-2xl">
        <nav className="flex items-center justify-around w-full">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'flex flex-col h-14 w-20 rounded-lg gap-1',
                  item.active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
