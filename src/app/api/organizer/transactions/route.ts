import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedOrganizer } from '@/lib/auth';
import { getAllTransactions } from '@/lib/db';

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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const transactions = getAllTransactions(limit);

    return NextResponse.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    console.error('Organizer transactions error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
