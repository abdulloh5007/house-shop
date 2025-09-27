// src/app/api/auth/telegram-phone-signin/route.ts
import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';
import { validate } from '@tma.js/init-data-node';
import type { User as TelegramUser } from '@tma.js/init-data-node';
import type { UserRecord } from 'firebase-admin/auth';

async function verifyTelegramData(initData: string): Promise<TelegramUser> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    throw new Error('Telegram Bot Token not configured on the server.');
  }

  validate(initData, BOT_TOKEN, { expiresIn: 3600 });

  const params = new URLSearchParams(initData);
  const userJson = params.get('user');
  if (!userJson) {
    throw new Error('User data is missing from initData');
  }
  return JSON.parse(userJson) as TelegramUser;
}

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !db) {
      throw new Error("Firebase Admin SDK not initialized.");
    }

    const { initData, phoneNumber, photoUrl } = await req.json();

    if (!initData || !phoneNumber) {
      return NextResponse.json({ error: 'initData and phoneNumber are required' }, { status: 400 });
    }

    let telegramUser: TelegramUser;
    try {
      telegramUser = await verifyTelegramData(initData);
    } catch (error: any) {
      console.error("Telegram data validation error:", error.message);
      return NextResponse.json({ error: 'Invalid Telegram data', details: error.message }, { status: 403 });
    }

    // The UID will always be based on the Telegram ID for consistency.
    const uid = `tg_${telegramUser.id}`;
    const formattedPhoneNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
    const finalPhotoUrl = photoUrl || telegramUser.photo_url || undefined;

    let userRecord: UserRecord;

    let wasCreated = false;

    try {
      // Try to get the user by our consistent UID.
      userRecord = await adminAuth.getUser(uid);
      // Do not update user data on sign-in
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // User does not exist, so create them.
        userRecord = await adminAuth.createUser({
          uid: uid,
          phoneNumber: formattedPhoneNumber,
          displayName: fullName,
          photoURL: finalPhotoUrl,
        });
        wasCreated = true;
      } else {
        // For other errors, re-throw.
        throw error;
      }
    }

    // Upsert (create or update) the user's profile in Firestore.
    const userDocRef = db.collection('users').doc(uid);
    if (wasCreated) {
      await userDocRef.set({
        tgId: telegramUser.id,
        displayName: fullName,
        phoneNumber: formattedPhoneNumber,
        photoURL: finalPhotoUrl,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    }
    // On login of existing users, do not update any profile data.

    // Create a custom token for the user and return it.
    const customToken = await adminAuth.createCustomToken(userRecord.uid);
    return NextResponse.json({ customToken });

  } catch (error: any) {
    console.error('Sign-in error:', error);
    const errorMessage = error.code === 'auth/invalid-phone-number' 
        ? 'Invalid phone number format.' 
        : error.message;
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}