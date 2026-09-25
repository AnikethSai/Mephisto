'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BalanceCard } from '@/components/participant/BalanceCard';
import { TransferModal } from '@/components/participant/TransferModal';
import { TransactionList } from '@/components/participant/TransactionList';
import { LogOut, RefreshCw, Radio } from 'lucide-react';

interface TeamData {
  teamNumber: number;
  teamName: string;
  balance: number;
  status: string;
}

export default function ParticipantPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferOpen, setTransferOpen] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);

  const fetchTeamData = useCallback(async () => {
    try {
      const res = await fetch('/api/participant/me', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTeam(data.data);
      }
    } catch (e) {
      console.error('Error fetching team:', e);
    }
  }, [router]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/participant/transactions', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.data);
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchTeamData();
    fetchTransactions();
  }, [fetchTeamData, fetchTransactions]);

  // Initial load & Polling fallback (4s)
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 4000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // Real-time Server-Sent Events (SSE)
  useEffect(() => {
    const sse = new EventSource('/api/events');

    sse.onopen = () => {
      setLiveConnected(true);
    };

    sse.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (
          payload.type === 'BALANCE_UPDATE' ||
          payload.type === 'TRANSACTION_NEW' ||
          payload.type === 'ORGANIZER_SYNC'
        ) {
          refreshAll();
        }
      } catch {
        // Heartbeat or malformed
      }
    };

    sse.onerror = () => {
      setLiveConnected(false);
    };

    return () => {
      sse.close();
    };
  }, [refreshAll]);

  const handleLogout = async () => {
    await fetch('/api/auth/team/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  if (loading && !team) {
    return (
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase font-semibold tracking-widest text-gray-400">
            Consulting Mephisto&apos;s Ledger...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return null;
  }

  const isEliminated = team.status === 'eliminated';

  return (
    <main className="flex-1 max-w-lg w-full mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Bar with Live Indicator and Logout */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Radio
            className={`w-3.5 h-3.5 ${
              liveConnected ? 'text-emerald-400 animate-pulse' : 'text-gray-500'
            }`}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            {liveConnected ? 'Live Connection' : 'Polling Sync'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            title="Refresh Ledger"
            className="p-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 hover:text-amber-300 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            title="Lock Vault"
            className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-red-950/40 border border-red-900/40 text-[11px] font-medium text-red-300 hover:bg-red-900/60 transition"
          >
            <LogOut className="w-3 h-3" />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Primary Balance Display Card */}
      <BalanceCard
        teamNumber={team.teamNumber}
        teamName={team.teamName}
        balance={team.balance}
        status={team.status}
        onOpenTransfer={() => {
          if (!isEliminated) {
            setTransferOpen(true);
          }
        }}
      />

      {/* Transaction History Section */}
      <TransactionList transactions={transactions} loading={loading} />

      {/* Transfer Modal Dialog */}
      <TransferModal
        currentBalance={team.balance}
        currentTeamNumber={team.teamNumber}
        isEliminated={isEliminated}
        isOpen={transferOpen && !isEliminated}
        onClose={() => setTransferOpen(false)}
        onSuccess={refreshAll}
      />
    </main>
  );
}
