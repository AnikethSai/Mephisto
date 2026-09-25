import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedParticipant } from '@/lib/auth';
import { getTeamById, transferCoins } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthenticatedParticipant(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please authenticate first.' },
        { status: 401 }
      );
    }

    // Check if source team is eliminated
    const sourceTeam = getTeamById(session.teamId);
    if (!sourceTeam) {
      return NextResponse.json(
        { success: false, error: 'Source team not found' },
        { status: 404 }
      );
    }

    if (sourceTeam.status === 'eliminated') {
      return NextResponse.json(
        { success: false, error: 'Your team is eliminated. Soul Coin transfers are disabled.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { recipientTeamNumber, amount, note } = body;

    const parsedRecipient = parseInt(recipientTeamNumber, 10);
    const parsedAmount = parseInt(amount, 10);

    if (isNaN(parsedRecipient) || parsedRecipient <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid recipient team number' },
        { status: 400 }
      );
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Transfer amount must be a positive number of Soul Coins' },
        { status: 400 }
      );
    }

    if (parsedRecipient === session.teamNumber) {
      return NextResponse.json(
        { success: false, error: 'You cannot transfer Soul Coins to your own team' },
        { status: 400 }
      );
    }

    // Atomic transaction execution
    const result = transferCoins({
      sourceTeamId: session.teamId,
      destinationTeamNumber: parsedRecipient,
      amount: parsedAmount,
      note: note ? String(note).trim().slice(0, 150) : undefined,
    });

    // Real-time notification broadcast
    broadcastEvent({ type: 'BALANCE_UPDATE', teamId: result.sourceTeam.id });
    broadcastEvent({ type: 'BALANCE_UPDATE', teamId: result.destinationTeam.id });
    broadcastEvent({ type: 'TRANSACTION_NEW' });

    return NextResponse.json({
      success: true,
      data: {
        newBalance: result.sourceTeam.balance,
        transferredAmount: parsedAmount,
        recipientTeamNumber: result.destinationTeam.team_number,
        recipientTeamName: result.destinationTeam.team_name,
        transactionId: result.transaction.id,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Transfer failed';
    const status = message.includes('Eliminated teams') ? 403 : 400;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
