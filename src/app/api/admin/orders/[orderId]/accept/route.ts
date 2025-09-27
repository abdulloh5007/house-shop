import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  try {
    const { orderId } = params;
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    await db.collection('orders').doc(orderId).set(
      {
        status: 'accepted',
        decidedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const redirectUrl = new URL(`/admin/orders/${orderId}`, req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (e: any) {
    console.error('Accept order error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
