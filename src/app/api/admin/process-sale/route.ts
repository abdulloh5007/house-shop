// src/app/api/admin/process-sale/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to generate a simple unique hash for transactions
function generateTransactionHash(productId: string): string {
  const randomPart = Math.random().toString(36).substring(2, 17); // 15 chars
  return `hs${randomPart}-_-${productId}`;
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

    let totalOrderIncome = 0;
    let totalOrderProfit = 0;

    const batch = db.batch();

    for (const item of order.items) {
      const productRef = db.collection('products').doc(item.id);
      const productSnap = await productRef.get();

      if (!productSnap.exists) {
        throw new Error(`Product with ID ${item.id} not found.`);
      }

      const productData = productSnap.data();
      const purchasePrice = productData?.purchasePrice || 0; // Default to 0 if not set
      const currentStock = productData?.quantity || 0; // Assuming 'quantity' is stock

      // Calculate profit for this item
      const itemIncome = item.price * item.quantity;
      const itemCost = purchasePrice * item.quantity;
      const itemProfit = itemIncome - itemCost;

      totalOrderIncome += itemIncome;
      totalOrderProfit += itemProfit;

      // Record sale in subcollection (old approach, as requested)
      const saleRef = productRef.collection('selled').doc(); // Auto-generate sale ID
      const transactionHash = generateTransactionHash(item.id); // Generate hash for this transaction

      batch.set(saleRef, {
        selledAt: FieldValue.serverTimestamp(),
        quantity: item.quantity,
        sellingPrice: item.price,
        purchasePrice: purchasePrice, 
        totalIncome: itemIncome,
        totalProfit: itemProfit,
        productName: item.name,
        productPrice: item.price, 
        transactionHash: transactionHash, // Store hash here
        orderId: order.id, // Link to the original order
        originalPrice: productData.originalPrice || null, // Use null instead of undefined
        discountPercentage: productData.discountPercentage || null, // Use null instead of undefined
        discountedPrice: productData.discountedPrice || null, // Use null instead of undefined
      });

      // Add transaction to settings/balance/transactions collection
      const balanceTransactionsRef = db.collection('settings').doc('balance').collection('transactions').doc();
      batch.set(balanceTransactionsRef, {
        createdAt: FieldValue.serverTimestamp(),
        productId: item.id,
        productName: item.name,
        quantity: item.quantity,
        sellingPrice: item.price,
        purchasePrice: purchasePrice,
        totalIncome: itemIncome,
        realProfit: itemProfit,
        orderId: order.id,
        saleId: saleRef.id, // Link to the specific sale record
        transactionHash: transactionHash,
        originalPrice: productData.originalPrice || null, // Use null instead of undefined
        discountPercentage: productData.discountPercentage || null, // Use null instead of undefined
        discountedPrice: productData.discountedPrice || null, // Use null instead of undefined
      });

      // Update product stock
      if (currentStock < item.quantity) {
        throw new Error(`Not enough stock for product ${item.name}. Available: ${currentStock}, Ordered: ${item.quantity}`);
      }
      batch.update(productRef, { quantity: FieldValue.increment(-item.quantity) });
    }

    // Update wallet balances in settings/balance
    const balanceRef = db.collection('settings').doc('balance');
    batch.set(balanceRef, {
      totalIncome: FieldValue.increment(totalOrderIncome),
      realProfit: FieldValue.increment(totalOrderProfit),
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true }); // Use merge to create if not exists, and update fields

    await batch.commit();

    return NextResponse.json({ success: true, totalIncome: totalOrderIncome, realProfit: totalOrderProfit });

  } catch (error: any) {
    console.error('Error processing sale:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
