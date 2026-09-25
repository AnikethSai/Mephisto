'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  History,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Tag,
  Edit2,
  Plus,
  RefreshCw,
  UserCheck,
  UserX,
  Loader2,
  Shield,
} from 'lucide-react';
import { TransactionWithBalance, Transaction, OrganizerTeamSummary } from '@/lib/types';

interface Props {
  team: OrganizerTeamSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenAdjust: (team: OrganizerTeamSummary) => void;
  onEditTransaction: (tx: Transaction) => void;
  onStatusChange: (teamId: number, newStatus: 'active' | 'eliminated') => Promise<void>;
}

export function TeamHistoryModal({
  team,
  isOpen,
  onClose,
  onOpenAdjust,
  onEditTransaction,
  onStatusChange,
}: Props) {
  const [history, setHistory] = useState<TransactionWithBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusUpdating, setStatusUpdating] = useState<boolean>(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const fetchHistory = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/organizer/teams/${team.id}/history`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch team history:', e);
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    if (isOpen && team) {
      fetchHistory();
    }
  }, [isOpen, team, fetchHistory]);

  // Autofocus close button when modal opens for keyboard accessibility
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        closeBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key listener for closing history modal safely
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !statusUpdating) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, statusUpdating, onClose]);

  if (!isOpen || !team) return null;

  const isEliminated = team.status === 'eliminated';

  const handleToggleStatus = async () => {
    setStatusUpdating(true);
    try {
      await onStatusChange(team.id, isEliminated ? 'active' : 'eliminated');
      await fetchHistory();
    } finally {
      setStatusUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !statusUpdating) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-gradient-to-b from-gray-900 via-[#13090d] to-black border border-red-900/60 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-gray-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-red-950/80 border border-red-800/40 text-red-400">
              <History className="w-5 h-5 text-amber-400" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  TEAM #{team.teamNumber < 10 ? `0${team.teamNumber}` : team.teamNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isEliminated
                      ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                      : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                  }`}
                >
                  {team.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-100 mt-1">{team.teamName}</h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Summary Card */}
        <div className="p-5 bg-black/50 border-b border-gray-800/80 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Coins className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500/80 block">
                Current Soul Coins Balance
              </span>
              <span className="text-3xl font-black font-mono tracking-tight text-amber-400">
                {team.balance}
              </span>
            </div>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenAdjust(team)}
              className="py-2 px-3.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adjust Coins</span>
            </button>

            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={statusUpdating}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 disabled:opacity-50 ${
                isEliminated
                  ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-red-950/50 hover:bg-red-900/60 text-red-300 border-red-800/60'
              }`}
            >
              {statusUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isEliminated ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Reactivate Team</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>Mark Eliminated</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={fetchHistory}
              title="Refresh History"
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Scrollable Ledger History Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Audit Ledger &bull; Chronological Entries ({history.length})
            </h4>
            <span className="text-[11px] text-gray-500 font-mono">
              Running balance audited
            </span>
          </div>

          {loading && history.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span>Auditing ledger records...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-black/40 border border-gray-800 text-gray-500 text-xs">
              No transactions recorded for this team yet.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => {
                const isIncoming = tx.direction === 'INCOMING';
                let description = '';

                if (tx.type === 'ORGANIZER_GRANT') {
                  description = 'Organizer Grant (Mephisto)';
                } else if (tx.type === 'ORGANIZER_DEDUCT') {
                  description = 'Organizer Revocation (Mephisto)';
                } else if (tx.type === 'TRANSFER') {
                  if (isIncoming) {
                    description = `Received from Team ${tx.source_team_number ?? '?'}`;
                  } else {
                    description = `Transferred to Team ${tx.destination_team_number ?? '?'}`;
                  }
                }

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-xl bg-black/60 border border-gray-800/80 hover:border-gray-700/80 transition flex items-center justify-between gap-3 shadow-md"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                          isIncoming
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : 'bg-red-950/60 text-red-400 border border-red-800/40'
                        }`}
                      >
                        {isIncoming ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-200 truncate">
                            {description}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold shrink-0">
                            <Tag className="w-2.5 h-2.5" />
                            {tx.badge}
                          </span>
                        </div>

                        {tx.note && (
                          <p className="text-[11px] text-gray-400 italic truncate">
                            &ldquo;{tx.note}&rdquo;
                          </p>
                        )}

                        <span className="text-[10px] text-gray-500 font-mono block">
                          TX #{tx.id} &bull; {new Date(tx.created_at).toLocaleTimeString()} &bull; {new Date(tx.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Amount & Running Balance After Transaction */}
                    <div className="flex flex-col items-end shrink-0 pl-2">
                      <span
                        className={`font-mono font-black text-sm sm:text-base ${
                          isIncoming ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}{tx.amount}
                      </span>
                      <span className="text-[10px] font-mono text-gray-400 mt-0.5">
                        Balance after: <strong className="text-amber-400">{tx.balanceAfter}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditTransaction(tx)}
                        className="mt-1 text-[10px] text-gray-500 hover:text-amber-300 transition flex items-center gap-1"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>Edit Badge</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800/80 bg-black/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <Shield className="w-3.5 h-3.5 text-amber-500" />
            <span>Immutable Ledger Audit View &bull; Values verified</span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="py-1.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
}
