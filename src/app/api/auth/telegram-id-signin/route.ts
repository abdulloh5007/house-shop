// src/app/api/auth/telegram-id-signin/route.ts
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
      throw new Error('Firebase Admin SDK not initialized.');
    }

    const { initData, photoUrl } = await req.json();

    if (!initData) {
      return NextResponse.json({ error: 'initData is required' }, { status: 400 });
    }

    let telegramUser: TelegramUser;
    try {
      telegramUser = await verifyTelegramData(initData);
    } catch (error: any) {
      console.error('Telegram data validation error:', error.message);
      return NextResponse.json({ error: 'Invalid Telegram data', details: error.message }, { status: 403 });
    }

    const uid = `tg_${telegramUser.id}`;
    const fullName = `${telegramUser.first_name || ''} ${telegramUser.last_name || ''}`.trim();
    const username = telegramUser.username || null;
    const finalPhotoUrl = photoUrl || telegramUser.photo_url || undefined;

    let userRecord: UserRecord;
    let wasCreated = false;

    try {
      userRecord = await adminAuth.getUser(uid);
      // Update to fresh Telegram data on every login
      await adminAuth.updateUser(uid, {
        displayName: fullName || undefined,
        photoURL: finalPhotoUrl,
      });
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          uid,
          displayName: fullName || undefined,
          photoURL: finalPhotoUrl,
        });
        wasCreated = true;
      } else {
        throw error;
      }
    }

    // Upsert user profile in Firestore: always keep fresh data; also store username
    const userDocRef = db.collection('users').doc(uid);
    await userDocRef.set(
      {
        tgId: telegramUser.id,
        displayName: fullName || null,
        username: username,
        photoURL: finalPhotoUrl || null,
        ...(wasCreated ? { createdAt: new Date().toISOString() } : {}),
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const customToken = await adminAuth.createCustomToken(uid);
    return NextResponse.json({ customToken });
  } catch (error: any) {
    console.error('Sign-in error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
