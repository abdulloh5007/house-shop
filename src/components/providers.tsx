'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useReducer,
  useCallback,
} from 'react';
import type { CartItem, Product } from '@/lib/types';

// Theme Provider
type Theme = 'dark' | 'light' | 'system';

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
);

function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);

  useEffect(() => {
    const getTheme = () => {
      window.Telegram.WebApp.CloudStorage.getItem(storageKey, (err, value) => {
        if (err) {
          console.error('Error getting theme from cloud storage', err);
          return;
        }
        if (value === 'dark' || value === 'light' || value === 'system') {
          setTheme(value as Theme);
        }
      });
    };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      getTheme();
    }
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme);
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
        window.Telegram.WebApp.CloudStorage.setItem(storageKey, newTheme, (err) => {
          if (err) {
            console.error('Error setting theme in cloud storage', err);
          }
        });
      }
    },
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Cart Provider
type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: 'ADD_ITEM'; payload: Product | any }
  | { type: 'REMOVE_ITEM'; payload: { id: string } }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'SET_CART'; payload: CartItem[] }
  | { type: 'CLEAR_CART' };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      // Normalize product and support size/quantity selection
      const product = action.payload as any;
      const baseId = product.id;
      const selectedSize = product.selectedSize ?? null;
      const addQuantity = Math.max(1, Number(product.addQuantity) || 1);
      const nameBase = product.name;
      const price = typeof product.price === 'number' ? product.price : parseFloat(String(product.price || '0').replace(/\s/g, '')) || 0;
      const imageUrl = product.imageUrl || (Array.isArray(product.imageUrls) ? product.imageUrls[0] : undefined) || '';

      // Determine stock limit (per-size or global)
      let maxQuantity: number | undefined = undefined;
      if (Array.isArray(product.sizes) && selectedSize != null) {
        const sizeEntry = product.sizes.find((s: any) => String(s.size) === String(selectedSize));
        maxQuantity = sizeEntry ? (Number(sizeEntry.quantity) || 0) : 0;
      } else {
        maxQuantity = product.quantity ?? product.stock ?? undefined;
      }

      const id = selectedSize != null ? `${baseId}__${selectedSize}` : baseId;
      const displayName = selectedSize != null ? `${nameBase} (${selectedSize})` : nameBase;

      const existingItem = state.items.find((item) => item.id === id);
      if (existingItem) {
        const nextQty = existingItem.quantity + addQuantity;
        const max = existingItem.maxQuantity ?? (maxQuantity ?? Infinity);
        const finalQty = Math.min(nextQty, max);
        return {
          ...state,
          items: state.items.map((item) =>
            item.id === id ? { ...item, quantity: finalQty, maxQuantity: max } : item
          ),
        };
      }

      const initialQty = Math.min(addQuantity, maxQuantity ?? addQuantity);
      return {
        ...state,
        items: [
          ...state.items,
          {
            id,
            name: displayName,
            price,
            imageUrl,
            quantity: initialQty,
            maxQuantity,
          },
        ],
      };
    }
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.id !== action.payload.id),
      };
    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload;
      if (quantity <= 0) {
        return { ...state, items: state.items.filter((item) => item.id !== id) };
      }
      return {
        ...state,
        items: state.items.map((item) => {
          if (item.id !== id) return item;
          const max = item.maxQuantity ?? Infinity;
          const newQty = Math.min(quantity, max);
          return { ...item, quantity: newQty };
        }),
      };
    }
    case 'SET_CART':
      return { ...state, items: action.payload };
    case 'CLEAR_CART':
      return { ...state, items: [] };
    default:
      return state;
  }
};

type CartContextType = {
  cart: CartState;
  addToCart: (product: Product) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'neoncart-cart';

function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, { items: [] });

  useEffect(() => {
    const getCart = () => {
      window.Telegram.WebApp.CloudStorage.getItem(CART_STORAGE_KEY, (err, value) => {
        if (err) {
          console.error('Error getting cart from cloud storage', err);
          return;
        }
        if (value) {
          try {
            dispatch({ type: 'SET_CART', payload: JSON.parse(value) });
          } catch (error) {
            console.error('Failed to parse cart from cloud storage', error);
          }
        }
      });
    };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      getCart();
    }
  }, []);

  useEffect(() => {
    const saveCart = () => {
      try {
        const cartString = JSON.stringify(cart.items);
        window.Telegram.WebApp.CloudStorage.setItem(CART_STORAGE_KEY, cartString, (err) => {
          if (err) {
            console.error('Error saving cart to cloud storage', err);
          }
        });
      } catch (error) {
        console.error('Failed to stringify cart for cloud storage', error);
      }
    };
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.CloudStorage) {
      saveCart();
    }
  }, [cart.items]);
  
  const addToCart = useCallback((product: Product) => {
    dispatch({ type: 'ADD_ITEM', payload: product });
  }, []);
  
  const removeFromCart = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: { id } });
  }, []);
  
  const updateQuantity = useCallback((id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
  }, []);

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' });
  }, []);

  const cartTotal = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  
  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0);

  const value = { cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, itemCount };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

// Combined Providers
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <CartProvider>{children}</CartProvider>
    </ThemeProvider>
  );
}
