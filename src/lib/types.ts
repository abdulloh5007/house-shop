export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  purchasePrice: number; // Added new field
  category: string;
  imageUrl: string;
  images?: string[]; // Added for consistency
  stock: number; // Added for consistency
  createdAt: string; // Added for consistency
  // Discount related fields
  originalPrice?: number;
  discountedPrice?: number;
  discountPercentage?: number;
};

export type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  quantity: number;
  maxQuantity?: number;
};

export type Order = {
  id: string;
  number?: number; // Sequential order number
  date: string;
  items: CartItem[];
  total: number;
  userId?: string;
  status?: string;
  customer: {
    name: string;
    email: string;
    username?: string | null;
  };
};
