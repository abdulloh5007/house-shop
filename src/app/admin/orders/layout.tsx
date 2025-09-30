'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { OrdersBottomNavbar } from './_components/orders-bottom-navbar';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Provide bottom padding on pages that need content not to be overlapped by navbar
  const needsBottomPadding = true; // always in orders section

  return (
    <div className={needsBottomPadding ? 'pb-24' : ''}>
      {children}
      <OrdersBottomNavbar />
    </div>
  );
}
