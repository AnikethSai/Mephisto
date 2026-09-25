import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { getAllTeamsWithLastTx } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const organizer = await getAuthenticatedOrganizer(req);
    if (!organizer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized organizer access' },
        { status: 401 }
      );
    }

    const teams = getAllTeamsWithLastTx();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const enrichedTeams = teams.map((team) => ({
      id: team.id,
      teamNumber: team.team_number,
      teamName: team.team_name,
      balance: team.balance,
      status: team.status,
      accessKey: team.access_key,
      accessUrl: `${baseUrl}/t/${team.access_key}`,
      updatedAt: team.updated_at,
      lastTransaction: team.lastTransaction,
    }));

    return NextResponse.json({
      success: true,
      data: enrichedTeams,
    });
  } catch (error) {
    console.error('Organizer get teams error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}
