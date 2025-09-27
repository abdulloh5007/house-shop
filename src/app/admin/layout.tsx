
'use client';

import { Home, Wallet, BarChart3, Loader2, ShieldAlert, Settings } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProductProvider } from "./_components/product-provider";
import { usePathname } from "next/navigation";
import { translations } from "@/lib/translations";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";

function AdminBottomNavbar() {
    const pathname = usePathname(); 
    const { lang } = useLanguage();
    const t = translations[lang];

    const navItems = [
      { href: '/admin', icon: Home, label: t.navHome },
      { href: '/admin/analytics', icon: BarChart3, label: t.analytics },
      { href: '/admin/wallet', icon: Wallet, label: t.navWallet },
      { href: '/admin/settings', icon: Settings, label: t.navSettings },
    ]

    return (
      <div className="fixed bottom-2 left-0 right-0 z-50 px-4">
        <div className="container mx-auto h-16 flex items-center justify-around rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg p-2">
            {navItems.map((item) => (
               <Link 
                  key={item.href}
                  href={item.href} 
                  className={cn(
                    "flex flex-col items-center justify-center h-14 w-20 rounded-lg gap-1 transition-colors",
                    pathname.startsWith(item.href) && (item.href !== '/admin' || pathname === '/admin') 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-primary/80'
                    )}
                >
                <item.icon className="h-6 w-6" />
                <span className="text-xs">{item.label}</span>
            </Link>
            ))}
        </div>
      </div>
    );
}


export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const hideAdminBottom = pathname.startsWith('/admin/users') || pathname.startsWith('/admin/orders');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return (
        <div className="flex flex-col justify-center items-center h-screen text-center p-4">
            <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
            <h1 className="text-2xl font-bold">Доступ запрещен</h1>
            <p className="text-muted-foreground mt-2">
                У вас нет прав для просмотра этого раздела.
            </p>
            <Button asChild className="mt-6">
                <Link href="/profile">Вернуться в профиль</Link>
            </Button>
        </div>
    );
  }

  return (
    <ProductProvider>
        {hideAdminBottom && <BackButton />}
        <main className={hideAdminBottom ? "" : "pb-24"}>{children}</main>
        {!hideAdminBottom && <AdminBottomNavbar />}
    </ProductProvider>
  );
}
