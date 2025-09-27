'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Product } from '@/app/admin/_components/product-provider';
import { ProductCard } from '@/components/product-card';
import { Loader2, X, ChevronLeft, ChevronRight, ShoppingCart, Ruler, Baby, Users, PackageCheck, Tag } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { BackButton } from '@/components/back-button';
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCart } from '@/components/providers';
import TgsPlayer from '@/components/tgs-player';


// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
    if (numStr === undefined || numStr === null) return '';
    const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
    if (isNaN(num)) return '';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function ProductImageGallery({ imageUrls, productName, discountPercentage }: { imageUrls: string[], productName: string, discountPercentage?: number }) {
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Main carousel (on page)
    const [mainEmblaRef, mainEmblaApi] = useEmblaCarousel({ loop: true, align: 'center' });

    // Fullscreen gallery carousels
    const [fsEmblaRef, fsEmblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
    const [thumbEmblaRef, thumbEmblaApi] = useEmblaCarousel({ containScroll: 'keepSnaps', dragFree: true, align: 'start' });

    // Zoom/Pan state and refs
    const [scale, setScale] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const activeSlideRef = useRef<HTMLDivElement | null>(null);
    const activeImgRef = useRef<HTMLImageElement | null>(null);
    const isPanningRef = useRef(false);
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

    const handleOpenGallery = (index: number) => {
        setGalleryOpen(true);
        setTimeout(() => {
            if (fsEmblaApi) {
                fsEmblaApi.reInit();
                fsEmblaApi.scrollTo(index, true);
            }
            if (thumbEmblaApi) {
                thumbEmblaApi.reInit();
            }
        }, 80);
    };

    const onFsSelect = useCallback(() => {
        if (!fsEmblaApi || !thumbEmblaApi) return;
        const newSelectedIndex = fsEmblaApi.selectedScrollSnap();
        setSelectedIndex(newSelectedIndex);
        if (thumbEmblaApi.scrollSnapList().length > newSelectedIndex) {
            thumbEmblaApi.scrollTo(newSelectedIndex);
        }
        resetZoom();
    }, [fsEmblaApi, thumbEmblaApi, resetZoom]);

    useEffect(() => {
        if (!fsEmblaApi) return;
        onFsSelect();
        fsEmblaApi.on('select', onFsSelect);
        fsEmblaApi.on('reInit', onFsSelect);
        return () => {
            fsEmblaApi.off('select', onFsSelect);
            fsEmblaApi.off('reInit', onFsSelect);
        }
    }, [fsEmblaApi, onFsSelect]);

    const onThumbClick = useCallback((index: number) => {
        if (!fsEmblaApi) return;
        fsEmblaApi.scrollTo(index);
        resetZoom();
    }, [fsEmblaApi, resetZoom]);

    const fsScrollPrev = useCallback(() => fsEmblaApi?.scrollPrev(), [fsEmblaApi]);
    const fsScrollNext = useCallback(() => fsEmblaApi?.scrollNext(), [fsEmblaApi]);

    const [mainSelectedIndex, setMainSelectedIndex] = useState(0);
    const mainScrollPrev = useCallback(() => mainEmblaApi?.scrollPrev(), [mainEmblaApi]);
    const mainScrollNext = useCallback(() => mainEmblaApi?.scrollNext(), [mainEmblaApi]);
    const onMainSelect = useCallback(() => {
        if (!mainEmblaApi) return;
        setMainSelectedIndex(mainEmblaApi.selectedScrollSnap());
    }, [mainEmblaApi]);

    useEffect(() => {
        if (!mainEmblaApi) return;
        onMainSelect();
        mainEmblaApi.on('select', onMainSelect);
        mainEmblaApi.on('reInit', onMainSelect);
    }, [mainEmblaApi, onMainSelect]);

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

    return (
        <>
            <div className="relative w-full aspect-square overflow-hidden">
                <div className="overflow-hidden h-full cursor-pointer" ref={mainEmblaRef}>
                    <div className="flex h-full">
                        {imageUrls.map((url, index) => (
                            <div key={index} className="flex-[0_0_100%] min-w-0 relative" onClick={() => handleOpenGallery(index)}>
                                <Image
                                    src={url}
                                    alt={`${productName} image ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    priority={index === 0}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {discountPercentage && (
                    <Badge variant="default" className="absolute bottom-4 left-0 z-10 text-base rounded-none rounded-r-xl">
                        <Tag className="mr-2 h-4 w-4" /> {discountPercentage}%
                    </Badge>
                )}

                {imageUrls.length > 1 && (
                    <>
                        <button
                            type="button"
                            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2"
                            onClick={mainScrollPrev}
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-black/40 hover:bg-black/70 text-white rounded-full p-2"
                            onClick={mainScrollNext}
                        >
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    </>
                )}
                {imageUrls.length > 1 && (
                    <>
                        <div className="absolute bottom-4 right-4 flex gap-2">
                            {imageUrls.map((_, i) => (
                                <div
                                    key={i}
                                    className={cn(
                                        'h-2 w-2 rounded-full bg-white/80 backdrop-blur-sm shadow-md transition-all',
                                        i === mainSelectedIndex ? 'w-6' : ''
                                    )}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
            {/* Стрелки переключения */}

            <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                <DialogContent hideDefaultClose className="p-0 border-0 bg-black/95 w-full h-full max-w-full max-h-screen rounded-none flex flex-col">
                    <DialogTitle className="sr-only">Gallery</DialogTitle>

                    <div className="relative w-full flex-grow overflow-hidden" ref={fsEmblaRef}>
                        <div className="h-full flex">
                            {imageUrls.map((url, index) => {
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
                                            alt={`${productName} image ${index + 1}`}
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

                    <Button variant="ghost" size="icon" className="absolute top-4 right-4 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40" onClick={() => setGalleryOpen(false)}>
                        <X className="h-6 w-6" />
                    </Button>

                    {imageUrls.length > 1 && (
                        <>
                            <Button variant="ghost" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40" onClick={fsScrollPrev}>
                                <ChevronLeft className="h-6 w-6" />
                            </Button>
                            <Button variant="ghost" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 text-white hover:text-white z-40" onClick={fsScrollNext}>
                                <ChevronRight className="h-6 w-6" />
                            </Button>

                            <div className="flex-shrink-0 p-4 w-full flex justify-center">
                                <div className="overflow-hidden" ref={thumbEmblaRef}>
                                    <div className="flex gap-3 items-center">
                                        {imageUrls.map((url, index) => (
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

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-start py-4 border-b">
            <Icon className="h-6 w-6 text-muted-foreground mr-4 mt-1" />
            <div className="flex-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-medium text-base">{value}</p>
            </div>
        </div>
    )
}

function RecommendedCard({ product, t }: { product: Product; t: any }) {
    const [cardEmblaRef, cardEmblaApi] = useEmblaCarousel({ loop: true });
    const [selectedIndex, setSelectedIndex] = useState(0);

    const onSelect = useCallback(() => {
        if (!cardEmblaApi) return;
        setSelectedIndex(cardEmblaApi.selectedScrollSnap());
    }, [cardEmblaApi]);

    useEffect(() => {
        if (!cardEmblaApi) return;
        onSelect();
        cardEmblaApi.on('select', onSelect);
        cardEmblaApi.on('reInit', onSelect);
    }, [cardEmblaApi, onSelect]);

    const images = product.imageUrls || [];

    return (
        <div className="flex flex-col">
            <div className="aspect-[3/4] w-full relative overflow-hidden rounded-t-lg" ref={cardEmblaRef}>
                <div className="h-full flex">
                    {images.map((url, index) => (
                        <div key={index} className="flex-[0_0_100%] h-full min-w-0 relative">
                            <Image src={url} alt={`${product.name} image ${index + 1}`} fill className="object-cover" />
                        </div>
                    ))}
                    {images.length === 0 && (
                        <div className="flex-[0_0_100%] h-full min-w-0 relative bg-muted flex items-center justify-center">
                            <span className="text-sm text-muted-foreground">{t.noImage}</span>
                        </div>
                    )}
                </div>
                {product.discountPercentage && product.discountPercentage > 0 && (
                    <div className="absolute bottom-2 left-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-r-full shadow-lg tabular-nums">
                        -{product.discountPercentage}%
                    </div>
                )}
                {images.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'h-1.5 w-1.5 rounded-full bg-white/70 backdrop-blur-sm shadow-md transition-all',
                                    i === selectedIndex ? 'w-4' : ''
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
        </div>
    );
}

export default function ProductPage() {
    const params = useParams();
    const productId = params.productId as string;
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState<Product[]>([]);
    const { addToCart, cart } = useCart();
    const { toast } = useToast();
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

    useEffect(() => {
        if (!productId) return;
        const fetchProduct = async () => {
            setLoading(true);
            try {
                const db = getFirestore(app);
                const productDocRef = doc(db, 'products', productId);
                const productDoc = await getDoc(productDocRef);

                if (productDoc.exists()) {
                    const prod = { id: productDoc.id, ...productDoc.data() } as Product;
                    setProduct(prod);
                    // Fetch recommendations by type
                    if (prod.productType) {
                        const productsRef = collection(db, 'products');
                        const q = query(productsRef, where('productType', '==', prod.productType));
                        const querySnapshot = await getDocs(q);
                        const recs: Product[] = [];
                        querySnapshot.forEach(docSnap => {
                            if (docSnap.id !== productId) {
                                recs.push({ id: docSnap.id, ...docSnap.data() } as Product);
                            }
                        });
                        setRecommendations(recs);
                    }
                } else {
                    toast({ title: t.errorTitle, description: t.productNotFound, variant: 'destructive' });
                }
            } catch (error) {
                console.error("Error fetching product:", error);
                toast({ title: t.errorTitle, description: t.failedToLoadProductData, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        fetchProduct();
    }, [productId, toast, t]);

    const handleAddToCart = () => {
        if (!product) return;
        const stock = (product as any).quantity ?? (product as any).stock ?? 0;
        const isInCart = cart.items.some(i => i.id === product.id);
        if (stock <= 0 || isInCart) return;
        addToCart(product as any);
        // toast({
        //     title: t.addedToCartTitle || "Добавлено в корзину",
        //     description: (t.addedToCartDesc || "Товар добавлен: ") + product.name,
        // });
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col justify-center items-center h-screen text-center p-4">
                <h1 className="text-2xl font-bold">{t.productNotFound}</h1>
                {noProductsAnim && (
                    <div className="w-48 h-48">
                        <TgsPlayer dataUrl={noProductsAnim} loop className="w-full h-full" />
                    </div>
                )}
                <BackButton />
            </div>
        );
    }

    const getGenderTranslation = (gender: 'girl' | 'boy' | 'both') => {
        const key = `gender${gender.charAt(0).toUpperCase() + gender.slice(1)}`;
        return t[key as keyof typeof t] || gender;
    }

    const getAgeGroupTranslation = (ageGroup: 'kids' | 'adults') => {
        const key = `ageGroup${ageGroup.charAt(0).toUpperCase() + ageGroup.slice(1)}`;
        return t[key as keyof typeof t] || ageGroup;
    }

    return (
        <div className="pb-28">
            <div className="absolute top-4 left-4 z-20">
                <BackButton />
            </div>

            {product.imageUrls && product.imageUrls.length > 0 ? (
                <ProductImageGallery
                    imageUrls={product.imageUrls}
                    productName={product.name}
                    discountPercentage={product.discountPercentage}
                />
            ) : (
                <div className="aspect-square w-full bg-muted flex items-center justify-center">
                    <span className="text-sm text-muted-foreground">{t.noImage}</span>
                </div>
            )}

            <div className="p-4 space-y-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                        {product.originalPrice && (
                            <div className="flex items-center gap-1">
                                <p className="text-xl text-muted-foreground line-through">
                                    {formatNumber(product.originalPrice)}
                                </p>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <p className="text-3xl font-bold text-primary">{formatNumber(product.price)}</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y border-t border-b">
                    <InfoRow icon={PackageCheck} label={t.productQuantity} value={`${formatNumber(product.quantity)} ${t.quantityUnit}`} />
                    <InfoRow icon={Users} label={t.ageGroupLabel} value={getAgeGroupTranslation(product.ageGroup)} />
                    <InfoRow icon={Baby} label={t.genderLabel} value={getGenderTranslation(product.gender)} />
                    {product.ageFrom && product.ageTo && <InfoRow icon={Ruler} label={t.ageRangeLabel} value={`${product.ageFrom} - ${product.ageTo} лет`} />}
                    {product.sizeFrom && product.sizeTo && <InfoRow icon={Ruler} label={t.sizeRangeLabel} value={`${product.sizeFrom} - ${product.sizeTo}`} />}
                </div>

                <Card className="shadow-lg rounded-2xl">
                    <CardHeader>
                        <CardTitle>Описание</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                            {product.description || "Подробное описание товара скоро будет добавлено."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Recommendations block */}
            {recommendations.length > 0 && (
                <div className="px-4 pb-32 relative">
                    <h2 className="text-xl font-bold mb-4">{t.recommendationsTitle || 'Рекомендуемое'}</h2>
                    <div className="relative">
                        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 pr-6" style={{ WebkitOverflowScrolling: 'touch' }}>
                            {recommendations.map(rec => (
                                <div key={rec.id} className="min-w-[220px] max-w-[260px] flex-shrink-0">
                                    <RecommendedCard product={rec} t={t} />
                                </div>
                            ))}
                        </div>
                        {/* Inner shadow справа */}
                        <div className="pointer-events-none absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-background via-background/80 to-transparent" />
                    </div>
                </div>
            )}

            {/* Fixed Add to Cart Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t p-4 z-50">
                {(() => {
                    const stock = (product as any).quantity ?? (product as any).stock ?? 0;
                    const isInCart = cart.items.some(i => i.id === product.id);
                    const disabled = stock <= 0 || isInCart;
                    return (
                        <Button size="lg" className="w-full h-12 text-base" onClick={handleAddToCart} disabled={disabled}>
                            <ShoppingCart className="mr-2 h-5 w-5" />
                            {isInCart ? (t.inCartButton || 'В корзине') : (t.addToCartButton || 'Добавить в корзину')}
                        </Button>
                    );
                })()}
            </div>
        </div>
    );
}