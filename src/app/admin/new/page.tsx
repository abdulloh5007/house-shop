'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Import Textarea
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { translations } from '@/lib/translations';
import { BackButton } from '@/components/back-button';
import { ImageUploader } from './_components/image-uploader';
import { FormattedInput } from './_components/formatted-input';
import { useRouter } from 'next/navigation';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';


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
    discountPercentage: z.string().optional(), // Keep optional, no default
    originalPrice: z.string().optional(), // Keep optional
    discountedPrice: z.string().optional(), // Keep optional
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function NewProductPage() {
    const { lang } = useLanguage();
    const t = translations[lang];
    const { toast } = useToast();
    const [images, setImages] = useState<{ file: File; url: string }[]>([]);
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);


    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            description: '',
            price: '', // Reverted to price
            purchasePrice: '',
            quantity: '',
            sizeFrom: '',
            sizeTo: '',
            ageFrom: '',
            ageTo: '',
            ageGroup: 'kids',
            gender: 'girl',
            productType: 'clothes',
            discountPercentage: '', // No default
            originalPrice: '', // No default
            discountedPrice: '', // No default
        },
    });

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
            // Step 1: Upload images
            const formData = new FormData();
            images.forEach(image => {
                formData.append('images', image.file);
            });

            const uploadResponse = await fetch('/api/admin/upload-product-images', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || 'Failed to upload images');
            }

            const { urls } = await uploadResponse.json();

            let processedDescription = data.description;
            if (processedDescription) {
                processedDescription = processedDescription.replace(/\n{3,}/g, '\n\n');
            }

            const newProduct = {
                name: data.name,
                description: processedDescription || null,
                price: parseFloat(data.price.replace(/\s/g, '')),
                purchasePrice: parseFloat(data.purchasePrice.replace(/\s/g, '')),
                quantity: parseInt(data.quantity.replace(/\s/g, ''), 10),
                sizeFrom: data.sizeFrom ? parseInt(data.sizeFrom.replace(/\s/g, ''), 10) : null,
                sizeTo: data.sizeTo ? parseInt(data.sizeTo.replace(/\s/g, ''), 10) : null,
                ageFrom: data.ageFrom ? parseInt(data.ageFrom.replace(/\s/g, ''), 10) : null,
                ageTo: data.ageTo ? parseInt(data.ageTo.replace(/\s/g, ''), 10) : null,
                imageUrls: urls,
                ageGroup: data.ageGroup,
                gender: data.gender,
                productType: data.productType,
                originalPrice: data.originalPrice ? parseFloat(data.originalPrice.replace(/\s/g, '')) : null,
                discountPercentage: data.discountPercentage ? parseInt(data.discountPercentage.replace(/\s/g, ''), 10) : null,
                discountedPrice: data.discountedPrice ? parseFloat(data.discountedPrice.replace(/\s/g, '')) : null,
                createdAt: new Date().toISOString(),
            };

            const db = getFirestore(app);
            await addDoc(collection(db, "products"), newProduct);

            toast({
                title: t.productSavedTitle,
                description: `${t.productLabel} "${data.name}" ${t.wasSuccessfullyCreated}`,
            });

            router.push('/admin');

        } catch (error: any) {
            console.error("Error saving product:", error);
            toast({
                title: t.saveErrorTitle,
                description: error.message || t.errorSavingProduct,
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <BackButton />
            <div className="pb-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <ImageUploader images={images} setImages={setImages} />

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
                                name="price" // Reverted to price
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                            {/*DISCOUNT FIELDS (reverted to optional direct input) */}
                            <div className="flex gap-4">
                                <FormField
                                    control={form.control}
                                    name="originalPrice"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Оригинальная цена (для скидки)</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder="1 000 000"
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Цена до применения скидки. Если не указана, цена продажи будет считаться оригинальной.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="discountPercentage"
                                    render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormLabel>Процент скидки</FormLabel>
                                            <FormControl>
                                                <FormattedInput
                                                    placeholder="0"
                                                    value={field.value || ''}
                                                    onChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Например, 10 для 10%.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="px-4">
                            <Button type="submit" size="lg" className="w-full" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t.saveProduct}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </>
    );
}
