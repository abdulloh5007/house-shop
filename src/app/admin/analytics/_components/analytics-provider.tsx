
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { collection, onSnapshot, getFirestore, QuerySnapshot, DocumentData, orderBy, query, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';

// Define the shape of a sale transaction
export interface SaleTransaction {
  id: string;
  selledAt: Timestamp;
  quantity: number;
  sellingPrice: number;
  totalIncome: number;
  transactionHash: string;
}

// Define the shape of the context
interface AnalyticsContextType {
  sales: SaleTransaction[];
  loading: boolean;
}

// Create the context
const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined);

// Create the provider component
export function AnalyticsProvider({ productId, children }: { productId: string, children: ReactNode }) {
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const db = getFirestore(app);
    const salesCollectionRef = collection(db, `products/${productId}/selled`);
    const q = query(salesCollectionRef, orderBy('selledAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const salesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SaleTransaction));
      setSales(salesList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sales:", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [productId]);

  const value = { sales, loading };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// Create a custom hook for easy access to the context
export function useAnalytics() {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error('useAnalytics must be used within a AnalyticsProvider');
  }
  return context;
}
