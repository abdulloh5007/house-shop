// src/app/api/bot/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// Define types for the Telegram Update and Message objects for clarity
interface TelegramUser {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
}

interface Contact {
    phone_number: string;
    first_name: string;
    last_name?: string;
    user_id?: number;
}

interface Message {
    message_id: number;
    from: TelegramUser;
    chat: {
        id: number;
        type: string;
    };
    date: number;
    text?: string;
    contact?: Contact;
}

interface TelegramUpdate {
    update_id: number;
    message?: Message;
}

export async function POST(req: NextRequest) {
  try {
    if (!db) {
      throw new Error("Firebase Admin SDK not initialized.");
    }

    const update = await req.json() as TelegramUpdate;

    // Check if the message and contact exist, and if the contact has a phone number
    if (update.message && update.message.contact && update.message.contact.phone_number) {
      const contact = update.message.contact;
      const user = update.message.from;

      // The user ID from the message `from` object is the chat_id we need
      const userId = user.id.toString();
      const phoneNumber = contact.phone_number.startsWith('+') 
        ? contact.phone_number 
        : `+${contact.phone_number}`;

      // Save the phone number to a temporary collection in Firestore.
      // The client-side will poll an endpoint that reads from this collection.
      const phoneRequestRef = db.collection('phone_requests').doc(userId);
      await phoneRequestRef.set({
        phoneNumber: phoneNumber,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Webhook received: Saved phone ${phoneNumber} for user ${userId} to Firestore.`);
    }

    // Always return a 200 OK to Telegram, otherwise it will keep retrying the webhook.
    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('Error processing Telegram webhook:', error);
    // Even on error, tell Telegram we got it to prevent retries.
    // You should add proper logging/monitoring here.
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}