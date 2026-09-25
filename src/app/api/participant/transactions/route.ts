import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedParticipant } from '@/lib/auth';
import { getTeamTransactions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthenticatedParticipant(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rawTxs = getTeamTransactions(session.teamId);

    // Map into clean participant perspective
    const transactions = rawTxs.map((tx) => {
      const isIncoming = tx.destination_team_id === session.teamId;
      return {
        id: tx.id,
        type: tx.type,
        direction: isIncoming ? 'INCOMING' : 'OUTGOING',
        amount: tx.amount,
        badge: tx.badge,
        note: tx.note,
        createdAt: tx.created_at,
        counterparty:
          tx.type === 'TRANSFER'
            ? isIncoming
              ? {
                  teamNumber: tx.source_team_number,
                  teamName: tx.source_team_name,
                }
              : {
                  teamNumber: tx.destination_team_number,
                  teamName: tx.destination_team_name,
                }
            : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Participant transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve transactions' },
      { status: 500 }
    );
  }
}
