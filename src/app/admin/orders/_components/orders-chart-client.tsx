"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { BackButton } from '@/components/back-button';
import { translations } from '@/lib/translations';
import { useLanguage } from '@/components/language-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { ru, uz } from 'date-fns/locale';
import { subDays, startOfMonth, startOfDay, endOfDay, format, isSameDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Input dates are serialized on server as ISO strings
export default function OrdersChartClient({ orders }: { orders: Array<{ date: string; qty: number }> }) {
  const { lang } = useLanguage();
  const t = translations[lang];
  const locales = { ru, uz };

  // default: 1 month
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfDay(new Date()) });
  const [activePreset, setActivePreset] = useState<'today' | '7days' | 'month' | null>('month');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Save/Load to Telegram CloudStorage (like wallet)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.CloudStorage) return;

    const dateKey = 'orders_chart_date_filter';
    const presetKey = 'orders_chart_preset_filter';

    tg.CloudStorage.getItems([dateKey, presetKey], (err: any, values: any) => {
      if (err) return;
      try {
        const savedRange = values[dateKey];
        if (savedRange) {
          const { from, to } = JSON.parse(savedRange);
          const fromDate = from ? new Date(from) : undefined;
          const toDate = to ? new Date(to) : undefined;
          if (fromDate && !isNaN(fromDate.getTime())) {
            setDateRange({ from: fromDate, to: toDate && !isNaN(toDate.getTime()) ? toDate : fromDate });
          }
        }
        const savedPreset = values[presetKey];
        if (savedPreset) {
          const parsed = JSON.parse(savedPreset);
          if (["today", "7days", "month", null].includes(parsed)) setActivePreset(parsed);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (!tg || !tg.CloudStorage) return;
    const rangeToSave = { from: dateRange?.from?.toISOString(), to: dateRange?.to?.toISOString() };
    tg.CloudStorage.setItem('orders_chart_date_filter', JSON.stringify(rangeToSave), () => {});
    tg.CloudStorage.setItem('orders_chart_preset_filter', JSON.stringify(activePreset), () => {});
  }, [dateRange, activePreset]);

  const handlePreset = (preset: 'today' | '7days' | 'month') => {
    const today = new Date();
    if (preset === 'today') setDateRange({ from: today, to: today });
    if (preset === '7days') setDateRange({ from: subDays(today, 6), to: today });
    if (preset === 'month') setDateRange({ from: startOfMonth(today), to: today });
    setActivePreset(preset);
    setIsFilterOpen(false);
  };

  const resetFilters = () => {
    setDateRange(undefined);
    setActivePreset(null);
    setIsFilterOpen(false);
  };

  // Compute daily order counts
  const filteredOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [] as Array<{ date: Date; qty: number }>;
    let items = orders
      .map((o) => ({ date: new Date(o.date), qty: Number(o.qty || 0) }))
      .filter((o) => !isNaN(o.date.getTime()));
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      items = items.filter((o) => o.date >= fromDate && o.date <= toDate);
    }
    // Sort by time ascending
    items.sort((a, b) => a.date.getTime() - b.date.getTime());
    return items;
  }, [orders, dateRange]);

  const chartData = useMemo(() => {
    if (!filteredOrders.length) return [] as Array<{ step: number; cumulative: number; label: string }>;
    let total = 0;
    return filteredOrders.map((o, idx) => {
      total += o.qty;
      return {
        step: idx + 1, // sequential order index by time
        cumulative: total, // cumulative items count
        label: format(o.date, 'dd.MM HH:mm'),
      };
    });
  }, [filteredOrders]);

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

  return (
    <div className="container mx-auto px-4 py-8 pb-24">
      <BackButton />
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t.chart}</h1>
        <Link href="/admin/orders" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}>
          {t.navOrders}
        </Link>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t.ordersTitle || 'Мои заказы'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <Button variant="outline" onClick={() => setIsFilterOpen(true)}>
                {formatDateButtonText}
              </Button>
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
                      setActivePreset(null);
                    }}
                    className="rounded-md"
                    locale={locales[lang]}
                  />
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <Button variant={activePreset === 'today' ? 'default' : 'ghost'} onClick={() => handlePreset('today')}>{t.today}</Button>
                    <Button variant={activePreset === '7days' ? 'default' : 'ghost'} onClick={() => handlePreset('7days')}>{t.last7Days}</Button>
                    <Button variant={activePreset === 'month' ? 'default' : 'ghost'} onClick={() => handlePreset('month')}>{t.thisMonth}</Button>
                  </div>
                </div>
                <SheetFooter className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={resetFilters}>{t.reset}</Button>
                  <Button onClick={() => setIsFilterOpen(false)}>{t.apply}</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          {chartData.length > 0 ? (
            <ChartContainer config={{ cumulative: { label: t.ordersTitle || 'Заказы', color: 'hsl(var(--primary))' } }} className="h-[260px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} width={40} />
                  <Tooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => payload?.[0]?.payload.label}
                        formatter={(value) => `${value} ${t.itemsCountSuffix || 'шт.'}`}
                        indicator="dot"
                      />
                    }
                  />
                  <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot />
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

      </div>
  );
}
