
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  api: {
    bodyParser: false, // Important: disable default body parser
  },
};

async function uploadToImgBB(image: File, apiKey: string): Promise<string> {
    const formData = new FormData();
    formData.append('image', image);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        console.error('ImgBB API error:', result);
        throw new Error(result?.error?.message || `Failed to upload ${image.name}`);
    }

    return result.data.url;
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const images = formData.getAll('images') as File[];
    
    if (!images || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 });
    }
     
    const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Image hosting service is not configured.' }, { status: 500 });
    }

    const uploadPromises = images.map(image => uploadToImgBB(image, apiKey));
    const urls = await Promise.all(uploadPromises);
    
    return NextResponse.json({ urls });

  } catch (error: any) {
    console.error('Upload product images error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
