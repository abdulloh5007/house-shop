// src/app/api/admin/revert-transaction/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    if (!db) {
      throw new Error("Firebase Admin SDK not initialized.");
    }

    const { transactionHash, reason } = await req.json();

    if (!transactionHash) {
      return NextResponse.json({ error: 'Transaction hash is required' }, { status: 400 });
    }

    // Find the transaction in the balance collection first
    const balanceTransactionsRef = db.collection('settings/balance/transactions');
    const q = balanceTransactionsRef.where('transactionHash', '==', transactionHash).limit(1);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Transaction not found in balance history' }, { status: 404 });
    }

    const transactionDoc = querySnapshot.docs[0];
    const transactionData = transactionDoc.data();

    // Check if already reverted
    if (transactionData.deleted) {
      return NextResponse.json({ error: 'Transaction has already been reverted.' }, { status: 400 });
    }
    const { productId, saleId, quantity, totalIncome, realProfit, size } = transactionData;

    if (!productId || !saleId || !quantity || totalIncome === undefined || realProfit === undefined) {
        return NextResponse.json({ error: 'Transaction data is incomplete and cannot be reverted.' }, { status: 400 });
    }

    const productRef = db.collection('products').doc(productId);
    const saleRef = db.collection(`products/${productId}/selled`).doc(saleId);
    const balanceRef = db.collection('settings').doc('balance');

    // Use a database transaction to ensure all operations succeed or fail together
    await db.runTransaction(async (t) => {
      // --- READ PHASE ---
      // All reads must happen before any writes in a transaction.
      const productDoc = await t.get(productRef);
      
      let saleDoc = null;
      // Only try to get the sale document if saleId is valid.
      if (saleId && typeof saleId === 'string') {
        saleDoc = await t.get(saleRef);
      }

      // --- WRITE PHASE ---
      if (!productDoc.exists) {
        // If product was deleted, we can't return stock, but we can still revert financials
        console.warn(`Product ${productId} not found while reverting transaction. Stock will not be updated.`);
      } else {
        // 1. Return the sold quantity to the product's stock
        // Also return the quantity to the specific size bucket if available
        const prod = productDoc.data() as any;
        const sizesArr = Array.isArray(prod.sizes) ? prod.sizes : [];
        if (size !== undefined && size !== null && sizesArr.length > 0) {
          const newSizes = sizesArr.map((s: any) => {
            if (String(s.size) === String(size)) {
              return { ...s, quantity: Number(s.quantity || 0) + Number(quantity || 0) };
            }
            return s;
          });
          t.update(productRef, { quantity: FieldValue.increment(quantity), sizes: newSizes });
        } else {
          t.update(productRef, { quantity: FieldValue.increment(quantity) });
        }
      }

      // 2. Subtract income and profit from the main balance
      t.set(balanceRef, {
        totalIncome: FieldValue.increment(-totalIncome),
        realProfit: FieldValue.increment(-realProfit),
      }, { merge: true });

      // 3. Mark the transaction record in balance history as deleted
      t.update(transactionDoc.ref, {
        deleted: true,
        deleteReason: reason || 'N/A',
        deletedAt: FieldValue.serverTimestamp()
      });

      // 4. Mark the sale record as deleted if it was found
      if (saleDoc && saleDoc.exists) {
        t.update(saleRef, { deleted: true, deletedAt: FieldValue.serverTimestamp() });
      }
    });

    return NextResponse.json({ success: true, message: 'Transaction successfully reverted.' });

  } catch (error: any) {
    console.error('Error reverting transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}