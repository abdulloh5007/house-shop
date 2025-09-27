'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceProvider, useBalance } from "./_components/balance-provider";
import { Loader2, ArrowUpRight, Minus, Copy, Search, Filter, DollarSign, TrendingUp, MoreHorizontal } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, isSameDay } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { BackButton } from "@/components/back-button";
import Link from "next/link";
import { translations } from "@/lib/translations";
import { useLanguage } from "@/components/language-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Helper to format the number with spaces
const formatNumber = (numStr: string | number | undefined): string => {
    if (numStr === undefined || numStr === null) return '0';
    const num = typeof numStr === 'number' ? numStr : parseFloat(String(numStr).replace(/\s/g, ''));
    if (isNaN(num)) return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

function WalletContent() {
    const { balance, transactions, loading } = useBalance();
    const { toast } = useToast();
    const { lang } = useLanguage();
    const t = translations[lang];

    const [selectedWallet, setSelectedWallet] = useState<'realProfit' | 'totalIncome'>('realProfit');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfDay(new Date()), to: endOfDay(new Date()) });
    const [activePreset, setActivePreset] = useState<'today' | '7days' | 'month' | null>('today');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    
    const locales = { ru, uz };

    // Load state from Telegram CloudStorage on mount
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.CloudStorage) return;

        const dateKey = 'wallet_date_filter';
        const presetKey = 'wallet_preset_filter';

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
    }, []);

    // Save state to Telegram CloudStorage on change
    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (!tg || !tg.CloudStorage) return;

        const rangeToSave = {
            from: dateRange?.from?.toISOString(),
            to: dateRange?.to?.toISOString()
        };

        tg.CloudStorage.setItem('wallet_date_filter', JSON.stringify(rangeToSave), (err: any) => {
            if (err) console.error("Error saving date range to TG CloudStorage", err);
        });

        tg.CloudStorage.setItem('wallet_preset_filter', JSON.stringify(activePreset), (err: any) => {
            if (err) console.error("Error saving preset to TG CloudStorage", err);
        });
    }, [dateRange, activePreset]);

    const displayedTransactions = useMemo(() => {
        return transactions.map(tx => ({
            ...tx,
            amount: selectedWallet === 'totalIncome' ? tx.totalIncome : tx.realProfit,
            deleted: (tx as any).deleted || false,
            deleteReason: (tx as any).deleteReason || ""
        }));
    }, [transactions, selectedWallet]);

    const filteredTransactions = useMemo(() => {
        let filtered = displayedTransactions;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(tx =>
                tx.productName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Filter by date range
        if (dateRange?.from) {
            const fromDate = startOfDay(dateRange.from);
            const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
            
            filtered = filtered.filter(tx => {
                const txDate = tx.createdAt.toDate();
                return txDate >= fromDate && txDate <= toDate;
            });
        }

        return filtered;
    }, [displayedTransactions, searchTerm, dateRange]);


    const chartData = useMemo(() => {
        if (filteredTransactions.length === 0) return [];
        
        // Filter out deleted transactions for chart
        const nonDeletedTransactions = filteredTransactions.filter(tx => !tx.deleted);
        if (nonDeletedTransactions.length === 0) return [];

        const dailyTotals = nonDeletedTransactions.reduce((acc, tx) => {
            const date = format(tx.createdAt.toDate(), 'yyyy-MM-dd');
            if (!acc[date]) {
                acc[date] = 0;
            }
            acc[date] += tx.amount;
            return acc;
        }, {} as Record<string, number>);
        
        // Sort days chronologically
        const sortedDays = Object.keys(dailyTotals).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());

        // Calculate cumulative profit/income
        let cumulativeAmount = 0;
        return sortedDays.map(date => {
            cumulativeAmount += dailyTotals[date];
            return {
                date: format(new Date(date), 'dd.MM'),
                amount: cumulativeAmount,
            };
        });
    }, [filteredTransactions]); // filteredTransactions already applies search and date range

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.stopPropagation();
        e.preventDefault();
        navigator.clipboard.writeText(text);
        toast({
            title: t.copied,
            description: t.transactionHashCopied,
        });
    };

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
    const resetFilters = () => {
      setSearchTerm('');
      setDateRange(undefined);
      setActivePreset(null);
      setIsFilterOpen(false);
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const displayedBalance = selectedWallet === 'realProfit' ? balance?.realProfit : balance?.totalIncome;
    const cardColor = selectedWallet === 'realProfit' ? "from-green-500 to-green-700" : "from-blue-500 to-blue-700";
    const cardIcon = selectedWallet === 'realProfit' ? <TrendingUp className="h-5 w-5" /> : <DollarSign className="h-5 w-5" />;


    return (
        <>
            <BackButton />
            <div className="my-6">
                {balance && (
                    <Card className={`shadow-lg bg-gradient-to-br ${cardColor} text-white relative`}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-white font-normal flex items-center gap-2">
                                {cardIcon}
                                {selectedWallet === 'realProfit' ? t.realProfit : t.totalIncome}
                            </CardTitle>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onSelect={() => setSelectedWallet('realProfit')}>
                                        <TrendingUp className="mr-2 h-4 w-4" />
                                        {t.realProfit}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setSelectedWallet('totalIncome')}>
                                        <DollarSign className="mr-2 h-4 w-4" />
                                        {t.totalIncome}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center">
                            <p className="text-3xl font-bold tabular-nums py-4">
                                {formatNumber(displayedBalance)}
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Tabs defaultValue="history" className="mt-8">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="history">{t.history}</TabsTrigger>
                    <TabsTrigger value="chart">{t.chart}</TabsTrigger>
                </TabsList>
                <TabsContent value="history">
                    <div className="mt-4 space-y-4">
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <Input
                                    placeholder={t.searchByProductName}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            </div>
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

                        {filteredTransactions.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed rounded-lg mt-4">
                                <p className="text-muted-foreground">
                                    {transactions.length === 0 ? t.noTransactionsYet : t.noTransactionsFound}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredTransactions.map(tx => (
                                    <Link
                                        href={`/admin/transaction?hash=${tx.transactionHash}`}
                                        key={tx.id}
                                        className="flex items-center gap-4 p-3 rounded-lg transition-colors bg-muted/30 hover:bg-muted/50"
                                    >
                                        <div className={`p-2 rounded-full ${tx.deleted ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                            {tx.deleted ? (
                                                <Minus className="h-6 w-6 text-red-500" />
                                            ) : (
                                                <ArrowUpRight className="h-6 w-6 text-green-500" />
                                            )}
                                        </div>
                                        <div className="flex-grow">
                                            <p className={`font-semibold ${tx.deleted ? 'text-red-600' : ''}`}>{tx.productName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {tx.createdAt ? format(tx.createdAt.toDate(), 'dd.MM.yyyy HH:mm') : '...'}
                                            </p>
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            {tx.deleted ? (
                                                <p className="font-semibold text-red-600 tabular-nums">{t.deleted}</p>
                                            ) : (
                                                <p className="font-bold text-green-600 tabular-nums">+ {formatNumber(tx.amount)}</p>
                                            )}
                                            {!tx.deleted && tx.transactionHash && (
                                                <div
                                                    className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer"
                                                    onClick={(e) => handleCopy(e, tx.transactionHash)}
                                                >
                                                    <span>{tx.transactionHash.substring(0, 8)}...</span>
                                                    <Copy className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>
                <TabsContent value="chart">
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>{selectedWallet === 'totalIncome' ? t.totalIncomeChartTitle : t.realProfitChartTitle || 'График роста чистой прибыли'}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.length > 1 ? (
                                <ChartContainer config={{ amount: { label: selectedWallet === 'totalIncome' ? t.totalIncome : t.realProfit, color: "hsl(var(--primary))" } }} className="h-[250px] w-full">
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
                                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
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
                                                        labelFormatter={(label, payload) => {
                                                            return payload?.[0]?.payload.date;
                                                        }}
                                                        formatter={(value) => `${formatNumber(value)} UZS`}
                                                        indicator="dot"
                                                    />
                                                }
                                            />
                                            <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={true} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            ) : (
                                <div className="text-center py-10">
                                    <p className="text-muted-foreground">{t.notEnoughDataForChart}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </>
    );
}


export default function WalletPage() {
    return (
        <BalanceProvider>
            <div className="container mx-auto px-4 py-8">
                <WalletContent />
            </div>
        </BalanceProvider>
    );
}
