'use client';
import { useState, useCallback } from 'react';
import type { Product } from '@/lib/types';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from './ui/card';
import { useCart } from '@/components/providers';
import { ShoppingCart } from 'lucide-react';
import { ProductImage } from './product-image';
import { cn } from '@/lib/utils';
import useEmblaCarousel from 'embla-carousel-react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [cardEmblaRef, cardEmblaApi] = useEmblaCarousel({ loop: true });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!cardEmblaApi) return;
    setSelectedIndex(cardEmblaApi.selectedScrollSnap());
  }, [cardEmblaApi]);

  useState(() => {
    if (!cardEmblaApi) return;
    onSelect();
    cardEmblaApi.on('select', onSelect);
    cardEmblaApi.on('reInit', onSelect);
  });

  const imageUrls = product.imageUrls || [product.imageUrl];

  return (
    <>
      <Card className="flex flex-col overflow-hidden h-full">
        <CardHeader className="p-0 relative">
          <div className="overflow-hidden" ref={cardEmblaRef}>
            <div className="flex aspect-[3/4]">
              {imageUrls.map((url, index) => (
                <div
                  className="flex-[0_0_100%] min-w-0 relative"
                  key={index}
                  onClick={() => setGalleryOpen(true)}
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
          </div>
           {imageUrls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {imageUrls.map((_, i) => (
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
        </CardHeader>
        <CardContent className="p-4 flex-grow">
          <CardTitle className="text-lg font-headline">{product.name}</CardTitle>
          <CardDescription className="mt-1 text-sm">{product.description}</CardDescription>
        </CardContent>
        <CardFooter className="p-4 flex justify-between items-center">
          <p className="text-xl font-semibold">${product.price.toFixed(2)}</p>
          <Button onClick={() => addToCart(product)}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Add to Cart
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="p-0 border-0 bg-black/90 w-full h-full max-w-full max-h-screen rounded-none flex items-center justify-center">
           <div className="relative w-full h-full max-w-4xl max-h-4xl">
            <Image
              src={imageUrls[selectedIndex]}
              alt={`${product.name} image ${selectedIndex + 1}`}
              fill
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/*
  // Old version of the card
  return (
    <Card className="flex flex-col overflow-hidden h-full">
      <CardHeader className="p-0">
        <div className="aspect-w-4 aspect-h-3">
          <ProductImage product={product} />
        </div>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <CardTitle className="text-lg font-headline">{product.name}</CardTitle>
        <CardDescription className="mt-1 text-sm">{product.description}</CardDescription>
      </CardContent>
      <CardFooter className="p-4 flex justify-between items-center">
        <p className="text-xl font-semibold">${product.price.toFixed(2)}</p>
        <Button onClick={() => addToCart(product)}>
          <ShoppingCart className="mr-2 h-4 w-4" />
          Add to Cart
        </Button>
      </CardFooter>
    </Card>
  );
*/
