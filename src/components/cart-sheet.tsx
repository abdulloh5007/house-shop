'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button, buttonVariants } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { useCart } from '@/components/providers';
import { ShoppingCart, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import TgsPlayer from '@/components/tgs-player';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';

// Format number with spaces and no decimals (e.g., 10000 -> 10 000)
const formatNumber = (n: number) => Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

export function CartSheet() {
  const { cart, removeFromCart, cartTotal, itemCount } = useCart();
  const [open, setOpen] = useState(false);
  const [emptyCartAnimation, setEmptyCartAnimation] = useState<string | null>(null);
  const { lang } = useLanguage();
  const t = translations[lang];

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const db = getFirestore(app);
        const animationsDocRef = doc(db, 'settings', 'animations');
        const docSnap = await getDoc(animationsDocRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as { emptyCartAnimation?: string | null };
          setEmptyCartAnimation(data.emptyCartAnimation ?? null);
        }
      } catch (e) {
        console.error('Failed to load animations settings', e);
      }
    };
    fetchSettings();
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <div className="relative">
          <button
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon' }),
              'flex flex-col h-14 w-20 rounded-lg gap-1 text-muted-foreground'
            )}
          >
            <ShoppingCart className="h-6 w-6" />
             <span className="text-xs">{t.cart || 'Cart'}</span>
          </button>
          {itemCount > 0 && (
            <Badge
              variant="default"
              className="absolute top-1 right-3 h-5 w-5 rounded-full p-0 flex items-center justify-center"
            >
              {itemCount}
            </Badge>
          )}
        </div>
      </SheetTrigger>
      <SheetContent side="bottom" className="w-full flex flex-col max-h-[80vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{(t.shoppingCart || 'Shopping Cart')}</SheetTitle>
        </SheetHeader>
        <Separator />
        {cart.items.length > 0 ? (
          <>
            <ScrollArea className="flex-grow pr-4">
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-4">
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="rounded-md object-cover"
                    />
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
                      <p className="text-xs text-muted-foreground">
                        {t.quantityShort || 'Кол-во:'} {item.quantity} {t.quantityUnit || 'шт.'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatNumber(item.price)}
                      </p>
                    </div>
                    <div className="text-right">
                       <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground mt-2"
                        onClick={() => removeFromCart(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Separator />
            <SheetFooter className="mt-auto">
              <div className="w-full space-y-4">
                 <div className="flex justify-between items-center font-bold text-lg">
                  <span>{t.subtotal || 'Subtotal'}</span>
                  <span>{formatNumber(cartTotal)}</span>
                </div>
                <Button asChild size="lg" className="w-full" onClick={() => setOpen(false)}>
                  <Link href="/checkout">{t.proceedToCheckout || 'Proceed to Checkout'}</Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center w-full">
            <div className="w-40 h-40 mb-4">
              {emptyCartAnimation ? (
                <TgsPlayer dataUrl={emptyCartAnimation} loop className="w-full h-full" />
              ) : (
                <ShoppingCart className="h-full w-full text-muted-foreground" />
              )}
            </div>
            <h3 className="text-xl font-semibold">{t.emptyCartTitle || 'Your cart is empty'}</h3>
            <p className="text-muted-foreground mt-2">
              {t.emptyCartDescription || 'Add some products to get started.'}
            </p>
            <Button asChild className="mt-4" onClick={() => setOpen(false)}>
              <Link href="/">{t.continueShopping || 'Continue Shopping'}</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
