
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScrollText, User } from 'lucide-react';
import { CartSheet } from '@/components/cart-sheet';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { MouseEvent } from 'react';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';


interface HapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        HapticFeedback: HapticFeedback;
      };
    };
  }
}

export function BottomNavbar() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const t = translations[lang];
  const navItems = [
    { href: '/', icon: Home, label: t.navHome || 'Home' },
    { href: '/orders', icon: ScrollText, label: t.navOrders || 'My Orders' },
    { href: '/profile', icon: User, label: t.navProfile || 'Profile' },
  ];

  const handleNavClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Trigger haptic feedback
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
      try {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      } catch (error) {
        console.error('Haptic feedback failed:', error);
      }
    }
  };

  return (
    <div className="fixed bottom-2 left-0 right-0 z-50 px-4">
      <div className="container mx-auto h-16 flex items-center justify-between rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg p-2">
        <nav className="flex items-center justify-around w-full">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' }),
                  'flex flex-col h-14 w-20 rounded-lg gap-1',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <item.icon className="h-6 w-6" />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
          <CartSheet />
        </nav>
      </div>
    </div>
  );
}
