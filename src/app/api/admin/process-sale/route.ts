// src/app/api/admin/process-sale/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Atomically get the next order number (starting from 1)
async function getNextOrderNumber(): Promise<number> {
  if (!db) throw new Error('Firebase Admin SDK not initialized.');

  // Fallback: determine last number from orders collection (used only when counter is missing)
  let fallbackLast = 0;
  try {
    const snap = await db.collection('orders').orderBy('number', 'desc').limit(1).get();
    if (!snap.empty) {
      const data = snap.docs[0].data() as any;
      fallbackLast = Number(data.number || 0) || 0;
    }
  } catch {}

  const countersRef = db.collection('settings').doc('counters');
  const next = await db.runTransaction(async (tx) => {
    const counterSnap = await tx.get(countersRef);
    let last = fallbackLast;
    if (counterSnap.exists) {
      const d = counterSnap.data() as any;
      if (typeof d?.ordersLastNumber === 'number') last = d.ordersLastNumber;
    }
    const n = (Number.isFinite(last) ? last : 0) + 1;
    tx.set(countersRef, { ordersLastNumber: n }, { merge: true });
    return n;
  });

  return next;
}

export async function POST(req: NextRequest) {
  try {
    if (!db) {
      throw new Error("Firebase Admin SDK not initialized.");
    }

    const { order } = await req.json();

    if (!order || !order.items || order.items.length === 0) {
      return NextResponse.json({ error: 'Invalid order data' }, { status: 400 });
    }

    // Generate sequential order number and id
    const orderNumber = await getNextOrderNumber();
    const serverOrderId = `ord_${orderNumber}`;

    const batch = db.batch();

    // Only persist the order for admin review; do not touch stock or balances here.
    const orderRef = db.collection('orders').doc(serverOrderId);
    const itemsNormalized = Array.isArray(order.items)
      ? order.items.map((it: any) => {
          const idStr = String(it.id ?? '');
          const pid = idStr.includes('__') ? idStr.split('__')[0] : String(it.productId ?? idStr);
          const parsedFromId = idStr.includes('__') ? idStr.split('__')[1] : null;
          const nameStr = String(it.name ?? '');
          const nameMatch = nameStr.match(/\(([^)]+)\)$/);
          const parsedFromName = nameMatch ? nameMatch[1] : null;
          const sz = it.selectedSize ?? parsedFromId ?? parsedFromName ?? null;
          return {
            productId: pid,
            name: it.name,
            price: it.price,
            imageUrl: it.imageUrl,
            quantity: it.quantity,
            selectedSize: sz,
          };
        })
      : [];

    batch.set(orderRef, {
      id: serverOrderId,
      number: orderNumber,
      date: typeof order.date === 'string' ? order.date : new Date().toISOString(),
      total: Number(order.total) || 0,
      userId: order.userId || null,
      items: itemsNormalized,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({ success: true, orderId: serverOrderId, number: orderNumber });

  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
