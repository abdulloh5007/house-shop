
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { collection, onSnapshot, getFirestore, QuerySnapshot, DocumentData, doc, orderBy, query, Timestamp } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';

// Define the shape of a transaction
export interface BalanceTransaction {
  id: string;
  createdAt: Timestamp;
  productId: string;
  productName: string;
  saleId: string;
  transactionHash: string;
  purchasePrice: number;
  sellingPrice: number;
  totalIncome: number;
  realProfit: number;
  quantity: number;
  orderId: string;
  // Discount related fields
  originalPrice?: number;
  discountedPrice?: number;
  discountPercentage?: number;
}

// Define the shape of the balance data
export interface Balance {
  totalIncome: number;
  realProfit: number;
}

// Define the shape of the context
interface BalanceContextType {
  balance: Balance | null;
  transactions: BalanceTransaction[];
  loading: boolean;
}

// Create the context
const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

// Create the provider component
export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore(app);
    const balanceDocRef = doc(db, 'settings', 'balance');
    const transactionsCollectionRef = collection(balanceDocRef, 'transactions');
    const q = query(transactionsCollectionRef, orderBy('createdAt', 'desc'));

    const unsubscribeBalance = onSnapshot(balanceDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setBalance(docSnap.data() as Balance);
      } else {
        setBalance({ totalIncome: 0, realProfit: 0 });
      }
      setLoading(false); // Set loading to false after balance is fetched
    }, (error) => {
      console.error("Error fetching balance:", error);
      setLoading(false);
    });

    const unsubscribeTransactions = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const transactionsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as BalanceTransaction));
      setTransactions(transactionsList);
    }, (error) => {
      console.error("Error fetching transactions:", error);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribeBalance();
      unsubscribeTransactions();
    };
  }, []);

  const value = { balance, transactions, loading };

  return (
    <BalanceContext.Provider value={value}>
      {children}
    </BalanceContext.Provider>
  );
}

// Create a custom hook for easy access to the context
export function useBalance() {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }
  return context;
}
