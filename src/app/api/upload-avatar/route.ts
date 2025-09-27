import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, db } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const image = formData.get('image') as File | null;
    const uid = formData.get('uid') as string | null;
    
    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
     if (!uid) {
      return NextResponse.json({ error: 'User ID is missing' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Image hosting service is not configured.' }, { status: 500 });
    }

    // Create a new FormData to send to ImgBB
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', image);

    // Upload to ImgBB
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: 'POST',
      body: imgbbFormData,
    });
    
    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('ImgBB API error:', result);
      throw new Error(result?.error?.message || 'Failed to upload image');
    }

    const imageUrl = result.data.url;

    // Update user's photoURL in Firebase Auth and Firestore
    await adminAuth.updateUser(uid, { photoURL: imageUrl });
    await db.collection('users').doc(uid).update({ photoURL: imageUrl });
    
    return NextResponse.json({ url: imageUrl });

  } catch (error: any) {
    console.error('Upload avatar error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
