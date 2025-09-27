import { getFirestore, collection, query, where, getDocs, limit, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';
import { Loader2, Calendar, Hash, Package, Tag, Percent, ArrowDown, Clipboard, Wallet, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/components/language-provider';
import { translations } from '@/lib/translations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import TransactionClient from './transaction-client';

interface SaleDetails {
  id: string;
  selledAt: Timestamp;
  quantity: number; 
  sellingPrice: number;
  totalIncome: number;
  transactionHash: string;
  productName: string;
  productPrice: number;
  originalPrice?: number;
  discountedPrice?: number;
  discountPercentage?: number;
}

// 🔹 серверный компонент
export default async function TransactionPage({
  searchParams,
}: {
  searchParams: { hash?: string };
}) {
  const hash = searchParams.hash;

  if (!hash) {
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center p-4">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Error</h1>
        <p className="text-muted-foreground">Transaction hash not provided.</p>
      </div>
    );
  }

  try {
    const parts = hash.split('-_-');
    if (parts.length !== 2) {
      return (
        <div className="flex flex-col justify-center items-center h-screen text-center p-4">
          <h1 className="text-2xl font-bold mb-4 text-destructive">Error</h1>
          <p className="text-muted-foreground">Invalid transaction hash format.</p>
        </div>
      );
    }

    const productId = parts[1];
    const db = getFirestore(app);
    const salesCollectionRef = collection(db, `products/${productId}/selled`);
    const q = query(salesCollectionRef, where('transactionHash', '==', hash), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return (
        <div className="flex flex-col justify-center items-center h-screen text-center p-4">
          <h1 className="text-2xl font-bold mb-4">Transaction Not Found</h1>
          <p className="text-muted-foreground">The transaction with the provided hash could not be found.</p>
        </div>
      );
    }

    const saleDoc = querySnapshot.docs[0];
    const sale = { id: saleDoc.id, ...saleDoc.data() } as SaleDetails;

    // 🔹 вынесем отображение на клиент (Clipboard и useLanguage зависят от браузера)
    return <TransactionClient sale={sale} />;

  } catch (err) {
    console.error("Error finding transaction:", err);
    return (
      <div className="flex flex-col justify-center items-center h-screen text-center p-4">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Error</h1>
        <p className="text-muted-foreground">An error occurred while searching for the transaction.</p>
      </div>
    );
  }
}
