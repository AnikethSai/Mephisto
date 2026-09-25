import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { updateTeamStatus } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';
import { TeamStatus } from '@/lib/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
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

    const body = await req.json();
    const { status } = body;

    if (status !== 'active' && status !== 'eliminated') {
      return NextResponse.json(
        { success: false, error: 'Invalid status. Must be "active" or "eliminated"' },
        { status: 400 }
      );
    }

    const updatedTeam = updateTeamStatus(teamId, status as TeamStatus);

    broadcastEvent({ type: 'ORGANIZER_SYNC', teamId });
    broadcastEvent({ type: 'BALANCE_UPDATE', teamId });

    return NextResponse.json({
      success: true,
      data: updatedTeam,
      message: `Team ${updatedTeam.team_number} status updated to ${status}.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update team status';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
