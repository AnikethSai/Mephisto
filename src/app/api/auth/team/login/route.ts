import { NextRequest, NextResponse } from 'next/server';
import { getTeamByAccessKey } from '@/lib/db';
import { verifySecret, createParticipantToken, PARTICIPANT_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accessKey, pin } = body;

    if (!accessKey || !pin) {
      return NextResponse.json(
        { success: false, error: 'Access token and PIN are required' },
        { status: 400 }
      );
    }

    const team = getTeamByAccessKey(String(accessKey).trim());
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Invalid team access link' },
        { status: 404 }
      );
    }

    const isPinValid = await verifySecret(String(pin).trim(), team.pin_hash);
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN' },
        { status: 401 }
      );
    }

    const token = await createParticipantToken({
      teamId: team.id,
      teamNumber: team.team_number,
      teamName: team.team_name,
      accessKey: team.access_key,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        teamNumber: team.team_number,
        teamName: team.team_name,
        balance: team.balance,
      },
    });

    response.cookies.set({
      name: PARTICIPANT_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Participant login error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate team' },
      { status: 500 }
    );
  }
}
