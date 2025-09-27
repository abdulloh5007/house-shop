'use client';

import { useCart } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { Order } from '@/lib/types';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react'; // Import useState
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react'; // Import Loader2

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Please enter a valid email address.'),
  address: z.string().min(5, 'Address is too short.'),
  city: z.string().min(2, 'City is too short.'),
  zip: z.string().regex(/^\d{5}$/, 'Must be a 5-digit ZIP code.'),
  card: z.string().regex(/^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|6(?:011|5[0-9][0-9])[0-9]{12}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|(?:2131|1800|35\d{3})\d{11})$/, 'Invalid card number.'),
  expiry: z.string().regex(/^(0[1-9]|1[0-2])\/?([0-9]{4}|[0-9]{2})$/, 'Invalid expiry date (MM/YY).'),
  cvc: z.string().regex(/^[0-9]{3,4}$/, 'Invalid CVC.'),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isProcessingOrder, setIsProcessingOrder] = useState(false); // New state

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: '', email: '', address: '', city: '', zip: '', card: '', expiry: '', cvc: ''},
  });
  
  useEffect(() => {
    if (cart.items.length === 0) {
      router.replace('/');
    }
  }, [cart.items, router]);

  const onSubmit = async (data: CheckoutFormValues) => { // Make onSubmit async
    const newOrder: Order = {
      id: `ord_${new Date().getTime()}`,
      date: new Date().toISOString(),
      items: cart.items,
      total: cartTotal,
      customer: {
        name: data.name,
        email: data.email,
      },
    };

    setIsProcessingOrder(true); // Set to true when starting processing

    try {
      const response = await fetch('/api/admin/process-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order: newOrder }),
      });

      const result = await response.json();

      if (response.ok) {
        // Remove client-side order storage as it's now handled by backend
        // window.Telegram.WebApp.CloudStorage.getItem('neoncart-orders', (err, value) => {
        //   if (!err && value) {
        //     const existingOrders: Order[] = JSON.parse(value);
        //     const newOrders = [newOrder, ...existingOrders];
        //     window.Telegram.WebApp.CloudStorage.setItem('neoncart-orders', JSON.stringify(newOrders), (err) => {
        //       if (err) console.error('Error saving orders to cloud storage', err);
        //     });
        //   }
        // });

        clearCart();
        router.push(`/order-success?orderId=${newOrder.id}`);
      } else {
        throw new Error(result.error || 'Failed to process order');
      }
    } catch (err: any) {
      console.error('Error processing order:', err);
      toast({
        title: "Order Failed",
        description: err.message || "There was an error placing your order. Please try again.",
        variant: 'destructive'
      });
    } finally {
      setIsProcessingOrder(false); // Set to false when processing finishes
    }
  };

  if (cart.items.length === 0) {
    return null; // or a loading spinner
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold font-headline mb-8 text-center">Checkout</h1>
      <div className="grid grid-cols-1 gap-12">
         <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4">
                    <Image src={item.imageUrl} alt={item.name} width={64} height={64} className="rounded-md" />
                    <div className="flex-grow">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p>${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Shipping & Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                   <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input placeholder="you@example.com" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="address" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl><Input placeholder="123 Neon St" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="zip" render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP Code</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                   <Separator />
                   <FormField control={form.control} name="card" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Card Number</FormLabel>
                        <FormControl><Input placeholder="•••• •••• •••• ••••" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                     <FormField control={form.control} name="expiry" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expiry (MM/YY)</FormLabel>
                          <FormControl><Input placeholder="MM/YY" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="cvc" render={({ field }) => (
                        <FormItem>
                          <FormLabel>CVC</FormLabel>
                          <FormControl><Input placeholder="123" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={isProcessingOrder}>
                    {isProcessingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Place Order (${cartTotal.toFixed(2)})
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}