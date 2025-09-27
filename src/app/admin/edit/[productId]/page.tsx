'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { BackButton } from '@/components/back-button';
import { FormattedInput } from '../../new/_components/formatted-input';
import { useRouter, useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { ImageUploader } from '../../new/_components/image-uploader';
import { useLanguage } from '@/components/language-provider';

// State to manage images: new files are File objects, existing are just URLs
type ImageState = { file?: File; url: string };

const productSchema = z.object({
    name: z.string().min(3, 'Название должно быть не менее 3 символов'),
    description: z.string().max(170, 'Описание не должно превышать 170 символов').optional(),
    price: z.string().min(1, 'Цена обязательна'), // Reverted to price
    purchasePrice: z.string().min(1, 'Начальная цена покупки обязательна'),
    quantity: z.string().min(1, 'Количество обязательно'),
    sizeFrom: z.string().optional(),
    sizeTo: z.string().optional(),
    ageFrom: z.string().optional(),
    ageTo: z.string().optional(),
    ageGroup: z.enum(['kids', 'adults']),
    gender: z.enum(['girl', 'boy', 'both']),
    productType: z.enum(['headwear', 'clothes', 'shoes']),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function EditProductPage() {
    const { lang } = useLanguage();
    const t = translations[lang];
    const { toast } = useToast();
    const router = useRouter();
    const params = useParams();
    const productId = params.productId as string;

    const [images, setImages] = useState<ImageState[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            description: '',
            price: '',
            purchasePrice: '',
            quantity: '',
            sizeFrom: '',
            sizeTo: '',
            ageFrom: '',
            ageTo: '',
            ageGroup: 'kids',
            gender: 'girl',
            productType: 'clothes',
        },
    });

    const setImagesCallback = useCallback((newImages: ImageState[]) => {
        setImages(newImages);
    }, []);

    useEffect(() => {
        if (!productId) return;

        const fetchProduct = async () => {
            try {
                const db = getFirestore(app);
                const productDocRef = doc(db, 'products', productId);
                const productSnap = await getDoc(productDocRef);

                if (productSnap.exists()) {
                    const productData = productSnap.data();
                    form.reset({
                        name: productData.name,
                        description: productData.description || '',
                        price: String(productData.price),
                        purchasePrice: String(productData.purchasePrice || 0),
                        quantity: String(productData.quantity),
                        sizeFrom: productData.sizeFrom ? String(productData.sizeFrom) : '',
                        sizeTo: productData.sizeTo ? String(productData.sizeTo) : '',
                        ageFrom: productData.ageFrom ? String(productData.ageFrom) : '',
                        ageTo: productData.ageTo ? String(productData.ageTo) : '',
                        ageGroup: productData.ageGroup,
                        gender: productData.gender,
                        productType: productData.productType || 'clothes',
                    });
                    // Initialize images state with existing URLs
                    const existingImages = productData.imageUrls.map((url: string) => ({ url }));
                    setImages(existingImages);
                } else {
                    toast({ title: t.errorTitle, description: t.productNotFound, variant: 'destructive' });
                    router.push('/admin');
                }
            } catch (error) {
                console.error("Error fetching product:", error);
                toast({ title: t.errorTitle, description: t.failedToLoadProductData, variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchProduct();
    }, [productId, form, router, toast, t]);

    const onSubmit = async (data: ProductFormValues) => {
        if (images.length === 0) {
            toast({
                title: t.errorTitle,
                description: t.uploadAtLeastOneImage,
                variant: 'destructive',
            });
            return;
        }
        setIsSaving(true);
        try {
            const db = getFirestore(app);
            const productDocRef = doc(db, 'products', productId);

            // Separate new images (have a File object) from existing ones (only have URL)
            const newImageFiles = images.filter(img => img.file).map(img => img.file as File);
            let uploadedImageUrls: string[] = [];

            // Step 1: Upload NEW images if there are any
            if (newImageFiles.length > 0) {
                const formData = new FormData();
                newImageFiles.forEach(file => {
                    formData.append('images', file);
                });

                const uploadResponse = await fetch('/api/admin/upload-product-images', {
                    method: 'POST',
                    body: formData,
                });

                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    throw new Error(errorData.error || 'Failed to upload new images');
                }
                const { urls } = await uploadResponse.json();
                uploadedImageUrls = urls;
            }

            // Step 2: Combine old URLs and new URLs in the correct order
            const finalImageUrls = images.map(img => {
                // If it's an old image, its URL is already what we need.
                if (!img.file) return img.url;
                // If it's a new image, find its uploaded URL. We assume the upload order is preserved.
                // This is a bit fragile but works for this case. A more robust solution might map files to URLs.
                const newUrl = uploadedImageUrls.shift();
                if (!newUrl) throw new Error("Mismatch between new files and uploaded URLs.");
                return newUrl;
            });

            let processedDescription = data.description;
            if (processedDescription) {
                processedDescription = processedDescription.replace(/\n{3,}/g, '\n\n');
            }

            const updatedProduct = {
                name: data.name,
                description: processedDescription || null,
                price: parseFloat(data.price.replace(/\s/g, '')),
                purchasePrice: parseFloat(data.purchasePrice.replace(/\s/g, '')),
                quantity: parseInt(data.quantity.replace(/\s/g, ''), 10),
                sizeFrom: data.sizeFrom ? parseInt(data.sizeFrom.replace(/\s/g, ''), 10) : null,
                sizeTo: data.sizeTo ? parseInt(data.sizeTo.replace(/\s/g, ''), 10) : null,
                ageFrom: data.ageFrom ? parseInt(data.ageFrom.replace(/\s/g, ''), 10) : null,
                ageTo: data.ageTo ? parseInt(data.ageTo.replace(/\s/g, ''), 10) : null,
                imageUrls: finalImageUrls,
                ageGroup: data.ageGroup,
                gender: data.gender,
                productType: data.productType,
                updatedAt: new Date().toISOString(),
            };

            await updateDoc(productDocRef, updatedProduct as any);

            toast({
                title: t.productUpdatedTitle,
                description: `${t.productLabel} "${data.name}" ${t.wasSuccessfullyUpdated}`,
            });

            router.push('/admin');

        } catch (error: any) {
            console.error("Error updating product:", error);
            toast({
                title: t.updateErrorTitle,
                description: error.message || t.errorUpdatingProduct,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <>
            <BackButton />
            <div className="pb-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <ImageUploader images={images} setImages={setImagesCallback} />

                        <div className="px-4 space-y-4">
                            <FormField
                                control={form.control}
                                name="productType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.productTypeLabel}</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder={t.productTypePlaceholder} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="headwear">{t.productTypeHeadwear}</SelectItem>
                                                <SelectItem value="clothes">{t.productTypeClothes}</SelectItem>
                                                <SelectItem value="shoes">{t.productTypeShoes}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.productName}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t.productNamePlaceholder} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Описание</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Введите описание товара..."
                                                className="resize-none"
                                                {...field}
                                            />
                                        </FormControl>
                                        <div className="flex justify-between">
                                            <FormDescription>
                                                Максимум 170 символов.
                                            </FormDescription>
                                            <FormDescription className="text-right">
                                                {field.value?.length || 0} / 170
                                            </FormDescription>
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.productPrice}</FormLabel>
                                        <FormControl>
                                            <FormattedInput
                                                placeholder="1 000 000"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="purchasePrice"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Начальная цена покупки</FormLabel>
                                        <FormControl>
                                            <FormattedInput
                                                placeholder="0.00"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Цена, по которой товар был приобретен. Используется для расчета чистой прибыли.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t.productQuantity}</FormLabel>
                                        <FormControl>
                                            <FormattedInput
                                                placeholder="100"
                                                value={field.value}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name="sizeFrom"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>{t.sizeRangeLabel}</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder={t.sizeRangeFromPlaceholder}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <span className="pt-8 font-semibold">-</span>
                                <FormField
                                    control={form.control}
                                    name="sizeTo"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>&nbsp;</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder={t.sizeRangeToPlaceholder}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name="ageFrom"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>{t.ageRangeLabel}</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder={t.ageRangeFromPlaceholder}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <span className="pt-8 font-semibold">-</span>
                                <FormField
                                    control={form.control}
                                    name="ageTo"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>&nbsp;</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder={t.ageRangeToPlaceholder}
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>


                            <div className="flex gap-4">
                                <FormField
                                    control={form.control}
                                    name="ageGroup"
                                    render={({ field }) => (
                                        <FormItem className="w-1/2">
                                            <FormLabel>{t.ageGroupLabel}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t.ageGroupPlaceholder} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="kids">{t.ageGroupKids}</SelectItem>
                                                    <SelectItem value="adults">{t.ageGroupAdults}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="gender"
                                    render={({ field }) => (
                                        <FormItem className="w-1/2">
                                            <FormLabel>{t.genderLabel}</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={t.genderPlaceholder} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="both">{t.genderBoth}</SelectItem>
                                                    <SelectItem value="girl">{t.genderGirl}</SelectItem>
                                                    <SelectItem value="boy">{t.genderBoy}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="px-4">
                            <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t.save}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </>
    );
}
