'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Loader2, X, ChevronLeft, ChevronRight, Search, Filter, Heart, Share2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { ProductProvider, useProducts, Product } from "./admin/_components/product-provider";
import Image from "next/image";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '@/lib/utils';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { getFirestore, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import TgsPlayer from '@/components/tgs-player';

// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
  if (numStr === undefined || numStr === null) return '';
  const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};


function HomePageProductGallery({ product }: { product: Product }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cardCarouselSelectedIndex, setCardCarouselSelectedIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState<number>((product as any).likesCount || 0);
  const LIKED_LIST_KEY = 'liked_products';
  const { lang } = useLanguage();
  const t = translations[lang];

  // Card carousel
  const [cardEmblaRef, cardEmblaApi] = useEmblaCarousel({ loop: true });

  // Gallery carousels
  const [mainEmblaRef, mainEmblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
  const [thumbEmblaRef, thumbEmblaApi] = useEmblaCarousel({ containScroll: 'keepSnaps', dragFree: true, align: 'start' });

  // ZOOM / PAN state
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const activeSlideRef = useRef<HTMLDivElement | null>(null);
  const activeImgRef = useRef<HTMLImageElement | null>(null);
  const pinchRef = useRef({ startDist: 0, startScale: 1, startPos: { x: 0, y: 0 }, focal: { x: 0, y: 0 } });
  const dragRef = useRef({ startClientX: 0, startClientY: 0, startPos: { x: 0, y: 0 } });
  const maxScale = 4;

  const clampPos = useCallback((x: number, y: number, s: number) => {
    const container = activeSlideRef.current;
    const img = activeImgRef.current;
    if (!container || !img) return { x: 0, y: 0 };
    const cw = container.clientWidth, ch = container.clientHeight;
    const iw = img.clientWidth, ih = img.clientHeight;
    const scaledW = iw * s, scaledH = ih * s;
    const maxX = Math.max(0, (scaledW - cw) / 2);
    const maxY = Math.max(0, (scaledH - ch) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, x)), y: Math.max(-maxY, Math.min(maxY, y)) };
  }, []);

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

  useEffect(() => {
    try {
      const apply = (value: string | null) => {
        if (!value) return;
        try {
          const arr: string[] = JSON.parse(value);
          if (Array.isArray(arr) && arr.includes(product.id)) setLiked(true);
        } catch {
          // backward compatibility: if old per-item key value accidentally stored here
          if (value === '1') setLiked(true);
        }
      };

      if (window?.Telegram?.WebApp?.CloudStorage) {
        // Prefer the consolidated liked list
        window.Telegram.WebApp.CloudStorage.getItem(LIKED_LIST_KEY, (err, value) => {
          if (!err && value) {
            apply(value);
          } else {
            // Try to read legacy per-item key and treat it as liked
            window.Telegram.WebApp.CloudStorage.getItem(`liked:${product.id}`, (err2, v2) => {
              if (!err2 && v2 === '1') setLiked(true);
            });
          }
        });
      } else {
        const v = localStorage.getItem(LIKED_LIST_KEY);
        if (v) {
          apply(v);
        } else {
          const old = localStorage.getItem(`liked:${product.id}`);
          if (old === '1') setLiked(true);
        }
      }
    } catch { }
  }, [product.id]);

  const shareProduct = () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }

    try {
      // правильнее давать start_param
      const link = `https://t.me/kiyimdokoni_bot/Market?startapp=product_${product.id}`;

      const url = `https://t.me/share/url?url=${encodeURIComponent(link)}`;

      if (tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error("Share failed", e);
    }
  };

  const toggleLike = async () => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('medium');
    }

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((c) => c + (newLiked ? 1 : -1));
    try {
      const id = product.id;
      if (window?.Telegram?.WebApp?.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.getItem(LIKED_LIST_KEY, (err, value) => {
          let arr: string[] = [];
          if (!err && value) {
            try { arr = JSON.parse(value) || []; } catch { arr = []; }
          }
          const set = new Set<string>(Array.isArray(arr) ? arr : []);
          if (newLiked) set.add(id); else set.delete(id);
          const updated = JSON.stringify([...set]);
          window.Telegram.WebApp.CloudStorage.setItem(LIKED_LIST_KEY, updated, () => { });
        });
      } else {
        const value = localStorage.getItem(LIKED_LIST_KEY);
        let arr: string[] = [];
        if (value) {
          try { arr = JSON.parse(value) || []; } catch { arr = []; }
        }
        const set = new Set<string>(Array.isArray(arr) ? arr : []);
        if (newLiked) set.add(id); else set.delete(id);
        localStorage.setItem(LIKED_LIST_KEY, JSON.stringify([...set]));
      }
    } catch { }
    try {
      const db = getFirestore(app);
      await updateDoc(doc(db, 'products', product.id), { likesCount: increment(newLiked ? 1 : -1) });
    } catch (e) {
      setLiked((v) => !v);
      setLikesCount((c) => c + (newLiked ? -1 : 1));
      console.error('Failed to update likes', e);
    }
  };

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
    setTimeout(() => {
      if (mainEmblaApi) {
        mainEmblaApi.reInit();
        mainEmblaApi.scrollTo(index, true);
      }
      if (thumbEmblaApi) thumbEmblaApi.reInit();
    }, 80);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!activeSlideRef.current) return;
    const rect = activeSlideRef.current.getBoundingClientRect();
    const pointerX = e.clientX - rect.left - rect.width / 2;
    const pointerY = e.clientY - rect.top - rect.height / 2;
    const delta = -e.deltaY * 0.002;
    const newScale = Math.min(maxScale, Math.max(1, scale * (1 + delta)));
    const f = newScale / scale;
    const newPosX = pos.x + (1 - f) * pointerX;
    const newPosY = pos.y + (1 - f) * pointerY;
    const clamped = clampPos(newPosX, newPosY, newScale);
    setScale(newScale);
    setPos(clamped);
  };

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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
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
    const newPos = { x: dragRef.current.startPos.x + dx, y: dragRef.current.startPos.y + dy };
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

  useEffect(() => {
    const clamped = clampPos(pos.x, pos.y, scale);
    if (clamped.x !== pos.x || clamped.y !== pos.y) {
      setPos(clamped);
    }
  }, [scale, pos.x, pos.y, clampPos]);

  useEffect(() => { resetZoom(); }, [selectedIndex, resetZoom]);

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
        <div className="absolute top-2 right-2 z-20 flex gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleLike(); }}
            className="rounded-full bg-black/40 hover:bg-black/70 text-white p-2"
            aria-label="Like"
          >
            <Heart className={cn('h-5 w-5', liked ? 'fill-red-500 text-red-500' : '')} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); shareProduct(); }}
            className="rounded-full bg-black/40 hover:bg-black/70 text-white p-2"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>

        {product.discountPercentage && product.discountPercentage > 0 && (
          <div className="absolute bottom-2 left-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-r-full shadow-lg tabular-nums">
            -{product.discountPercentage}%
          </div>
        )}

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

      <div className="border-2 border-t-0 rounded-b-lg p-2 flex flex-col flex-grow">
        <div className="flex-grow">
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
        <Button asChild className="mt-4 w-full">
          <Link href={`/product/${product.id}`} className="flex items-center justify-center">
            {t.viewProduct}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent
          hideDefaultClose
          className="p-0 border-0 bg-black/95 w-full h-full max-w-full max-h-screen rounded-none flex flex-col"
        >
          <DialogTitle className="sr-only">Gallery</DialogTitle>
          <div
            className="relative w-full flex-grow overflow-hidden"
            ref={mainEmblaRef}
          >
            <div className="h-full flex">
              {product.imageUrls.map((url, index) => {
                const isActive = index === selectedIndex;
                return (
                  <div
                    key={index}
                    ref={isActive ? activeSlideRef : undefined}
                    className={cn("flex-[0_0_100%] flex items-center justify-center h-full min-w-0 relative overflow-hidden", isActive ? "z-30" : "z-10")}
                    onPointerDown={isActive ? handlePointerDown : undefined}
                    onPointerMove={isActive ? handlePointerMove : undefined}
                    onPointerUp={isActive ? handlePointerUp : undefined}
                    onPointerCancel={isActive ? handlePointerUp : undefined}
                    onDoubleClick={isActive ? handleDoubleClick : undefined}
                    onWheel={isActive ? handleWheel : undefined}
                  >
                    <img
                      ref={isActive ? activeImgRef : undefined}
                      src={url}
                      alt={`${product.name} image ${index + 1}`}
                      className="object-contain max-w-full max-h-full transition-transform duration-100 will-change-transform"
                      style={isActive ? { transform: `translate(${pos.x / scale}px, ${pos.y / scale}px) scale(${scale})`, touchAction: 'none' } : { transform: 'none' }}
                      onLoad={() => { const clamped = clampPos(pos.x, pos.y, scale); setPos(clamped); }}
                      draggable={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40"
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
                        className={cn("flex-[0_0_auto] aspect-square rounded-md overflow-hidden relative transition-all duration-300 w-14 h-14", index === selectedIndex ? "opacity-100 scale-110" : "opacity-60 hover:opacity-100")}
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
    </>
  );
}


function Home() {
  const { products, loading } = useProducts();
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>('all');
  const { lang } = useLanguage();
  const t = translations[lang];
  const [noProductsAnim, setNoProductsAnim] = useState<string | null>(null);

  useEffect(() => {
    const fetchNoProductsAnim = async () => {
      try {
        const db = getFirestore(app);
        const ref = doc(db, 'settings', 'animations');
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as { productsNotFoundAnimation?: string | null };
          setNoProductsAnim(data.productsNotFoundAnimation ?? null);
        }
      } catch (e) {
        console.error('Failed to load no-products animation', e);
      }
    };
    fetchNoProductsAnim();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = productTypeFilter === 'all' || (product as any).productType === productTypeFilter;
      const matchesGender = genderFilter === 'all' || product.gender === genderFilter;
      const matchesAgeGroup = ageGroupFilter === 'all' || product.ageGroup === ageGroupFilter;
      return matchesSearch && matchesType && matchesGender && matchesAgeGroup;
    });
  }, [products, searchTerm, productTypeFilter, genderFilter, ageGroupFilter]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{t.productsTitle}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {t.filtersLabel || 'Filters'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{t.productTypeLabel}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={productTypeFilter} onValueChange={setProductTypeFilter}>
              <DropdownMenuRadioItem value="all">{t.reset}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="headwear">{t.productTypeHeadwear}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="clothes">{t.productTypeClothes}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="shoes">{t.productTypeShoes}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t.genderLabel}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={genderFilter} onValueChange={setGenderFilter}>
              <DropdownMenuRadioItem value="all">{t.reset}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="both">{t.genderBoth}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="girl">{t.genderGirl}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="boy">{t.genderBoy}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t.ageGroupLabel}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
              <DropdownMenuRadioItem value="all">{t.reset}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="kids">{t.ageGroupKids}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="adults">{t.ageGroupAdults}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setProductTypeFilter('all');
                  setGenderFilter('all');
                  setAgeGroupFilter('all');
                }}
              >
                {t.reset}
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
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
        <div className="text-center py-10 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-4">
          {noProductsAnim && (
            <div className="w-48 h-48">
              <TgsPlayer dataUrl={noProductsAnim} loop className="w-full h-full" />
            </div>
          )}
          <p className="text-muted-foreground">
            {searchTerm ? t.productsNotFound : t.noProductsYet}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8">
          {filteredProducts.map((product) => (
            <div key={product.id} className="flex flex-col">
              <HomePageProductGallery product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <ProductProvider>
      <Home />
    </ProductProvider>
  )
}