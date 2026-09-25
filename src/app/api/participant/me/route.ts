import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedParticipant } from '@/lib/auth';
import { getTeamById } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedParticipant(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please scan your team QR code and enter PIN.' },
        { status: 401 }
      );
    }

    const team = getTeamById(session.teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        teamNumber: team.team_number,
        teamName: team.team_name,
        balance: team.balance,
        status: team.status,
      },
    });
  } catch (error) {
    console.error('Participant /me error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve team data' },
      { status: 500 }
    );
  }
}
