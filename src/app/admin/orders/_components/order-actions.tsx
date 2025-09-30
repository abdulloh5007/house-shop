"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { getFirestore, doc, onSnapshot } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';

export function OrderActions({ orderId }: { orderId: string }) {
  const { lang } = useLanguage();
  const t = translations[lang];

  const [status, setStatus] = React.useState<string | null>(null);
  const [decidedAt, setDecidedAt] = React.useState<Date | null>(null);
  const [loading, setLoading] = React.useState<null | 'accept' | 'decline'>(null);

  React.useEffect(() => {
    const db = getFirestore(app);
    const orderRef = doc(db, 'orders', orderId);
    const unsub = onSnapshot(orderRef, (snap) => {
      const data = snap.data() as any;
      const s: string | undefined = data?.status;
      setStatus(s || 'pending');
      const decided = data?.decidedAt;
      const d = decided?.toDate ? decided.toDate() : decided ? new Date(decided) : null;
      setDecidedAt(d);
    });
    return () => unsub();
  }, [orderId]);

  React.useEffect(() => {
    if (status && status !== 'pending') {
      setLoading(null);
    }
  }, [status]);

  const onAccept = async () => {
    if (loading) return;
    setLoading('accept');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/accept`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
        },
      });
      if (!res.ok && res.type !== 'opaqueredirect') {
        // In case API returned an error
        console.error('Accept failed with status:', res.status);
        setLoading(null);
      }
      // Rely on Firestore subscription to update status and stop loader
    } catch (e) {
      console.error('Accept error:', e);
      setLoading(null);
    }
  };

  const onDecline = async () => {
    if (loading) return;
    setLoading('decline');
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/decline`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json',
        },
      });
      if (!res.ok && res.type !== 'opaqueredirect') {
        console.error('Decline failed with status:', res.status);
        setLoading(null);
      }
      // Rely on Firestore subscription to update status and stop loader
    } catch (e) {
      console.error('Decline error:', e);
      setLoading(null);
    }
  };

  const formatDateTime = (d: Date) => {
    const locale = lang === 'uz' ? 'uz-UZ' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
  };

  if (status === 'accepted' || status === 'declined') {
    return (
      <div className="rounded-xl border p-3 text-center">
        <div
          className={cn(
            'text-sm font-medium',
            status === 'accepted' ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'
          )}
        >
          {status === 'accepted' ? (t.statusAccepted || 'Одобрен') : (t.statusDeclined || 'Отказан')}
        </div>
        {decidedAt && (
          <div className="text-xs text-muted-foreground mt-1">
            {formatDateTime(decidedAt)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="destructive"
        className="w-full h-11 rounded-xl"
        onClick={onDecline}
        disabled={loading !== null}
      >
        {loading === 'decline' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t.decline || 'Отказать'}
      </Button>
      <Button
        type="button"
        className="w-full h-11 rounded-xl"
        onClick={onAccept}
        disabled={loading !== null}
      >
        {loading === 'accept' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t.accept || 'Принять'}
      </Button>
    </div>
  );
}
