// src/app/api/get-phone/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (!db) {
    return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
  }

  try {
    const phoneRequestRef = db.collection('phone_requests').doc(userId);
    const docSnap = await phoneRequestRef.get();

    if (docSnap.exists) {
      const phoneNumber = docSnap.data()?.phoneNumber || null;
      
      // The number has been retrieved, so we can delete the request document.
      await phoneRequestRef.delete();

      return NextResponse.json({ phoneNumber });
    } else {
      // No document found, so the number hasn't been shared yet.
      return NextResponse.json({ phoneNumber: null });
    }
  } catch (error) {
    console.error('Error getting phone number from Firestore:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}