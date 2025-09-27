
'use client';

import { useParams } from 'next/navigation';
import { AnalyticsProvider, useAnalytics } from '../_components/analytics-provider';
import { useProducts } from '../../_components/product-provider';
import { Loader2, Filter, LineChart as LineChartIcon, ArrowUpRight, Copy, Minus } from 'lucide-react';
import { BackButton } from '@/components/back-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from "react-day-picker";
import { format, startOfDay, endOfDay, subDays, startOfMonth, isSameDay } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from '@/hooks/use-toast';


// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
    if (numStr === undefined || numStr === null) return '0';
    const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
    if (isNaN(num)) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function ProductAnalyticsContent() {
    const params = useParams();
    const productId = params.productId as string;

    const { products, loading: productsLoading } = useProducts();
    const { sales, loading: salesLoading } = useAnalytics();
    const { lang } = useLanguage();
    const t = translations[lang];
    const { toast } = useToast();
    const locales = { ru, uz };

    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
    const [activePreset, setActivePreset] = useState<'today' | '7days' | 'month' | null>('today');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Load state from Telegram CloudStorage on mount
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.CloudStorage) return;

        const dateKey = `analytics_date_filter_${productId}`;
        const presetKey = `analytics_preset_filter_${productId}`;

        tg.CloudStorage.getItems([dateKey, presetKey], (err: any, values: any) => {
            if (err) {
                console.error("Error getting items from TG CloudStorage", err);
                return;
            }

            const savedRange = values[dateKey];
            if (savedRange) {
                try {
                    const { from, to } = JSON.parse(savedRange);
                    const fromDate = from ? new Date(from) : undefined;
                    const toDate = to ? new Date(to) : undefined;
                    if (fromDate && !isNaN(fromDate.getTime())) {
                        setDateRange({ from: fromDate, to: (toDate && !isNaN(toDate.getTime())) ? toDate : fromDate });
                    }
                } catch (e) { /* Ignore parsing errors */ }
            }

            const savedPreset = values[presetKey];
            if (savedPreset) {
                try {
                    const parsed = JSON.parse(savedPreset);
                    if (['today', '7days', 'month', null].includes(parsed)) {
                        setActivePreset(parsed);
                    }
                } catch (e) { /* Ignore parsing errors */ }
            }
        });
    }, [productId]);

    // Save state to Telegram CloudStorage on change
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.CloudStorage) return;

        const rangeToSave = {
            from: dateRange?.from?.toISOString(),
            to: dateRange?.to?.toISOString()
        };

        tg.CloudStorage.setItem(`analytics_date_filter_${productId}`, JSON.stringify(rangeToSave), (err: any) => {
            if (err) console.error("Error saving date range to TG CloudStorage", err);
        });

        tg.CloudStorage.setItem(`analytics_preset_filter_${productId}`, JSON.stringify(activePreset), (err: any) => {
            if (err) console.error("Error saving preset to TG CloudStorage", err);
        });
    }, [dateRange, activePreset, productId]);

    const formatDateButtonText = useMemo(() => {
        if (activePreset) {
            if (activePreset === 'today') return t.today;
            if (activePreset === '7days') return t.last7Days;
            if (activePreset === 'month') return t.thisMonth;
        }
    
        if (dateRange?.from) {
            if (dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
                return `${format(dateRange.from, 'dd.MM.yy')} - ${format(dateRange.to, 'dd.MM.yy')}`;
            }
            return format(dateRange.from, 'dd.MM.yyyy');
        }
    
        return t.filterByDate;
    }, [dateRange, activePreset, t, lang]);
    const product = useMemo(() => {
        return products.find(p => p.id === productId);
    }, [products, productId]);

    const filteredSales = useMemo(() => {
        if (!dateRange?.from) {
            return sales;
        }
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);

        return sales.filter(sale => {
            const saleDate = sale.selledAt.toDate();
            return saleDate >= fromDate && saleDate <= toDate;
        });
    }, [sales, dateRange]);

    const stats = useMemo(() => {
        // Calculate stats only on non-deleted sales
        const activeSales = filteredSales.filter(sale => !sale.deleted);
        const totalRevenue = activeSales.reduce((acc, sale) => acc + sale.totalIncome, 0);
        const unitsSold = activeSales.reduce((acc, sale) => acc + sale.quantity, 0);
        return { totalRevenue, unitsSold };
    }, [filteredSales]);

    const chartData = useMemo(() => {
        // Use only non-deleted sales for the chart
        const activeSales = filteredSales.filter(sale => !sale.deleted);
        const sortedSales = [...activeSales].sort((a, b) => a.selledAt.toDate().getTime() - b.selledAt.toDate().getTime());
        const isSingleDay = dateRange?.from && dateRange.to ? isSameDay(dateRange.from, dateRange.to) : dateRange?.from ? true : false;

        return sortedSales.map(sale => ({
            date: format(sale.selledAt.toDate(), isSingleDay ? 'HH:mm' : 'dd.MM'),
            price: sale.sellingPrice,
            fullDate: sale.selledAt.toDate(),
        }));
    }, [filteredSales, dateRange]);

    const handleDatePreset = (preset: 'today' | '7days' | 'month') => {
        const today = new Date();
        if (preset === 'today') {
            setDateRange({ from: today, to: today });
        } else if (preset === '7days') {
            setDateRange({ from: subDays(today, 6), to: today });
        } else if (preset === 'month') {
            setDateRange({ from: startOfMonth(today), to: today });
        }
        setActivePreset(preset);
        setIsFilterOpen(false);
    }


    const resetFilters = () => {
        setDateRange(undefined);
        setActivePreset(null);
        setIsFilterOpen(false);
    }

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(text);
        toast({
            title: t.copied,
            description: t.transactionHashCopied,
        });
    };

    if (productsLoading || salesLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <BackButton />
                <h1 className="text-2xl font-bold mb-4 mt-8">{t.errorTitle}</h1>
                <p className="text-destructive">{t.productNotFound}</p>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <BackButton />

            <div className="flex justify-between items-start mb-4">
                <h1 className="text-xl font-bold flex-1">{product.name}</h1>
                <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" className="flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            <span className="sm:inline">{formatDateButtonText}</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-2xl">
                        <SheetHeader>
                            <SheetTitle>{t.filterByDate}</SheetTitle>
                        </SheetHeader>
                        <div className="py-4">
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={(range) => {
                                    setDateRange(range);
                                    setActivePreset(null); // Reset preset when manually changing date
                                }}
                                className="rounded-md"
                                locale={locales[lang]}
                            />
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                <Button variant={activePreset === 'today' ? 'default' : 'ghost'} onClick={() => handleDatePreset('today')}>{t.today}</Button>
                                <Button variant={activePreset === '7days' ? 'default' : 'ghost'} onClick={() => handleDatePreset('7days')}>{t.last7Days}</Button>
                                <Button variant={activePreset === 'month' ? 'default' : 'ghost'} onClick={() => handleDatePreset('month')}>{t.thisMonth}</Button>
                            </div>
                        </div>
                        <SheetFooter className="grid grid-cols-2 gap-2">
                            <Button variant="secondary" onClick={resetFilters}>{t.reset}</Button>
                            <Button onClick={() => setIsFilterOpen(false)}>{t.apply}</Button>
                        </SheetFooter>
                    </SheetContent>
                </Sheet>
            </div>


            <div className="grid grid-cols-2 gap-4 mb-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t.unitsSold}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold tabular-nums">{formatNumber(stats.unitsSold)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t.totalRevenue}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-lg font-bold tabular-nums">{formatNumber(stats.totalRevenue)}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <LineChartIcon className="h-4 w-4" />
                        {t.priceDynamicsChart}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {chartData.length > 1 ? (
                        <ChartContainer config={{ price: { label: t.pricePerUnit, color: "hsl(var(--primary))" } }} className="h-[200px] w-full">
                            <ResponsiveContainer>
                                <LineChart
                                    data={chartData}
                                    margin={{
                                        top: 5,
                                        right: 10,
                                        left: 10,
                                        bottom: 5,
                                    }}
                                >
                                    <CartesianGrid vertical={false} />
                                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                    <YAxis
                                        tickFormatter={(value) => `${formatNumber(value)}`}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        width={80}
                                    />
                                    <ChartTooltip
                                        cursor={false}
                                        content={
                                            <ChartTooltipContent
                                                labelFormatter={(value, payload) => {
                                                    const date = payload?.[0]?.payload?.fullDate;
                                                    return date ? format(date, 'dd.MM.yyyy HH:mm') : value;
                                                }}
                                                formatter={(value) => `${formatNumber(value)} UZS`}
                                                indicator="dot"
                                            />
                                        }
                                    />
                                    <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" strokeWidth={2} dot={true} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (
                        <div className="text-center py-10 h-[200px] flex items-center justify-center">
                            <p className="text-muted-foreground">{t.notEnoughDataForChart}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <h2 className="text-lg font-semibold mb-4">{t.salesHistory}</h2>
            {filteredSales.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">
                        {sales.length === 0 ? t.noSalesYet : t.noTransactionsFound}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredSales.map(sale => (
                        <Link
                            href={`/admin/transaction?hash=${sale.transactionHash}`}
                            key={sale.id}
                            className="flex items-center gap-4 p-3 rounded-lg transition-colors bg-muted/30 hover:bg-muted/50"
                        >
                            <div className={`p-2 rounded-full ${sale.deleted ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                {sale.deleted ? (
                                    <Minus className="h-6 w-6 text-red-500" />
                                ) : (
                                    <ArrowUpRight className="h-6 w-6 text-green-500" />
                                )}
                            </div>
                            <div className="flex-grow">
                                <p className={`font-semibold ${sale.deleted ? 'text-red-600' : 'text-primary'}`}>
                                    {sale.deleted ? t.deleted : `+ ${formatNumber(sale.totalIncome)}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {sale.selledAt ? format(sale.selledAt.toDate(), 'dd.MM.yyyy HH:mm') : '...'}
                                </p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <p className="text-sm text-muted-foreground">
                                    {sale.quantity} {t.quantityUnit} &times; {formatNumber(sale.sellingPrice)}
                                </p>
                                {!sale.deleted && sale.transactionHash && (
                                    <div
                                        className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
                                        onClick={(e) => handleCopy(e, sale.transactionHash)}
                                    >
                                        <span>
                                            {sale.transactionHash.substring(0, 8)}...
                                        </span>
                                        <Copy className="h-3 w-3" />
                                    </div>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}


export default function ProductAnalyticsPage() {
    const params = useParams();
    const productId = params.productId as string;

    return (
        <AnalyticsProvider productId={productId}>
            <ProductAnalyticsContent />
        </AnalyticsProvider>
    );
}
