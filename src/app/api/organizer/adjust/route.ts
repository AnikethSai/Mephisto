import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { adjustBalance } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';

export async function POST(req: NextRequest) {
  try {
    const organizer = await getAuthenticatedOrganizer(req);
    if (!organizer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized organizer access' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { teamId, amountDelta, badge, note } = body;

    const parsedTeamId = parseInt(teamId, 10);
    const parsedDelta = parseInt(amountDelta, 10);

    if (isNaN(parsedTeamId) || parsedTeamId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid team ID is required' },
        { status: 400 }
      );
    }

    if (isNaN(parsedDelta) || parsedDelta === 0) {
      return NextResponse.json(
        { success: false, error: 'Adjustment amount must be a non-zero integer' },
        { status: 400 }
      );
    }

    const selectedBadge = badge && typeof badge === 'string' ? badge.trim() : 'General / Adjustment';

    // Perform atomic adjustment
    const result = adjustBalance({
      teamId: parsedTeamId,
      amountDelta: parsedDelta,
      badge: selectedBadge,
      note: note ? String(note).trim().slice(0, 200) : undefined,
    });

    // Notify listeners in real time
    broadcastEvent({ type: 'BALANCE_UPDATE', teamId: parsedTeamId });
    broadcastEvent({ type: 'TRANSACTION_NEW' });

    return NextResponse.json({
      success: true,
      data: {
        team: {
          id: result.team.id,
          teamNumber: result.team.team_number,
          teamName: result.team.team_name,
          balance: result.team.balance,
        },
        transaction: result.transaction,
      },
      message: `Adjusted Team ${result.team.team_number} balance by ${parsedDelta > 0 ? '+' : ''}${parsedDelta} Soul Coins.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Adjustment failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
