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

    // Persist the order itself for admin/orders UI
    try {
      const orderRef = db.collection('orders').doc(order.id);
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
        ...order,
        items: itemsNormalized,
        status: 'pending',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to queue order persistence:', e);
    }

    for (const item of order.items) {
      const idStr = String((item as any).id ?? '');
      const productId = idStr.includes('__') ? idStr.split('__')[0] : (String((item as any).productId ?? idStr));
      const parsedSizeFromId = idStr.includes('__') ? idStr.split('__')[1] : null;
      const nameStr = String((item as any).name ?? '');
      const nameMatch = nameStr.match(/\(([^)]+)\)$/);
      const parsedSizeFromName = nameMatch ? nameMatch[1] : null;
      const selectedSize = (item as any).selectedSize ?? parsedSizeFromId ?? parsedSizeFromName ?? null;

      const productRef = db.collection('products').doc(productId);
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
        productId: productId,
        productName: item.name,
        productPrice: item.price, 
        size: selectedSize,
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
        productId: productId,
        productName: item.name,
        quantity: item.quantity,
        size: selectedSize,
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

      const sizesArr = Array.isArray(productData?.sizes) ? productData!.sizes : [];
      if (selectedSize !== null && sizesArr.length > 0) {
        const newSizes = sizesArr.map((s: any) =>
          String(s.size) === String(selectedSize)
            ? { ...s, quantity: Math.max(0, Number(s.quantity || 0) - Number(item.quantity || 0)) }
            : s
        );
        batch.update(productRef, { quantity: FieldValue.increment(-item.quantity), sizes: newSizes });
      } else {
        batch.update(productRef, { quantity: FieldValue.increment(-item.quantity) });
      }
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
