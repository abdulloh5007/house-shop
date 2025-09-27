
import type { Metadata } from 'next';
import './globals.css';
import { Footer } from '@/components/footer';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import { AuthProvider } from '@/components/auth-provider';
import { Providers } from '@/components/providers';
import { AppContent } from '@/components/app-content';
import { LanguageProvider } from '@/components/language-provider';
import { OfflineIndicator } from '@/components/offline-indicator';

export const metadata: Metadata = {
  title: 'NeonCart',
  description: 'A modern e-commerce experience.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <Providers>
            <AuthProvider>
              <LanguageProvider>
                <OfflineIndicator />
                <AppContent>{children}</AppContent>
              </LanguageProvider>
            </AuthProvider>
            <Toaster />
        </Providers>
      </body>
    </html>
  );
}
