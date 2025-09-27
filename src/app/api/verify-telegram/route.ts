// src/app/api/verify-telegram/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { initData } = await req.json();

    if (!initData) {
      return NextResponse.json({ verified: false, error: 'No initData provided' }, { status: 400 });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) {
      console.error('Telegram bot token is not configured.');
      return NextResponse.json({ verified: false, error: 'Internal server error' }, { status: 500 });
    }

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    // The data must be sorted alphabetically by key
    const dataCheckArr: string[] = [];
    for (const [key, value] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckArr.sort().join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isVerified = hmac === hash;

    if (isVerified) {
      // In a real application, you might generate a session token here
      return NextResponse.json({ verified: true });
    } else {
      return NextResponse.json({ verified: false, error: 'Verification failed' }, { status: 403 });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ verified: false, error: 'Invalid request data' }, { status: 400 });
  }
}
