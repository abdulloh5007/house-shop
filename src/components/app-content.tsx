'use client';
import { useAuth } from '@/components/auth-provider';
import { Footer } from '@/components/footer';
import { BottomNavbar } from '@/components/bottom-navbar';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Define the type for the Telegram Web App object
interface TelegramWebApp {
  enableClosingConfirmation: () => void;
  // disableClosingConfirmation: () => void; // This is not what we want now
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function AppContent({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isAdminSection = pathname.startsWith('/admin');

  const isProductPage = pathname.startsWith('/product/');
  const isCheckoutPage = pathname.startsWith('/checkout');

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      // Включаем подтверждение закрытия
      window.Telegram.WebApp.enableClosingConfirmation();

      // Отключаем вертикальные свайпы (свайп вниз для закрытия)
      if ('disableVerticalSwipes' in window.Telegram.WebApp) {
        window.Telegram.WebApp.disableVerticalSwipes();
      }
    }
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);

      let startParam =
        params.get("tgWebAppStartParam") ||
        (window as any)?.Telegram?.WebApp?.initDataUnsafe?.start_param;

      console.log("Raw startParam:", startParam);

      if (!startParam) return;

      const handledKey = "tg_start_param_handled";
      const lastHandled = sessionStorage.getItem(handledKey);
      if (lastHandled === startParam) return;

      const decoded = decodeURIComponent(startParam);
      console.log("Decoded startParam:", decoded);

      let productId: string | null = null;

      // 1. case: query ?productId=123
      if (decoded.includes("product_")) {
        productId = decoded.split("product_")[1]?.split("&")[0] || null;
      } else {
        // 2. case: start_param like "product_123" or "product=123"
        const m = decoded.match(/product[_=]([A-Za-z0-9_-]+)/);
        if (m && m[1]) productId = m[1];
      }

      if (productId && !pathname.startsWith(`/product/${productId}`)) {
        sessionStorage.setItem(handledKey, startParam);
        router.replace(`/product/${productId}`);
      }
    } catch (e) {
      console.error("Error handling startParam:", e);
    }
  }, [pathname, router]);


  // Conditionally render layout parts based on route
  if (isAdminSection) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="relative flex-grow">
        <main className="pb-24">{children}</main>
        {!isProductPage && !isCheckoutPage && <BottomNavbar />}
      </div>
      {!loading && user && <Footer />}
    </>
  );
}
