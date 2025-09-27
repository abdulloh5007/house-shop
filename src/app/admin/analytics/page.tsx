
'use client';

import { useProducts } from '../_components/product-provider';
import { Loader2, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { BackButton } from '@/components/back-button';
import Link from 'next/link';
import { AnalyticsProductGallery } from './_components/analytics-product-gallery';


// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
    if (numStr === undefined || numStr === null) return '0';
    const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
    if (isNaN(num)) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

export default function AnalyticsPage() {
    const { products, loading } = useProducts();
    const { lang } = useLanguage();
    const t = translations[lang];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <BackButton />

            {products.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">{t.noProductsYet}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {products.map(product => (
                        <div
                            key={product.id}
                            className="flex items-center gap-4 p-3 bg-card rounded-lg shadow-sm hover:bg-muted/50 transition-colors"
                        >
                            <div className="w-16 h-16 flex-shrink-0">
                                <AnalyticsProductGallery product={product} />
                            </div>
                            <Link
                                href={`/admin/analytics/${product.id}`}
                                className="flex-grow min-w-0 flex items-center justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{product.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {t.priceInStock}:{" "}
                                        <span className="font-medium text-primary tabular-nums">
                                            {formatNumber(product.price)}
                                        </span>
                                    </p>
                                </div>
                                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
                            </Link>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
