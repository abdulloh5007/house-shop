'use client';

import { useEffect, useState } from 'react';
import type { Order } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { lang } = useLanguage();
  const t = translations[lang];

  useEffect(() => {
    const getOrders = () => {
      window.Telegram.WebApp.CloudStorage.getItem('neoncart-orders', (err, value) => {
        if (err) {
          console.error('Error getting orders from cloud storage', err);
          setLoading(false);
          return;
        }
        if (value) {
          try {
            setOrders(JSON.parse(value));
          } catch (error) {
            console.error('Failed to parse orders from cloud storage', error);
          }
        }
        setLoading(false);
      });
    };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      getOrders();
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center">{t.loadingOrders || 'Loading orders...'}</div>;
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold font-headline mb-8">{t.ordersTitle || 'My Orders'}</h1>
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
        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{(t.orderLabel || 'Order #') + order.id.split('_')[1]}</CardTitle>
                    <CardDescription>
                      {(t.placedOn || 'Placed on') + ' ' + new Date(order.date).toLocaleDateString()}
                    </CardDescription>
                  </div>
                   <div className="text-right">
                      <p className="font-bold text-lg">${order.total.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{order.items.length + ' ' + (t.itemsCountSuffix || 'item(s)')}</p>
                   </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item) => (
                     <div key={item.id} className="flex items-center gap-4">
                        <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="rounded-md" />
                        <div className="flex-grow">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{(t.quantityShort || 'Qty:') + ' ' + item.quantity}</p>
                        </div>
                        <p>${(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
