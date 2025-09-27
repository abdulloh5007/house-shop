// src/app/api/request-phone/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { userId } = await req.json();
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!userId || !BOT_TOKEN) {
    return NextResponse.json({ success: false, error: 'Missing userId or Bot Token' }, { status: 400 });
  }

  const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const body = {
    chat_id: userId,
    text: 'Пожалуйста, поделитесь вашим номером телефона, нажав на кнопку ниже.',
    reply_markup: {
      keyboard: [
        [{ text: 'Поделиться номером', request_contact: true }],
      ],
      one_time_keyboard: true,
      resize_keyboard: true,
    },
  };

  try {
    const response = await fetch(TELEGRAM_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.ok) {
      return NextResponse.json({ success: true });
    } else {
      console.error('Telegram API Error:', data);
      return NextResponse.json({ success: false, error: data.description }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to send message to Telegram:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
