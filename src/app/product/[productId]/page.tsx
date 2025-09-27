'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Product } from '@/app/admin/_components/product-provider';
import { Loader2, X, ChevronLeft, ChevronRight, ShoppingCart, Ruler, Baby, Users, PackageCheck, Tag, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import { BackButton } from '@/components/back-button';
import { useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/components/providers';
import TgsPlayer from '@/components/tgs-player';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


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

function FeaturePill({ icon: Icon, label, value, colorClass }: { icon: React.ElementType, label: string, value: React.ReactNode, colorClass: string }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border p-3">
            <div className={cn("h-10 w-10 flex items-center justify-center rounded-full ring-2", colorClass)}>
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
                <p className="font-medium text-sm leading-tight">{value}</p>
            </div>
        </div>
    );
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
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [modalSelectedSize, setModalSelectedSize] = useState<string | number | null>(null);
    const [modalQty, setModalQty] = useState<number>(1);
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
        const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
        const stock = sizes.length > 0
            ? sizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
            : ((product as any).quantity ?? (product as any).stock ?? 0);
        if (stock <= 0) return;
        const firstAvailSize = sizes.length > 0 ? (sizes.find((s: any) => (Number(s.quantity) || 0) > 0)?.size ?? sizes[0].size) : null;
        setModalSelectedSize(firstAvailSize ?? null);
        setModalQty(1);
        setIsAddDialogOpen(true);
    };

    const handleConfirmAdd = () => {
        if (!product) return;
        const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
        if (sizes.length > 0 && (modalSelectedSize === null || modalSelectedSize === undefined)) return;
        addToCart({ ...(product as any), selectedSize: modalSelectedSize, addQuantity: modalQty } as any);
        setIsAddDialogOpen(false);
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
                    <div className="flex items-end gap-3 mt-1">
                        <p className="text-3xl font-bold text-primary tabular-nums">{formatNumber(product.price)}</p>
                        {product.originalPrice && (
                            <p className="text-base text-muted-foreground line-through tabular-nums">
                                {formatNumber(product.originalPrice)}
                            </p>
                        )}
                    </div>
                </div>


                {(() => {
                    const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
                    const stock = sizes.length > 0
                        ? sizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
                        : ((product as any).quantity ?? (product as any).stock ?? 0);

                    return (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <FeaturePill
                                    icon={Users}
                                    label={t.ageGroupLabel}
                                    value={getAgeGroupTranslation(product.ageGroup)}
                                    colorClass={'text-indigo-600 ring-indigo-200 bg-indigo-50'}
                                />
                                <FeaturePill
                                    icon={Baby}
                                    label={t.genderLabel}
                                    value={getGenderTranslation(product.gender)}
                                    colorClass={'text-pink-600 ring-pink-200 bg-pink-50'}
                                />
                                {product.ageFrom && product.ageTo && (
                                    <FeaturePill
                                        icon={Ruler}
                                        label={t.ageRangeLabel}
                                        value={`${product.ageFrom} - ${product.ageTo} лет`}
                                        colorClass={'text-amber-600 ring-amber-200 bg-amber-50'}
                                    />
                                )}
                                {((!Array.isArray((product as any).sizes)) || sizes.length === 0) && product.sizeFrom && product.sizeTo && (
                                    <FeaturePill
                                        icon={Ruler}
                                        label={t.sizeRangeLabel}
                                        value={`${product.sizeFrom} - ${product.sizeTo}`}
                                        colorClass={'text-violet-600 ring-violet-200 bg-violet-50'}
                                    />
                                )}
                            </div>

                        </div>
                    );
                })()}

                <div>
                    <Accordion type="single" collapsible>
                        <AccordionItem value="description">
                            <AccordionTrigger>Описание</AccordionTrigger>
                            <AccordionContent>
                                <p className="text-muted-foreground whitespace-pre-wrap">
                                    {product.description || 'Подробное описание товара скоро будет добавлено.'}
                                </p>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Добавить в корзину</DialogTitle>
                        <DialogDescription>Выберите параметры перед добавлением</DialogDescription>
                    </DialogHeader>

                    {(() => {
                        const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
                        const maxQty = (() => {
                            if (sizes.length > 0) {
                                const entry = sizes.find((s: any) => String(s.size) === String(modalSelectedSize));
                                return entry ? (Number(entry.quantity) || 0) : 0;
                            }
                            return (product as any).quantity ?? (product as any).stock ?? 0;
                        })();

                        return (
                            <div className="space-y-4">
                                {sizes.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">Размер</p>
                                        <div className="flex flex-wrap gap-2">
                                            {sizes.map((s: any, idx: number) => {
                                                const disabled = (Number(s.quantity) || 0) <= 0;
                                                const active = String(modalSelectedSize) === String(s.size);
                                                return (
                                                    <button
                                                        key={idx}
                                                        disabled={disabled}
                                                        onClick={() => setModalSelectedSize(s.size)}
                                                        className={cn(
                                                            'px-3 py-2 rounded-lg text-sm border transition-all',
                                                            active ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
                                                            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                                        )}
                                                    >
                                                        <span className="font-medium">{String(s.size)}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">Количество</p>
                                        <span className="text-xs text-muted-foreground">Доступно: {formatNumber(maxQty)} {t.quantityUnit}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => setModalQty((q) => Math.max(1, q - 1))} disabled={modalQty <= 1}>
                                            <Minus className="h-4 w-4" />
                                        </Button>
                                        <Input type="number" className="w-20 text-center" value={modalQty} min={1} max={Math.max(1, maxQty)} onChange={(e) => {
                                            const v = Number(e.target.value);
                                            if (Number.isNaN(v)) return;
                                            setModalQty(Math.min(Math.max(1, v), Math.max(1, maxQty)));
                                        }} />
                                        <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => setModalQty((q) => Math.min(q + 1, Math.max(1, maxQty)))} disabled={modalQty >= Math.max(1, maxQty)}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    <DialogFooter className='grid grid-cols-2 items-center gap-2'>
                        <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Отмена</Button>
                        {(() => {
                            const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
                            const requireSize = sizes.length > 0;
                            const maxQty = (() => {
                                if (sizes.length > 0) {
                                    const entry = sizes.find((s: any) => String(s.size) === String(modalSelectedSize));
                                    return entry ? (Number(entry.quantity) || 0) : 0;
                                }
                                return (product as any).quantity ?? (product as any).stock ?? 0;
                            })();
                            const disabled = (requireSize && (modalSelectedSize === null || modalSelectedSize === undefined)) || maxQty <= 0;
                            return (
                                <Button onClick={handleConfirmAdd} disabled={disabled}>
                                    <ShoppingCart className="h-4 w-4" /> {t.addToCartButton || 'Добавить в корзину'}
                                </Button>
                            );
                        })()}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
            {(() => {
                const sizes: any[] = Array.isArray((product as any).sizes) ? (product as any).sizes : [];
                const stock = sizes.length > 0
                    ? sizes.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0)
                    : ((product as any).quantity ?? (product as any).stock ?? 0);
                const disabled = stock <= 0;
                return (
                    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm p-4 z-50 border-t">
                        <Button size="lg" className="w-full h-12 text-base" onClick={handleAddToCart} disabled={disabled}>
                            <ShoppingCart className="mr-2 h-5 w-5" />
                            {t.addToCartButton || 'Добавить в корзину'}
                        </Button>
                    </div>
                );
            })()}
        </div>
    );
}