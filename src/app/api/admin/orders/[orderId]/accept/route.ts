import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to generate a simple unique hash for transactions
function generateTransactionHash(productId: string): string {
  const randomPart = Math.random().toString(36).substring(2, 17); // 15 chars
  return `hs${randomPart}-_-${productId}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await params;
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const orderData = orderSnap.data() as any;

    const isAjax = req.headers.get('x-requested-with') === 'XMLHttpRequest';

    // If already accepted/declined, return JSON for AJAX, else redirect
    if (orderData?.status === 'accepted' || orderData?.status === 'declined') {
      if (isAjax) {
        return NextResponse.json({ ok: true, status: orderData.status, decidedAt: orderData.decidedAt || null });
      }
      const redirectUrl = new URL(`/admin/orders/${orderId}`, req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Safety: if transactions for this order already exist (from previous logic), do not double-process stock
    const existingTxSnap = await db
      .collection('settings')
      .doc('balance')
      .collection('transactions')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (!orderData?.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      return NextResponse.json({ error: 'Order has no items' }, { status: 400 });
    }

    if (!existingTxSnap.empty) {
      // Mark as accepted without re-processing stock/transactions
      await orderRef.set(
        {
          status: 'accepted',
          decidedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      if (isAjax) {
        return NextResponse.json({ ok: true, status: 'accepted' });
      }
      const redirectUrl = new URL(`/admin/orders/${orderId}`, req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Process acceptance in a transaction to ensure atomic updates
    await db.runTransaction(async (tx) => {
      // READS FIRST
      const freshOrderSnap = await tx.get(orderRef);
      if (!freshOrderSnap.exists) throw new Error('Order not found');
      const freshOrder = freshOrderSnap.data() as any;

      if (!freshOrder?.items || !Array.isArray(freshOrder.items) || freshOrder.items.length === 0) {
        throw new Error('Order has no items');
      }

      // Normalize items with productId and size
      type ParsedItem = {
        productId: string;
        name: string;
        price: number;
        quantity: number;
        selectedSize: string | number | null;
      };

      const parsedItems: ParsedItem[] = freshOrder.items.map((raw: any) => {
        const idStr = String(raw?.id ?? '');
        const productId = raw?.productId
          ? String(raw.productId)
          : idStr && idStr.includes('__')
          ? idStr.split('__')[0]
          : String(idStr);
        const parsedSizeFromId = idStr && idStr.includes('__') ? idStr.split('__')[1] : null;
        const nameStr = String(raw?.name ?? '');
        const nameMatch = nameStr.match(/\(([^)]+)\)$/);
        const parsedSizeFromName = nameMatch ? nameMatch[1] : null;
        const selectedSize = raw?.selectedSize ?? parsedSizeFromId ?? parsedSizeFromName ?? null;
        return {
          productId,
          name: String(raw?.name ?? ''),
          price: Number(raw?.price ?? 0),
          quantity: Number(raw?.quantity ?? 0),
          selectedSize,
        };
      });

      // Read all involved product docs before any writes
      const uniqueProductIds = Array.from(new Set(parsedItems.map((it) => it.productId)));
      const productDataMap = new Map<string, { ref: FirebaseFirestore.DocumentReference; data: any }>();
      for (const pid of uniqueProductIds) {
        const pref = db.collection('products').doc(pid);
        const psnap = await tx.get(pref);
        if (!psnap.exists) {
          throw new Error(`Product with ID ${pid} not found.`);
        }
        productDataMap.set(pid, { ref: pref, data: psnap.data() as any });
      }

      // Validate and compute totals
      let totalOrderIncome = 0;
      let totalOrderProfit = 0;

      // Pre-compute stock updates and write payloads
      type ProductUpdatePlan = {
        ref: FirebaseFirestore.DocumentReference;
        newSizes: any[] | null;
        decrement: number;
      };
      const productUpdates: ProductUpdatePlan[] = [];

      type SalePayload = { ref: FirebaseFirestore.DocumentReference; data: any };
      const salePayloads: SalePayload[] = [];

      type BalanceTxPayload = { ref: FirebaseFirestore.DocumentReference; data: any };
      const balanceTxPayloads: BalanceTxPayload[] = [];

      for (const item of parsedItems) {
        if (!item.productId) throw new Error('Invalid product in order item');
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new Error('Invalid item quantity');
        if (!Number.isFinite(item.price) || item.price < 0) throw new Error('Invalid item price');

        const { ref: productRef, data: productData } = productDataMap.get(item.productId)!;
        const currentStock = Number(productData?.quantity || 0);
        const purchasePrice = Number(productData?.purchasePrice || 0);
        const sizesArr = Array.isArray(productData?.sizes) ? productData.sizes : [];

        // Stock validation
        if (item.selectedSize !== null && sizesArr.length > 0) {
          const sizeIndex = sizesArr.findIndex((s: any) => String(s.size) === String(item.selectedSize));
          if (sizeIndex === -1) {
            throw new Error(`Selected size not found for product ${item.productId}`);
          }
          const sizeStock = Number(sizesArr[sizeIndex]?.quantity || 0);
          if (sizeStock < item.quantity) {
            throw new Error(
              `Not enough stock for product ${item.productId} size ${item.selectedSize}. Available: ${sizeStock}, Ordered: ${item.quantity}`
            );
          }
        }
        if (currentStock < item.quantity) {
          throw new Error(
            `Not enough stock for product ${item.productId}. Available: ${currentStock}, Ordered: ${item.quantity}`
          );
        }

        // Totals
        const itemIncome = item.price * item.quantity;
        const itemCost = purchasePrice * item.quantity;
        const itemProfit = itemIncome - itemCost;
        totalOrderIncome += itemIncome;
        totalOrderProfit += itemProfit;

        // Prepare product update
        let newSizes: any[] | null = null;
        if (item.selectedSize !== null && sizesArr.length > 0) {
          newSizes = sizesArr.map((s: any) =>
            String(s.size) === String(item.selectedSize)
              ? { ...s, quantity: Math.max(0, Number(s.quantity || 0) - item.quantity) }
              : s
          );
        }
        productUpdates.push({ ref: productRef, newSizes, decrement: item.quantity });

        // Prepare sale payload
        const saleRef = productRef.collection('selled').doc();
        const transactionHash = generateTransactionHash(item.productId);
        salePayloads.push({
          ref: saleRef,
          data: {
            selledAt: FieldValue.serverTimestamp(),
            quantity: item.quantity,
            sellingPrice: item.price,
            purchasePrice: purchasePrice,
            totalIncome: itemIncome,
            totalProfit: itemProfit,
            productId: item.productId,
            productName: item.name || String(productData?.name || ''),
            productPrice: item.price,
            size: item.selectedSize,
            transactionHash: transactionHash,
            orderId: orderId,
            originalPrice: productData?.originalPrice ?? null,
            discountPercentage: productData?.discountPercentage ?? null,
            discountedPrice: productData?.discountedPrice ?? null,
          },
        });

        // Prepare balance transaction payload
        const balanceRef = db.collection('settings').doc('balance');
        const balTxRef = balanceRef.collection('transactions').doc();
        balanceTxPayloads.push({
          ref: balTxRef,
          data: {
            createdAt: FieldValue.serverTimestamp(),
            productId: item.productId,
            productName: item.name || String(productData?.name || ''),
            quantity: item.quantity,
            size: item.selectedSize,
            sellingPrice: item.price,
            purchasePrice: purchasePrice,
            totalIncome: itemIncome,
            realProfit: itemProfit,
            orderId: orderId,
            saleId: saleRef.id,
            transactionHash: transactionHash,
            originalPrice: productData?.originalPrice ?? null,
            discountPercentage: productData?.discountPercentage ?? null,
            discountedPrice: productData?.discountedPrice ?? null,
          },
        });
      }

      // WRITES AFTER ALL READS

      // Update each product stock (quantity and sizes)
      for (const upd of productUpdates) {
        if (upd.newSizes) {
          tx.update(upd.ref, { quantity: FieldValue.increment(-upd.decrement), sizes: upd.newSizes });
        } else {
          tx.update(upd.ref, { quantity: FieldValue.increment(-upd.decrement) });
        }
      }

      // Create sale documents
      for (const sp of salePayloads) {
        tx.set(sp.ref, sp.data);
      }

      // Create balance transaction documents
      for (const bp of balanceTxPayloads) {
        tx.set(bp.ref, bp.data);
      }

      // Update balance totals
      const balanceDocRef = db.collection('settings').doc('balance');
      tx.set(
        balanceDocRef,
        {
          totalIncome: FieldValue.increment(totalOrderIncome),
          realProfit: FieldValue.increment(totalOrderProfit),
          lastUpdated: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Mark order as accepted
      tx.set(
        orderRef,
        {
          status: 'accepted',
          decidedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    if (isAjax) {
      return NextResponse.json({ ok: true, status: 'accepted' });
    }
    const redirectUrl = new URL(`/admin/orders/${orderId}`, req.url);
    return NextResponse.redirect(redirectUrl);
  } catch (e: any) {
    console.error('Accept order error:', e);
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
