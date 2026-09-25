import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { updateTransactionBadge, getTransactionById } from '@/lib/db';
import { broadcastEvent } from '@/lib/events';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const organizer = await getAuthenticatedOrganizer(req);
    if (!organizer) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized organizer access' },
        { status: 401 }
      );
    }

    const transactionId = parseInt(id, 10);
    if (isNaN(transactionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid transaction ID' },
        { status: 400 }
      );
    }

    const existing = getTransactionById(transactionId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { badge, note } = body;

    if (!badge || typeof badge !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Badge name is required' },
        { status: 400 }
      );
    }

    // Changing the badge NEVER changes the coin balance
    const updated = updateTransactionBadge({
      transactionId,
      badge: badge.trim(),
      note: note !== undefined ? String(note).trim() : undefined,
    });

    broadcastEvent({ type: 'TRANSACTION_UPDATED' });

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Transaction badge updated successfully. Balances remain unchanged.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Update failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
