import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;
    const isDbAlive = row && row.alive === 1;

    return NextResponse.json({
      status: isDbAlive ? 'ok' : 'degraded',
      database: isDbAlive ? 'connected' : 'unresponsive',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
