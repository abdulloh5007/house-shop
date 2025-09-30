import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    await db.collection('orders').doc(orderId).set(
      {
        status: 'declined',
        decidedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const isAjax = req.headers.get('x-requested-with') === 'XMLHttpRequest';
    if (isAjax) {
      return NextResponse.json({ ok: true, status: 'declined' });
    }
    const redirectUrl = new URL(`/admin/orders/${orderId}`, req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (e: any) {
    console.error('Decline order error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
