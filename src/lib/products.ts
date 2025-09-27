import type { Product } from './types';
import { PlaceHolderImages } from './placeholder-images';

const getImage = (id: string) => {
  const img = PlaceHolderImages.find((p) => p.id === id);
  if (!img) {
    return {
      imageUrl: 'https://placehold.co/600x400',
      imageHint: 'placeholder image',
    };
  }
  return { imageUrl: img.imageUrl, imageHint: img.imageHint };
};

export const products: Product[] = [
  {
    id: 'prod_1',
    name: 'Aura Headphones',
    description: 'High-fidelity wireless headphones with noise cancellation.',
    price: 249.99,
    category: 'Electronics',
    ...getImage('1'),
  },
  {
    id: 'prod_2',
    name: 'Nebula Smartphone',
    description: 'The latest smartphone with a stunning OLED display and pro-grade camera.',
    price: 999.0,
    category: 'Electronics',
    ...getImage('2'),
  },
  {
    id: 'prod_3',
    name: 'Vortex Laptop',
    description: 'A powerful gaming laptop for the most demanding titles.',
    price: 1899.99,
    category: 'Electronics',
    ...getImage('3'),
  },
  {
    id: 'prod_9',
    name: 'Chrono Watch',
    description: 'A sleek smart watch with advanced fitness and health tracking.',
    price: 349.00,
    category: 'Electronics',
    ...getImage('9'),
  },
  {
    id: 'prod_4',
    name: 'Zenith T-Shirt',
    description: 'A comfortable and stylish t-shirt made from premium cotton.',
    price: 29.99,
    category: 'Apparel',
    ...getImage('4'),
  },
  {
    id: 'prod_5',
    name: 'Nomad Jeans',
    description: 'Classic-fit denim jeans for everyday wear.',
    price: 89.5,
    category: 'Apparel',
    ...getImage('5'),
  },
  {
    id: 'prod_6',
    name: 'Apex Sneakers',
    description: 'Lightweight and trendy sneakers for any occasion.',
    price: 120.0,
    category: 'Apparel',
    ...getImage('6'),
  },
  {
    id: 'prod_10',
    name: 'Quest Backpack',
    description: 'A durable and stylish backpack for your daily commute or travel.',
    price: 75.00,
    category: 'Apparel',
    ...getImage('10'),
  },
  {
    id: 'prod_7',
    name: 'Galaxy Adrift',
    description: 'A captivating science fiction novel by a best-selling author.',
    price: 15.99,
    category: 'Books',
    ...getImage('7'),
  },
  {
    id: 'prod_8',
    name: 'The Focused Mind',
    description: 'An inspiring self-help book on productivity and mindfulness.',
    price: 22.5,
    category: 'Books',
    ...getImage('8'),
  },
];
