"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sparkles, CheckCircle2, XCircle, BarChart3 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";
import { translations } from "@/lib/translations";
import { getFirestore, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';

// Keep a local type compatible with what's prepared on the server
export type UserMin = { id: string; displayName: string | null; username: string | null; photoURL: string | null };
export type OrderWithUser = {
  id: string;
  date: string | number | Date;
  items: Array<{ id?: string; name: string; price: number; imageUrl: string; quantity: number }>;
  total: number;
  status?: string | null;
  user?: UserMin;
};

type Props = {
  orders: OrderWithUser[];
};

function initials(name?: string | null): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  const [a, b] = [parts[0], parts[1]];
  return ((a?.[0] ?? "") + (b?.[0] ?? "")).toUpperCase() || (a?.[0]?.toUpperCase() ?? "U");
}

export default function OrdersClient({ orders }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const t = translations[lang];

  const [liveOrders, setLiveOrders] = React.useState<OrderWithUser[]>(orders || []);

  React.useEffect(() => {
    setLiveOrders(orders || []);
  }, [orders]);

  React.useEffect(() => {
    // Subscribe to Firestore for real-time order updates (status/date etc.)
    try {
      const db = getFirestore(app);
      const q = query(collection(db, 'orders'), orderBy('date', 'desc'));
      const unsub = onSnapshot(q, (snap) => {
        setLiveOrders((prev) => {
          const byId = new Map(prev.map((o) => [o.id, o]));
          const updated: OrderWithUser[] = snap.docs.map((d: any) => {
            const data = d.data() || {};
            const p = byId.get(d.id);
            return {
              id: d.id,
              date: (data.date?.toDate ? data.date.toDate() : data.date) || p?.date || new Date().toISOString(),
              items: Array.isArray(data.items) ? data.items : (p?.items || []),
              total: Number(data.total ?? p?.total ?? 0),
              status: data.status ?? p?.status ?? null,
              user: p?.user,
            } as OrderWithUser;
          });
          return updated;
        });
      });
      return () => unsub();
    } catch (e) {
      // If Firebase not available client-side for any reason, keep SSR data
      console.error('Orders live subscription error:', e);
    }
  }, []);

  const statusParam = (searchParams.get("status") || "new").toLowerCase();
  const setStatus = (next: "new" | "accepted" | "declined") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const filtered = React.useMemo(() => {
    if (!liveOrders?.length) return [] as OrderWithUser[];
    if (statusParam === "accepted") return liveOrders.filter((o) => (o.status || "") === "accepted");
    if (statusParam === "declined") return liveOrders.filter((o) => (o.status || "") === "declined");
    // default "new": no status or unknown status
    return liveOrders.filter((o) => (o.status || "") !== "accepted" && (o.status || "") !== "declined");
  }, [liveOrders, statusParam]);

  const navItems: Array<{ key: "new" | "accepted" | "declined" | "chart"; label: string; icon: React.ComponentType<any> }> = [
    { key: "new", label: t.ordersFilterNew || "Новый", icon: Sparkles },
    { key: "accepted", label: t.ordersFilterAccepted || "Одобренные", icon: CheckCircle2 },
    { key: "declined", label: t.ordersFilterDeclined || "Отказанные", icon: XCircle },
    { key: "chart", label: t.chart || "График", icon: BarChart3 },
  ];

  return (
    <div className="container mx-auto px-4 py-6 pb-28">
      <div className="max-w-2xl mx-auto">
        <Card className="rounded-2xl border bg-card overflow-hidden">
          {filtered.map((order, idx) => {
            const showSeparator = idx < filtered.length - 1;
            const u = order.user;
            const name = u?.displayName || "—";
            const uname = u?.username ? `@${u.username}` : "";

            return (
              <React.Fragment key={order.id}>
                <div className="w-full flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      {u?.photoURL ? (
                        <AvatarImage src={u.photoURL} alt={name} />
                      ) : (
                        <AvatarFallback className="text-sm font-medium">
                          {initials(name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium truncate" title={name}>{name}</div>
                      {uname && (
                        <div className="text-xs text-muted-foreground truncate" title={uname}>{uname}</div>
                      )}
                    </div>
                  </div>
                  <Button asChild variant="secondary" size="sm" className="rounded-full">
                    <Link href={`/admin/orders/${order.id}`}>Детали</Link>
                  </Button>
                </div>
                {showSeparator && <div className="h-px bg-border" />}
              </React.Fragment>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground">
              {t.noOrdersYet || "Заказы не найдены."}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom navbar removed; now provided by orders layout */}
    </div>
  );
}
