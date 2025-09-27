'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, ChevronRight, Megaphone, Users, ClipboardList } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';

export default function ProfilePage() {
  const { user: authUser, profile, loading } = useAuth();
  const { lang } = useLanguage();
  const t = translations[lang];

  const headerRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);

  const stateRef = useRef({
    dragging: false,
    startY: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
    currentScale: 1,
    raf: 0,
  });

  const MAX_SCALE = 1.2; // 🔥 максимум увеличения как в Telegram
  const RETURN_DAMPING = 0.18;

  const setScale = (s: number) => {
    const el = bgRef.current;
    if (!el) return;
    stateRef.current.currentScale = s;
    el.style.transform = `scale(${s})`;
  };

  const startReleaseAnimation = () => {
    const st = stateRef.current;
    if (st.raf) cancelAnimationFrame(st.raf);

    const step = () => {
      const s = st.currentScale;
      const next = 1 + (s - 1) * (1 - RETURN_DAMPING);

      if (next <= 1.001) {
        setScale(1);
        st.raf = 0;
        return;
      }

      setScale(next);
      st.raf = requestAnimationFrame(step);
    };

    st.raf = requestAnimationFrame(step);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.scrollY > 0) return;

    const isValidPointer =
      e.pointerType === 'touch' ||
      e.pointerType === 'pen' ||
      (e.pointerType === 'mouse' && e.buttons === 1);

    if (!isValidPointer) return;

    const st = stateRef.current;
    st.dragging = true;
    st.startY = e.clientY;
    st.lastY = e.clientY;
    st.lastT = performance.now();
    st.velocity = 0;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    if (!st.dragging) return;

    const y = e.clientY;
    const t = performance.now();

    const dy = y - st.startY;
    if (dy <= 0) return;

    const dt = Math.max(1, t - st.lastT);
    const vy = (y - st.lastY) / dt;
    st.velocity = vy;
    st.lastY = y;
    st.lastT = t;

    // Telegram-like stretchy effect
    const stretch = dy / 200; // чем меньше делитель, тем сильнее эффект
    const scale = Math.min(MAX_SCALE, 1 + stretch);

    setScale(scale);

    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = stateRef.current;
    if (!st.dragging) return;

    st.dragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    startReleaseAnimation();
  };

  useEffect(() => {
    return () => {
      const st = stateRef.current;
      if (st.raf) cancelAnimationFrame(st.raf);
    };
  }, []);

  if (loading || !authUser) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center h-screen">
        <Loader2 className="mx-auto h-10 w-10 animate-spin mb-3" />
      </div>
    );
  }

  const displayName = authUser.displayName || '—';
  const username = profile?.username ? `@${profile.username}` : '—';
  const photoURL = authUser.photoURL || '';

  const openTelegram = (url: string) => {
    const tg = (window as any).Telegram?.WebApp;
    try {
      tg?.HapticFeedback?.impactOccurred?.('medium');
    } catch {}
    try {
      if (tg?.openTelegramLink) tg.openTelegramLink(url);
      else if (tg?.openLink) tg.openLink(url);
      else window.open(url, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  const router = useRouter();
  const goto = (href: string) => {
    const tg = (window as any).Telegram?.WebApp;
    try { tg?.HapticFeedback?.impactOccurred?.('light'); } catch {}
    router.push(href);
  };

  return (
    <div
      className="w-full h-[100vh]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Full-bleed stretchy header */}
      <header
        ref={headerRef}
        className="relative w-full h-[42vh] min-h-[260px] max-h-[520px] overflow-hidden touch-pan-y select-none"
      >
        <div
          ref={bgRef}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat origin-top will-change-transform"
          style={{
            backgroundImage: photoURL
              ? `url('${photoURL}')`
              : 'linear-gradient(135deg, rgba(59,130,246,0.6), rgba(59,130,246,0.2))',
            transform: 'scale(1)',
          }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />
        <div className="absolute left-4 bottom-4 sm:left-6 sm:bottom-6 text-white drop-shadow">
          <div className="text-2xl sm:text-3xl font-bold">{displayName}</div>
          <div className="text-sm sm:text-base opacity-90">{username}</div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => openTelegram('https://t.me/hausshopping')}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
                  <Megaphone className="h-5 w-5" />
                </div>
                <span className="text-[15px] font-medium">Наш канал</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>

            <div className="h-px bg-border" />

            <button
              type="button"
              onClick={() => openTelegram('https://t.me/hausshopping01')}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-between px-4 py-4 active:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center shadow-sm">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-[15px] font-medium">Наш чат</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {profile?.role === 'admin' && (
          <div className="max-w-md mx-auto mt-6">
            <div className="rounded-2xl border bg-card overflow-hidden">
              <button
                type="button"
                onClick={() => goto('/admin')}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between px-4 py-4 active:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-sm">
                    <Shield className="h-5 w-5" />
                  </div>
                  <span className="text-[15px] font-medium">Админ панель</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>

              <div className="h-px bg-border" />

              <button
                type="button"
                onClick={() => goto('/admin/orders')}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between px-4 py-4 active:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <span className="text-[15px] font-medium">Заказы</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>

              <div className="h-px bg-border" />

              <button
                type="button"
                onClick={() => goto('/admin/users')}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full flex items-center justify-between px-4 py-4 active:bg-muted/60"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 text-white flex items-center justify-center shadow-sm">
                    <Users className="h-5 w-5" />
                  </div>
                  <span className="text-[15px] font-medium">Пользователи</span>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
