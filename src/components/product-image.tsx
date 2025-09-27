'use client';

import { useState } from 'react';
import Image from 'next/image';
import LightGallery from 'lightgallery/react';
import type { Product } from '@/lib/types';

// import styles
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';

// import plugins
import lgZoom from 'lightgallery/plugins/zoom';

interface ProductImageProps {
  product: Product;
}

export function ProductImage({ product }: ProductImageProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Image
        src={product.imageUrl}
        alt={product.name}
        width={600}
        height={400}
        className="object-cover w-full h-full cursor-pointer"
        data-ai-hint={product.imageHint}
        onClick={() => setOpen(true)}
      />

      {open && (
        <LightGallery
            onInit={() => {}}
            onBeforeClose={() => setOpen(false)}
            speed={500}
            plugins={[lgZoom]}
            dynamic
            dynamicEl={[{
                src: product.imageUrl,
                thumb: product.imageUrl,
                subHtml: `<h4>${product.name}</h4><p>${product.description}</p>`
            }]}
        >
        </LightGallery>
      )}
    </>
  );
}
