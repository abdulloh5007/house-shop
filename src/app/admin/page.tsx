
'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Loader2, Plus, X, ChevronLeft, ChevronRight, MoreVertical, Edit, Trash2, Search, Percent, TicketPercent, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useProducts, Product } from "./_components/product-provider";
import Image from "next/image";
import { BackButton } from "@/components/back-button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import useEmblaCarousel from 'embla-carousel-react'
import Autoplay from 'embla-carousel-autoplay'
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getFirestore, doc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { SellProductDialog } from './_components/sell-product-dialog';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';


// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
  if (numStr === undefined || numStr === null) return '';
  const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function DeleteConfirmationDialog({ product, open, onOpenChange, onConfirm }: { product: Product, open: boolean, onOpenChange: (open: boolean) => void, onConfirm: () => void }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();
  const t = translations[lang];

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      const db = getFirestore(app);
      await deleteDoc(doc(db, "products", product.id));
      toast({
        title: t.productDeletedTitle,
        description: `${t.productLabel} "${product.name}" ${t.wasSuccessfullyDeleted}`,
      });
      onConfirm(); // Callback to refresh or update UI
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: t.deleteErrorTitle,
        description: t.errorDeletingProduct,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>{t.areYouSureTitle}</DialogTitle>
          <DialogDescription>
            {t.deleteConfirmationDesc}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <p>{t.youAreAboutToDelete}</p>
          <p className="font-bold">{product.name}</p>
          <p className="text-sm text-muted-foreground">{formatNumber(product.price)} UZS</p>
        </div>
        <DialogFooter className='grid grid-cols-2 gap-2'>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>{t.cancel}</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.deleteButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiscountDialog({ product, open, onOpenChange }: { product: Product | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const [discount, setDiscount] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();
  const t = translations[lang];

  useEffect(() => {
    if (open && product) {
      setDiscount(product.discountPercentage ? String(product.discountPercentage) : '');
    }
  }, [open, product]);

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^$|^[0-9]{1,2}$|^100$/.test(value)) {
      setDiscount(value);
    }
  };

  const handleSave = async () => {
    if (!product) return;
    setIsSaving(true);
    try {
      const db = getFirestore(app);
      const productDocRef = doc(db, 'products', product.id);
      const discountPercentage = discount ? parseFloat(discount) : 0;
      const originalPrice = product.originalPrice || product.price;

      if (discountPercentage > 0) {
        const newPrice = Math.round(originalPrice * (1 - discountPercentage / 100));
        await updateDoc(productDocRef, {
          price: newPrice,
          originalPrice: originalPrice,
          discountPercentage: discountPercentage,
          discountedPrice: newPrice,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: t.discountSetTitle,
          description: `${t.discountForProduct} "${product.name}" ${t.wasSetTo} ${discount}%.`,
        });
      } else {
        // Remove discount
        await updateDoc(productDocRef, {
          price: originalPrice,
          originalPrice: null,
          discountPercentage: null,
          updatedAt: serverTimestamp(),
        });
        toast({
          title: t.discountRemovedTitle,
          description: `${t.discountForProduct} "${product.name}" ${t.wasRemoved}`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving discount:", error);
      toast({
        title: t.errorTitle,
        description: t.failedToSetDiscount,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };


  const priceBeforeDiscount = product?.originalPrice || product?.price || 0;
  const discountPercentage = parseFloat(discount);
  const newPrice = isNaN(discountPercentage) || discount === ''
    ? priceBeforeDiscount
    : priceBeforeDiscount * (1 - discountPercentage / 100);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>{t.setDiscountTitle}</DialogTitle>
          <DialogDescription>
            {t.setDiscountDesc}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <p className="font-bold text-lg">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {t.currentPriceLabel}:
              <span className={product.originalPrice ? 'line-through ml-2' : ''}>
                {formatNumber(product.originalPrice || product.price)} UZS
              </span>
              {product.originalPrice && <span className="font-bold text-primary ml-2">{formatNumber(product.price)} UZS</span>}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discount">{t.discountLabel} (%)</Label>
            <div className="relative">
              <Input
                id="discount"
                type="text"
                inputMode="numeric"
                value={discount}
                onChange={handleDiscountChange}
                placeholder={t.discountPlaceholder}
                className="pr-8"
              />
              <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          <div className="text-center bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground">{t.newPriceLabel}</p>
            <p className="text-2xl font-bold">{formatNumber(Math.round(newPrice))} UZS</p>
          </div>
        </div>
        <DialogFooter className='grid grid-cols-2 gap-2'>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>{t.cancel}</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ProductGallery({ product, onSetDiscount, onSellProduct }: { product: Product, onSetDiscount: (product: Product) => void, onSellProduct: (product: Product) => void }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cardCarouselSelectedIndex, setCardCarouselSelectedIndex] = useState(0);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const { lang } = useLanguage();
  const t = translations[lang];

  // Card carousel || [Autoplay({ delay: 4000, stopOnInteraction: false })]
  const [cardEmblaRef, cardEmblaApi] = useEmblaCarousel({ loop: true },);

  // Gallery carousels
  const [mainEmblaRef, mainEmblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
  const [thumbEmblaRef, thumbEmblaApi] = useEmblaCarousel({ containScroll: 'keepSnaps', dragFree: true, align: 'start' });

  // ZOOM / PAN state (applies to active slide only)
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // visual pixels offset (center-based)
  const isPanningRef = useRef(false);

  // Refs to measure sizes for the active slide
  const activeSlideRef = useRef<HTMLDivElement | null>(null);
  const activeImgRef = useRef<HTMLImageElement | null>(null);

  // pinch helpers
  const pinchRef = useRef({
    startDist: 0,
    startScale: 1,
    startPos: { x: 0, y: 0 },
    focal: { x: 0, y: 0 },
  });

  // drag helpers
  const dragRef = useRef({
    startClientX: 0,
    startClientY: 0,
    startPos: { x: 0, y: 0 }
  });

  const maxScale = 4;

  // Utility: clamp pos so scaled image never reveals empty space
  const clampPos = useCallback((x: number, y: number, s: number) => {
    const container = activeSlideRef.current;
    const img = activeImgRef.current;
    if (!container || !img) return { x: 0, y: 0 };

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.clientWidth; // current displayed size
    const ih = img.clientHeight;

    const scaledW = iw * s;
    const scaledH = ih * s;

    const maxX = Math.max(0, (scaledW - cw) / 2);
    const maxY = Math.max(0, (scaledH - ch) / 2);

    const nx = Math.max(-maxX, Math.min(maxX, x));
    const ny = Math.max(-maxY, Math.min(maxY, y));

    return { x: nx, y: ny };
  }, []);

  // Reset zoom (when changing slide / closing)
  const resetZoom = useCallback(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  }, []);

  const onCardCarouselSelect = useCallback(() => {
    if (!cardEmblaApi) return;
    setCardCarouselSelectedIndex(cardEmblaApi.selectedScrollSnap());
  }, [cardEmblaApi]);

  useEffect(() => {
    if (!cardEmblaApi) return;
    onCardCarouselSelect();
    cardEmblaApi.on('select', onCardCarouselSelect);
    cardEmblaApi.on('reInit', onCardCarouselSelect);
  }, [cardEmblaApi, onCardCarouselSelect]);


  // Embla selection sync
  const onThumbClick = useCallback((index: number) => {
    if (!mainEmblaApi) return;
    mainEmblaApi.scrollTo(index);
    resetZoom();
  }, [mainEmblaApi, resetZoom]);

  const onSelect = useCallback(() => {
    if (!mainEmblaApi || !thumbEmblaApi) return;
    const newSelectedIndex = mainEmblaApi.selectedScrollSnap();
    setSelectedIndex(newSelectedIndex);
    if (thumbEmblaApi.scrollSnapList().length > newSelectedIndex) {
      thumbEmblaApi.scrollTo(newSelectedIndex);
    }
    resetZoom();
  }, [mainEmblaApi, thumbEmblaApi, resetZoom]);

  useEffect(() => {
    if (!mainEmblaApi) return;
    onSelect();
    mainEmblaApi.on('select', onSelect);
    mainEmblaApi.on('reInit', onSelect);
    return () => {
      if (mainEmblaApi) {
        mainEmblaApi.off('select', onSelect);
        mainEmblaApi.off('reInit', onSelect);
      }
    }
  }, [mainEmblaApi, onSelect]);

  const scrollPrev = useCallback(() => mainEmblaApi?.scrollPrev(), [mainEmblaApi]);
  const scrollNext = useCallback(() => mainEmblaApi?.scrollNext(), [mainEmblaApi]);

  const handleOpenGallery = (index: number) => {
    setGalleryOpen(true);
    // scroll to the requested slide after embla init
    setTimeout(() => {
      if (mainEmblaApi) {
        mainEmblaApi.reInit();
        mainEmblaApi.scrollTo(index, true);
      }
      if (thumbEmblaApi) {
        thumbEmblaApi.reInit();
      }
    }, 80);
  };

  // --- Wheel zoom (desktop) around pointer ---
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!activeSlideRef.current) return;

    const rect = activeSlideRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left - rect.width / 2; // focal relative to center
    const pointerY = e.clientY - rect.top - rect.height / 2;

    const delta = -e.deltaY * 0.002; // sensitivity
    const newScaleUnclamped = scale * (1 + delta);
    const newScale = Math.min(maxScale, Math.max(1, newScaleUnclamped));
    const f = newScale / scale;

    // pos' = pos + (1 - f) * focal
    const newPosX = pos.x + (1 - f) * pointerX;
    const newPosY = pos.y + (1 - f) * pointerY;

    const clamped = clampPos(newPosX, newPosY, newScale);
    setScale(newScale);
    setPos(clamped);
  };

  // double click to zoom at pointer
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeSlideRef.current) return;
    const rect = activeSlideRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left - rect.width / 2;
    const pointerY = e.clientY - rect.top - rect.height / 2;

    const targetScale = scale > 1.1 ? 1 : 2;
    const f = targetScale / scale;
    const newPosX = pos.x + (1 - f) * pointerX;
    const newPosY = pos.y + (1 - f) * pointerY;
    const clamped = clampPos(newPosX, newPosY, targetScale);
    setScale(targetScale);
    setPos(clamped);
  };

  // Pointer drag (mouse / pen / single pointer) for panning when zoomed
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only active slide should handle, and only when zoomed (>1)
    if (scale <= 1) return;
    const target = e.currentTarget;
    try { (target as Element).setPointerCapture(e.pointerId); } catch { }
    isPanningRef.current = true;
    dragRef.current.startClientX = e.clientX;
    dragRef.current.startClientY = e.clientY;
    dragRef.current.startPos = { ...pos };
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    const newPos = {
      x: dragRef.current.startPos.x + dx,
      y: dragRef.current.startPos.y + dy
    };
    const clamped = clampPos(newPos.x, newPos.y, scale);
    setPos(clamped);
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      try { (e?.currentTarget as Element)?.releasePointerCapture?.(e?.pointerId); } catch { }
      e?.stopPropagation();
    }
  };

  // Touch handlers: single-touch pan when zoomed, two-finger pinch to zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!activeSlideRef.current) return;
    if (e.touches.length === 1 && scale > 1) {
      // start single-finger pan (we'll use pointer handlers for mouse/pointer)
      const t = e.touches[0];
      dragRef.current.startClientX = t.clientX;
      dragRef.current.startClientY = t.clientY;
      dragRef.current.startPos = { ...pos };
      isPanningRef.current = true;
      e.stopPropagation();
    } else if (e.touches.length >= 2) {
      // start pinch
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      pinchRef.current.startDist = dist;
      pinchRef.current.startScale = scale;
      pinchRef.current.startPos = { ...pos };

      // focal point (midpoint) relative to container center
      const rect = activeSlideRef.current.getBoundingClientRect();
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;
      pinchRef.current.focal = {
        x: midX - rect.left - rect.width / 2,
        y: midY - rect.top - rect.height / 2
      };

      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!activeSlideRef.current) return;

    if (e.touches.length === 1 && isPanningRef.current && scale > 1) {
      const t = e.touches[0];
      const dx = t.clientX - dragRef.current.startClientX;
      const dy = t.clientY - dragRef.current.startClientY;
      const newPos = {
        x: dragRef.current.startPos.x + dx,
        y: dragRef.current.startPos.y + dy
      };
      const clamped = clampPos(newPos.x, newPos.y, scale);
      setPos(clamped);
      e.preventDefault();
      e.stopPropagation();
    } else if (e.touches.length >= 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const dist = Math.hypot(dx, dy);
      const startDist = pinchRef.current.startDist || 1;
      const factor = dist / startDist;
      const newScaleUnclamped = pinchRef.current.startScale * factor;
      const newScale = Math.min(maxScale, Math.max(1, newScaleUnclamped));
      const fRelative = newScale / pinchRef.current.startScale;

      // pos' = startPos + (1 - fRelative) * focal
      const focal = pinchRef.current.focal;
      const newPosX = pinchRef.current.startPos.x + (1 - fRelative) * focal.x;
      const newPosY = pinchRef.current.startPos.y + (1 - fRelative) * focal.y;
      const clamped = clampPos(newPosX, newPosY, newScale);
      setScale(newScale);
      setPos(clamped);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    // stop pan/pinch
    isPanningRef.current = false;
    pinchRef.current.startDist = 0;
  };

  // when scale changes, re-clamp pos
  useEffect(() => {
    const clamped = clampPos(pos.x, pos.y, scale);
    if (clamped.x !== pos.x || clamped.y !== pos.y) {
      setPos(clamped);
    }
  }, [scale, pos.x, pos.y, clampPos]);

  // reset zoom if slide changes or gallery closes
  useEffect(() => {
    resetZoom();
  }, [selectedIndex, resetZoom]);

  // swipe-to-close (only when not zoomed)
  const touchSwipe = useRef({ startY: 0, endY: 0 });
  const onSwipeStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scale > 1) return;
    touchSwipe.current.startY = e.touches[0]?.clientY ?? 0;
  };
  const onSwipeMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scale > 1) return;
    touchSwipe.current.endY = e.touches[0]?.clientY ?? 0;
  };
  const onSwipeEnd = () => {
    if (scale > 1) return;
    const dist = touchSwipe.current.startY - touchSwipe.current.endY;
    if (dist < -120) setGalleryOpen(false);
    touchSwipe.current.startY = 0;
    touchSwipe.current.endY = 0;
  };

  if (!product.imageUrls || product.imageUrls.length === 0) {
    return (
      <div className="aspect-[3/4] w-full relative bg-muted rounded-lg flex items-center justify-center">
        <span className="text-sm text-muted-foreground">{t.noImage}</span>
      </div>
    );
  }

  return (
    <>
      <div className="aspect-[3/4] w-full relative group cursor-pointer overflow-hidden rounded-t-lg" ref={cardEmblaRef}>
        <div className="h-full flex">
          {product.imageUrls.map((url, index) => (
            <div
              key={index}
              className="flex-[0_0_100%] h-full min-w-0 relative"
              onClick={() => handleOpenGallery(index)}
            >
              <Image
                src={url}
                alt={`${product.name} image ${index + 1}`}
                fill
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {product.discountPercentage && product.discountPercentage > 0 && (
          <div className="absolute bottom-2 left-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-r-full shadow-lg tabular-nums">
            -{product.discountPercentage}%
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-10 h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/admin/edit/${product.id}`} className="flex items-center gap-2 cursor-pointer">
                <Edit className="h-4 w-4" />
                <span>{t.edit}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setProductToDelete(product)} className="flex items-center gap-2 cursor-pointer">
              <Trash2 className="h-4 w-4" />
              <span>{t.deleteButton}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {product.imageUrls.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {product.imageUrls.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-white/70 backdrop-blur-sm shadow-md transition-all',
                  i === cardCarouselSelectedIndex ? 'w-4' : ''
                )}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-2 border-t-0 rounded-b-lg p-1">
        <div className="pt-3">
          <div className="flex items-baseline gap-2">
            <p className="font-semibold text-[16px] text-primary tabular-nums">{formatNumber(product.price)}</p>
            {product.originalPrice && (
              <p className="text-xs text-muted-foreground line-through tabular-nums">
                {formatNumber(product.originalPrice)}
              </p>
            )}
          </div>
          <h2 className="text-[14px] font-normal text-muted-foreground truncate mt-1">{product.name}</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={() => onSellProduct(product)}><ShoppingCart /></Button>
          <Button variant="outline" size="sm" onClick={() => onSetDiscount(product)}><TicketPercent /></Button>
        </div>

      </div>
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent
          hideDefaultClose
          className="p-0 border-0 bg-black/95 w-full h-full max-w-full max-h-screen rounded-none flex flex-col"
        >
          <DialogTitle className="sr-only">Gallery</DialogTitle>

          {/* viewport for embla; we attach handlers per active slide below */}
          <div
            className="relative w-full flex-grow overflow-hidden"
            ref={mainEmblaRef}
            onWheel={(e) => { /* wheel handled per active slide */ e.stopPropagation(); }}
          >
            <div className="h-full flex">
              {product.imageUrls.map((url, index) => {
                const isActive = index === selectedIndex;
                return (
                  <div
                    key={index}
                    // slide container
                    ref={isActive ? activeSlideRef : undefined}
                    className={cn(
                      "flex-[0_0_100%] flex items-center justify-center h-full min-w-0 relative overflow-hidden",
                      isActive ? "z-30" : "z-10"
                    )}
                    // attach unified handlers only on the active slide container
                    onPointerDown={isActive ? (e) => { handlePointerDown(e); } : undefined}
                    onPointerMove={isActive ? handlePointerMove : undefined}
                    onPointerUp={isActive ? handlePointerUp : undefined}
                    onPointerCancel={isActive ? handlePointerUp : undefined}
                    onTouchStart={isActive ? (e) => { handleTouchStart(e); onSwipeStart(e); } : undefined}
                    onTouchMove={isActive ? (e) => { handleTouchMove(e); onSwipeMove(e); } : undefined}
                    onTouchEnd={isActive ? (e) => { handleTouchEnd(e); onSwipeEnd(); } : undefined}
                    onDoubleClick={isActive ? handleDoubleClick : undefined}
                    onWheel={isActive ? handleWheel : undefined}
                  >
                    {/* image element (not Next Image here) */}
                    <img
                      ref={isActive ? activeImgRef : undefined}
                      src={url}
                      alt={`${product.name} image ${index + 1}`}
                      className="object-contain max-w-full max-h-full transition-transform duration-100 will-change-transform"
                      style={
                        isActive
                          ? {
                            transform: `translate(${pos.x / scale}px, ${pos.y / scale}px) scale(${scale})`,
                            touchAction: 'none',
                          }
                          : { transform: 'none' }
                      }
                      onLoad={() => {
                        // when image loads, re-clamp pos (size measurements ready)
                        const clamped = clampPos(pos.x, pos.y, scale);
                        setPos(clamped);
                      }}
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* custom close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70 
                       text-white hover:text-white z-40"
            onClick={() => setGalleryOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {product.imageUrls.length > 1 && (
            <>
              <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40" onClick={scrollPrev}>
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40" onClick={scrollNext}>
                <ChevronRight className="h-6 w-6" />
              </Button>

              <div className="flex-shrink-0 p-4 w-full flex justify-center">
                <div className="overflow-hidden" ref={thumbEmblaRef}>
                  <div className="flex gap-3 items-center">
                    {product.imageUrls.map((url, index) => (
                      <button
                        key={index}
                        onClick={() => onThumbClick(index)}
                        className={cn(
                          "flex-[0_0_auto] aspect-square rounded-md overflow-hidden relative transition-all duration-300",
                          "w-14 h-14", // немного больше thumbs
                          index === selectedIndex ? "opacity-100 scale-110" : "opacity-60 hover:opacity-100"
                        )}
                      >
                        <Image src={url} alt={`thumb ${index + 1}`} fill className="object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {productToDelete && (
        <DeleteConfirmationDialog
          product={productToDelete}
          open={!!productToDelete}
          onOpenChange={() => setProductToDelete(null)}
          onConfirm={() => {
            // The provider will handle the state update
          }}
        />
      )}
    </>
  );
}

export default function AdminPage() {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [discountProduct, setDiscountProduct] = useState<Product | null>(null);
  const [sellProduct, setSellProduct] = useState<Product | null>(null);
  const { lang } = useLanguage();
  const t = translations[lang];

  const filteredProducts = useMemo(() => {
    if (!searchTerm) {
      return products;
    }
    return products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  return (
    <div className="container mx-auto px-4 py-8">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t.productsTitle}</h1>
        <Button asChild>
          <Link href="/admin/new">
            <Plus className="mr-2 h-4 w-4" />
            {t.addProduct}
          </Link>
        </Button>
      </div>

      <div className="relative mb-6">
        <Input
          placeholder={t.searchByNamePlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">
            {searchTerm ? t.productsNotFound : t.noProductsYet}
          </p>
          {!searchTerm && (
            <p className="text-muted-foreground mt-1">
              {t.clickAddProductToStart}
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
          {filteredProducts.map((product) => (
            <div key={product.id} className="flex flex-col">
              <ProductGallery product={product} onSetDiscount={setDiscountProduct} onSellProduct={setSellProduct} />
            </div>
          ))}
        </div>
      )}
      <DiscountDialog
        product={discountProduct}
        open={!!discountProduct}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDiscountProduct(null);
          }
        }}
      />
      <SellProductDialog
        product={sellProduct}
        open={!!sellProduct}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSellProduct(null);
          }
        }}
      />
    </div>
  );
}
