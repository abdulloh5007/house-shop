
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { collection, onSnapshot, getFirestore, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { app } from '@/lib/firebase-client';

// Define the shape of a product
export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrls: string[];
  ageGroup: 'kids' | 'adults';
  gender: 'girl' | 'boy' | 'both';
  sizeFrom?: number;
  sizeTo?: number;
  ageFrom?: number;
  ageTo?: number;
  originalPrice?: number;
  discountPercentage?: number;
  description?: string;
}

// Define the shape of the context
interface ProductContextType {
  products: Product[];
  loading: boolean;
}

// Create the context
const ProductContext = createContext<ProductContextType | undefined>(undefined);

// Create the provider component
export function ProductProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirestore(app);
    const productsCollectionRef = collection(db, 'products');
    
    const unsubscribe = onSnapshot(productsCollectionRef, (snapshot: QuerySnapshot<DocumentData>) => {
      const productsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      setProducts(productsList);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching products:", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);


  const value = { products, loading };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

// Create a custom hook for easy access to the context
export function useProducts() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
}
