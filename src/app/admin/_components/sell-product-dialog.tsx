
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    const [selectedSize, setSelectedSize] = useState<string>('');
    const { toast } = useToast();
    const { lang } = useLanguage();
    const t = translations[lang];

    useEffect(() => {
        if (open && product) {
            setSellingPrice(String(product.price));
            setQuantity('1'); // Reset quantity on open
            const sizes = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
            if (sizes.length > 0) {
                const first = sizes[0];
                setSelectedSize(String(first.size));
            } else {
                setSelectedSize('');
            }
        }
    }, [open, product]);

    const handleQuantityChange = (value: string) => {
        const numValue = parseInt(unformatNumber(value), 10);
        if (!product) return;
        const sizes = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
        const sizeStock = sizes.length > 0 && selectedSize !== ''
            ? Number((sizes.find((s: any) => String(s.size) === String(selectedSize))?.quantity) || 0)
            : product.quantity;

        if (value === '') {
            setQuantity('');
        } else if (!isNaN(numValue) && numValue >= 0 && numValue <= sizeStock) {
            setQuantity(String(numValue));
        } else if (!isNaN(numValue) && numValue > sizeStock) {
            setQuantity(String(sizeStock)); // Cap at max quantity by size
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
        const sizeToSell = selectedSize;

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

                const data = productDoc.data() as any;
                const currentQuantity = Number(data.quantity || 0);
                const sizesArr = Array.isArray(data.sizes) ? data.sizes : [];

                if (!sizeToSell || sizesArr.length === 0) {
                    throw new Error(t.addAtLeastOneSize || 'Добавьте хотя бы один размер.');
                }

                const sizeIndex = sizesArr.findIndex((s: any) => String(s.size) === String(sizeToSell));
                if (sizeIndex === -1) {
                    throw new Error(t.selectSizePlaceholder || 'Выберите размер');
                }

                const sizeStock = Number(sizesArr[sizeIndex]?.quantity || 0);
                if (sizeStock < sellQuantity) {
                    throw new Error(t.notEnoughStock);
                }

                // Calculate real profit for this sale
                const purchasePrice = (product as any).purchasePrice || 0; // Get purchase price from product
                const itemIncome = sellPrice * sellQuantity;
                const itemCost = purchasePrice * sellQuantity;
                const itemProfit = itemIncome - itemCost;

                // 1. Decrement product total quantity and the selected size quantity
                const newQuantity = currentQuantity - sellQuantity;
                const newSizes = sizesArr.map((s: any, idx: number) => (
                    idx === sizeIndex ? { ...s, quantity: Number(s.quantity || 0) - sellQuantity } : s
                ));
                transaction.update(productDocRef, { quantity: newQuantity, sizes: newSizes });
                
                // 2. Prepare sale data for subcollection
                const selledCollectionRef = collection(db, `products/${product.id}/selled`);
                const saleDocRef = doc(selledCollectionRef);
                const transactionHash = generateTransactionHash(product.id); // Pass productId here

                const saleData: any = {
                    selledAt: serverTimestamp(),
                    quantity: sellQuantity,
                    size: sizeToSell,
                    sellingPrice: sellPrice,
                    purchasePrice: purchasePrice, // Store purchase price for historical data
                    totalIncome: itemIncome,
                    totalProfit: itemProfit,
                    productName: product.name,
                    productPrice: product.price, // Base price of the product
                    transactionHash: transactionHash,
                    productId: product.id,
                    orderId: `manual_${Date.now()}`, // Placeholder for manual sales
                    originalPrice: (product as any).originalPrice || null, // Use null instead of undefined
                    discountPercentage: (product as any).discountPercentage || null, // Use null instead of undefined
                    discountedPrice: (product as any).discountedPrice || null, // Use null instead of undefined
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
                    size: sizeToSell,
                    sellingPrice: sellPrice,
                    purchasePrice: purchasePrice,
                    totalIncome: itemIncome,
                    realProfit: itemProfit,
                    orderId: `manual_${Date.now()}`, // Placeholder for manual sales
                    saleId: saleDocRef.id,
                    transactionHash: transactionHash,
                    // Discount related fields
                    originalPrice: (product as any).originalPrice || null,
                    discountedPrice: (product as any).discountedPrice || null,
                    discountPercentage: (product as any).discountPercentage || null,
                });
            });

            toast({
                title: t.soldTitle,
                description: `${product.name} (${sellQuantity} ${t.quantityUnit}${selectedSize ? `, ${t.selectSizeLabel}: ${selectedSize}` : ''}) ${t.successfullySold}`,
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

                     {/* Size selection */}
                     <div className="space-y-2">
                        <Label>{t.selectSizeLabel}</Label>
                        <Select value={selectedSize} onValueChange={(val) => { setSelectedSize(val); setQuantity('1'); }}>
                            <SelectTrigger>
                                <SelectValue placeholder={t.selectSizePlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {Array.isArray((product as any).sizes) && (product as any).sizes.length > 0 ? (
                                    (product as any).sizes.map((s: any, idx: number) => (
                                        <SelectItem key={idx} value={String(s.size)}>
                                            {String(s.size)} ({t.inStockLabel.toLowerCase()}: {formatNumber(s.quantity)})
                                        </SelectItem>
                                    ))
                                ) : null}
                            </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                           <Label htmlFor="quantity">{t.quantityLabel}</Label>
                           <span className="text-xs text-muted-foreground">
                            {t.inStockLabel}: {(() => {
                                const sizes = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
                                const sizeStock = sizes.length > 0 && selectedSize !== ''
                                    ? Number((sizes.find((s: any) => String(s.size) === String(selectedSize))?.quantity) || 0)
                                    : 0;
                                return formatNumber(sizeStock);
                            })()}
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
                    <Button onClick={handleSell} disabled={isSaving || totalAmount <= 0 || !selectedSize}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t.sellButton}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
