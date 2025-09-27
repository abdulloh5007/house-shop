
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Product } from './product-provider';
import { getFirestore, doc, runTransaction, collection, serverTimestamp, increment } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { FormattedInput } from '../new/_components/formatted-input';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';

// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
  if (numStr === undefined || numStr === null) return '';
  const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Helper to remove formatting
const unformatNumber = (formattedStr: string): string => {
  return formattedStr.replace(/\s/g, "");
};

// Helper to generate transaction hash
const generateTransactionHash = (productId: string): string => {
    const randomPart = Math.random().toString(36).substring(2, 17); // 15 chars
    return `hs${randomPart}-_-${productId}`;
};


export function SellProductDialog({ product, open, onOpenChange }: { product: Product | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    const [sellingPrice, setSellingPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const { lang } = useLanguage();
    const t = translations[lang];

    useEffect(() => {
        if (open && product) {
            setSellingPrice(String(product.price));
            setQuantity('1'); // Reset quantity on open
        }
    }, [open, product]);

    const handleQuantityChange = (value: string) => {
        const numValue = parseInt(unformatNumber(value), 10);
        if (!product) return;

        if (value === '') {
            setQuantity('');
        } else if (!isNaN(numValue) && numValue >= 0 && numValue <= product.quantity) {
            setQuantity(String(numValue));
        } else if (!isNaN(numValue) && numValue > product.quantity) {
            setQuantity(String(product.quantity)); // Cap at max quantity
        }
    };
    
    // Live calculation for total amount
    const totalAmount = useMemo(() => {
        const price = parseFloat(unformatNumber(sellingPrice));
        const qty = parseInt(unformatNumber(quantity), 10);
        if (isNaN(price) || isNaN(qty) || price < 0 || qty <= 0) {
            return 0;
        }
        return price * qty;
    }, [sellingPrice, quantity]);
    
    const handleSell = async () => {
        if (!product) return;
        
        if (totalAmount <= 0) {
            toast({ title: t.errorTitle, description: t.enterCorrectSaleData, variant: "destructive" });
            return;
        }

        const sellQuantity = parseInt(unformatNumber(quantity), 10);
        const sellPrice = parseFloat(unformatNumber(sellingPrice));

        setIsSaving(true);
        try {
            const db = getFirestore(app);
            const productDocRef = doc(db, 'products', product.id);
            const balanceDocRef = doc(db, 'settings', 'balance');

            await runTransaction(db, async (transaction) => {
                const productDoc = await transaction.get(productDocRef);
                if (!productDoc.exists()) {
                    throw new Error(t.productNotFound);
                }

                const currentQuantity = productDoc.data().quantity;
                if (currentQuantity < sellQuantity) {
                    throw new Error(t.notEnoughStock);
                }

                // Calculate real profit for this sale
                const purchasePrice = product.purchasePrice || 0; // Get purchase price from product
                const itemIncome = sellPrice * sellQuantity;
                const itemCost = purchasePrice * sellQuantity;
                const itemProfit = itemIncome - itemCost;

                // 1. Decrement product quantity
                const newQuantity = currentQuantity - sellQuantity;
                transaction.update(productDocRef, { quantity: newQuantity });
                
                // 2. Prepare sale data for subcollection
                const selledCollectionRef = collection(db, `products/${product.id}/selled`);
                const saleDocRef = doc(selledCollectionRef);
                const transactionHash = generateTransactionHash(product.id); // Pass productId here

                const saleData: any = {
                    selledAt: serverTimestamp(),
                    quantity: sellQuantity,
                    sellingPrice: sellPrice,
                    purchasePrice: purchasePrice, // Store purchase price for historical data
                    totalIncome: itemIncome,
                    totalProfit: itemProfit,
                    productName: product.name,
                    productPrice: product.price, // Base price of the product
                    transactionHash: transactionHash,
                    productId: product.id,
                    orderId: `manual_${Date.now()}`, // Placeholder for manual sales
                    originalPrice: product.originalPrice || null, // Use null instead of undefined
                    discountPercentage: product.discountPercentage || null, // Use null instead of undefined
                    discountedPrice: product.discountedPrice || null, // Use null instead of undefined
                };
                
                transaction.set(saleDocRef, saleData);

                // 3. Update balance and create a balance transaction record
                transaction.set(balanceDocRef, { 
                    totalIncome: increment(itemIncome), // Update totalIncome
                    realProfit: increment(itemProfit), // Update realProfit
                }, { merge: true });

                const balanceTransactionRef = doc(collection(balanceDocRef, 'transactions'));
                transaction.set(balanceTransactionRef, {
                    createdAt: serverTimestamp(),
                    productId: product.id,
                    productName: product.name,
                    quantity: sellQuantity,
                    sellingPrice: sellPrice,
                    purchasePrice: purchasePrice,
                    totalIncome: itemIncome,
                    realProfit: itemProfit,
                    orderId: `manual_${Date.now()}`, // Placeholder for manual sales
                    saleId: saleDocRef.id,
                    transactionHash: transactionHash,
                    // Discount related fields
                    originalPrice: product.originalPrice || null,
                    discountedPrice: product.discountedPrice || null,
                    discountPercentage: product.discountPercentage || null,
                });
            });

            toast({
                title: t.soldTitle,
                description: `${product.name} (${sellQuantity} ${t.quantityUnit}) ${t.successfullySold}`,
            });
            onOpenChange(false);

        } catch (error: any) {
            console.error("Error selling product:", error);
            toast({
                title: t.saleErrorTitle,
                description: error.message || t.failedToCompleteSale,
                variant: "destructive",
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!product) return null;

    const isDiscounted = product.discountPercentage && product.discountPercentage > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm rounded-xl">
                <DialogHeader>
                    <DialogTitle>{t.sellProductTitle}</DialogTitle>
                    <DialogDescription>
                       {t.sellProductDesc}
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                     <p className="font-bold text-lg text-center">{product.name}</p>
                     
                     <div className="space-y-2">
                        <Label htmlFor="sellingPrice">{t.sellingPriceLabel}</Label>
                        <FormattedInput
                            value={sellingPrice}
                            onChange={(val) => setSellingPrice(unformatNumber(val))} // Kept for consistency, but disabled will prevent it
                            disabled={isDiscounted}
                        />
                        {isDiscounted && (
                            <p className="text-xs text-muted-foreground pt-1">
                                {t.sellingPriceFixedDueToDiscount}
                            </p>
                        )}
                     </div>

                     <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                           <Label htmlFor="quantity">{t.quantityLabel}</Label>
                           <span className="text-xs text-muted-foreground">
                            {t.inStockLabel}: {formatNumber(product.quantity)}
                           </span>
                        </div>
                        <FormattedInput
                            value={quantity}
                            onChange={handleQuantityChange}
                        />
                     </div>
                     <div className="text-center bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">{t.totalAmountLabel}</p>
                        <p className="text-2xl font-bold tabular-nums">{formatNumber(totalAmount)} UZS</p>
                    </div>
                </div>
                <DialogFooter className='grid grid-cols-2 gap-2'>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{t.cancel}</Button>
                    <Button onClick={handleSell} disabled={isSaving || totalAmount <= 0}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t.sellButton}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
