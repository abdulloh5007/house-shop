
'use client';

import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Set initial state
    if (typeof window.navigator.onLine !== 'undefined') {
      setIsOffline(!window.navigator.onLine);
    }
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-destructive text-destructive-foreground p-2 text-sm transition-transform duration-300 ease-in-out',
        isOffline ? 'translate-y-0' : '-translate-y-full'
      )}
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4" />
      <span>Отсутствует подключение к сети</span>
    </div>
  );
}
