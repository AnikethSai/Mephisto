import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { getTeamById, getTeamHistoryWithRunningBalance } from '@/lib/db';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const organizer = await getAuthenticatedOrganizer(req);
    if (!organizer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized organizer access' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const teamId = parseInt(id, 10);
    if (isNaN(teamId) || teamId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid team ID' },
        { status: 400 }
      );
    }

    const team = getTeamById(teamId);
    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      );
    }

    const history = getTeamHistoryWithRunningBalance(teamId);

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: team.id,
          teamNumber: team.team_number,
          teamName: team.team_name,
          balance: team.balance,
          status: team.status,
          updatedAt: team.updated_at,
        },
        history,
      },
    });
  } catch (error) {
    console.error('Team history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch team history' },
      { status: 500 }
    );
  }
}
