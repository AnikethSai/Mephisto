import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySecret, createOrganizerToken, ORGANIZER_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // Check against organizers table
    const stmt = db.prepare('SELECT * FROM organizers WHERE username = ?');
    const org = stmt.get('mephisto') as { id: number; username: string; password_hash: string } | undefined;

    let isValid = false;
    let organizerId: string | number = 'master';

    if (org) {
      isValid = await verifySecret(password, org.password_hash);
      organizerId = org.id;
    }

    // Fallback: check against env variable
    if (!isValid && process.env.ORGANIZER_PASSWORD && password === process.env.ORGANIZER_PASSWORD) {
      isValid = true;
      organizerId = 'env-organizer';
    }

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid organizer credentials' },
        { status: 401 }
      );
    }

    const token = await createOrganizerToken({
      organizerId,
      username: 'mephisto',
      role: 'ORGANIZER',
    });

    const response = NextResponse.json({
      success: true,
      message: 'Organizer authentication successful',
    });

    response.cookies.set({
      name: ORGANIZER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Organizer login error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
