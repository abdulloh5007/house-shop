'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Define the type for the Telegram Web App object
interface BackButton {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
}

interface TelegramWebApp {
    BackButton: BackButton;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;

      const handleBackClick = () => {
        const normalized = (pathname || '').replace(/\/+$/, '');
        const isAdminTop =
          normalized === '/admin' ||
          normalized === '/admin/analytics' ||
          normalized === '/admin/wallet' ||
          normalized === '/admin/settings';
        if (isAdminTop) {
          router.replace('/profile');
        } else {
          window.history.back();
        }
      };
      
      tg.BackButton.show();
      tg.BackButton.onClick(handleBackClick);
      
      // Cleanup function to hide the button and remove the event listener
      // when the component unmounts.
      return () => {
        tg.BackButton.offClick(handleBackClick);
        tg.BackButton.hide();
      };
    }
  }, [pathname, router]);

  return null; // This component does not render anything in the DOM
}
