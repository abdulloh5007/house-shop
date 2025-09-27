
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from "next/image";
import { Product } from '../../_components/product-provider';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import useEmblaCarousel from 'embla-carousel-react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AnalyticsProductGallery({ product }: { product: Product }) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { lang } = useLanguage();
  const t = translations[lang];

  // Gallery carousels
  const [mainEmblaRef, mainEmblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
  const [thumbEmblaRef, thumbEmblaApi] = useEmblaCarousel({ containScroll: 'keepSnaps', dragFree: true, align: 'start' });

  // Embla selection sync
  const onThumbClick = useCallback((index: number) => {
    if (!mainEmblaApi) return;
    mainEmblaApi.scrollTo(index);
  }, [mainEmblaApi]);

  const onSelect = useCallback(() => {
    if (!mainEmblaApi || !thumbEmblaApi) return;
    const newSelectedIndex = mainEmblaApi.selectedScrollSnap();
    setSelectedIndex(newSelectedIndex);
    if (thumbEmblaApi.scrollSnapList().length > newSelectedIndex) {
      thumbEmblaApi.scrollTo(newSelectedIndex);
    }
  }, [mainEmblaApi, thumbEmblaApi]);

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

  const handleOpenGallery = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
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

  if (!product.imageUrls || product.imageUrls.length === 0) {
    return (
      <div className="aspect-square w-full relative bg-muted rounded-lg flex items-center justify-center">
        <span className="text-xs text-muted-foreground">{t.noImage}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="aspect-square w-full relative group cursor-pointer overflow-hidden rounded-md"
        onClick={(e) => handleOpenGallery(e, 0)}
      >
        <Image
          src={product.imageUrls[0]}
          alt={product.name}
          fill
          className="object-cover"
        />
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
              {product.imageUrls.map((url, index) => (
                <div
                  key={index}
                  className="flex-[0_0_100%] flex items-center justify-center h-full min-w-0 relative"
                >
                  <img
                    src={url}
                    alt={`${product.name} image ${index + 1}`}
                    className="object-contain max-w-full max-h-full"
                    draggable={false}
                  />
                </div>
              )
              )}
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
                        className={cn(
                          "flex-[0_0_auto] aspect-square rounded-md overflow-hidden relative transition-all duration-300",
                          "w-14 h-14",
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
    </>
  )
}
