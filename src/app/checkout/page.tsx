'use client';

import { useCart } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-provider';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { BackButton } from '@/components/back-button';

// Format number with spaces and no decimals (e.g., 10000 -> 10 000)
const formatNumber = (n: number) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const t = translations[lang];
  const { user: authUser, profile } = useAuth();
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  useEffect(() => {
    if (cart.items.length === 0) {
      router.replace('/');
    }
  }, [cart.items, router]);

  const placeOrder = async () => {
    const newOrder: any = {
      id: `ord_${Date.now()}`,
      date: new Date().toISOString(),
      items: cart.items,
      total: cartTotal,
      userId: authUser?.uid || null,
      customer: {
        name: authUser?.displayName || null,
        email: '',
        username: profile?.username || null,
      },
    };

    setIsProcessingOrder(true);

    try {
      const response = await fetch('/api/admin/process-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newOrder }),
      });

      const result = await response.json();

      if (response.ok) {
        clearCart();
        router.push(`/order-success?orderId=${newOrder.id}`);
      } else {
        throw new Error(result.error || 'Failed to process order');
      }
    } catch (err: any) {
      console.error('Error processing order:', err);
      toast({
        title: t.orderFailedTitle || 'Order Failed',
        description: err?.message || t.orderFailedDescGeneric || 'There was an error placing your order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingOrder(false);
    }
  };

  if (cart.items.length === 0) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 pt-4 pb-36">
      <BackButton />

      {/* Order items list without card wrapper */}
      <div className="space-y-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center gap-4">
            <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="rounded-md" />
            <div className="flex-grow">
              <p className="font-medium">{item.name.replace(/\s*\([^)]*\)\s*$/, '')}</p>
              {(() => {
                const nameMatch = item.name.match(/\(([^)]+)\)$/);
                const parsedFromName = nameMatch ? nameMatch[1] : null;
                const parsedFromId = typeof item.id === 'string' && item.id.includes('__') ? item.id.split('__')[1] : null;
                const size = (item as any).selectedSize ?? parsedFromId ?? parsedFromName;
                return size ? (
                  <p className="text-xs text-muted-foreground">{t.sizeLabel || 'Размер'}: {String(size)}</p>
                ) : null;
              })()}
              <p className="text-sm text-muted-foreground">{t.quantityShort || 'Кол-во:'} {item.quantity} {t.quantityUnit || 'шт.'}</p>
            </div>
            <p>{formatNumber(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      {/* Bottom fixed bar with totals and order button (no cards) */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="mb-3 flex justify-between font-bold text-lg">
            <span>{t.subtotal || 'Subtotal'}</span>
            <span>{formatNumber(cartTotal)}</span>
          </div>
          <Button onClick={placeOrder} size="lg" className="w-full" disabled={isProcessingOrder}>
            {isProcessingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Заказать
          </Button>
        </div>
      </div>
    </div>
  );
}
