'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Coins,
  Search,
  Plus,
  Minus,
  QrCode as QrIcon,
  Tag,
  Radio,
  RefreshCw,
  LogOut,
  Edit2,
  Users,
  ReceiptText,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  History,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AdjustmentModal } from '@/components/organizer/AdjustmentModal';
import { EditBadgeModal } from '@/components/organizer/EditBadgeModal';
import { TeamQrModal } from '@/components/organizer/TeamQrModal';
import { TeamHistoryModal } from '@/components/organizer/TeamHistoryModal';
import { Transaction, OrganizerTeamSummary } from '@/lib/types';

type TeamItem = OrganizerTeamSummary;

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'teams' | 'transactions' | 'cards'>('teams');

  // Filter & Search & Sort states
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'eliminated'>('all');
  const [sortBy, setSortBy] = useState<'number' | 'balance' | 'recent'>('number');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedTeamForAdjust, setSelectedTeamForAdjust] = useState<TeamItem | null>(null);
  const [adjustInitialMode, setAdjustInitialMode] = useState<'GRANT' | 'REVOKE'>('GRANT');

  const [selectedTeamForHistory, setSelectedTeamForHistory] = useState<TeamItem | null>(null);
  const [selectedTeamForQr, setSelectedTeamForQr] = useState<TeamItem | null>(null);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);

  // Quick feedback banner
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/organizer/teams', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/organizer/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTeams(data.data);
      }
    } catch (e) {
      console.error('Error fetching teams:', e);
    }
  }, [router]);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/organizer/transactions', { cache: 'no-store' });
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
    fetchTeams();
    fetchTransactions();
  }, [fetchTeams, fetchTransactions]);

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

    sse.onmessage = () => {
      refreshAll();
    };

    sse.onerror = () => {
      setLiveConnected(false);
    };

    return () => {
      sse.close();
    };
  }, [refreshAll]);

  const handleLogout = async () => {
    await fetch('/api/auth/organizer/logout', { method: 'POST' });
    router.push('/organizer/login');
    router.refresh();
  };

  // Status toggle handler
  const handleStatusChange = async (teamId: number, newStatus: 'active' | 'eliminated') => {
    if (statusChangingId !== null) return;
    setStatusChangingId(teamId);
    try {
      const res = await fetch(`/api/organizer/teams/${teamId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Team ${data.data.team_number} marked as ${newStatus}.`);
        refreshAll();
        if (selectedTeamForHistory && selectedTeamForHistory.id === teamId) {
          setSelectedTeamForHistory((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      }
    } catch (e) {
      console.error('Failed to change team status:', e);
    } finally {
      setStatusChangingId(null);
    }
  };

  // Open adjustment modal preloaded
  const openAdjust = (team: TeamItem | null, mode: 'GRANT' | 'REVOKE' = 'GRANT') => {
    setSelectedTeamForAdjust(team);
    setAdjustInitialMode(mode);
    setIsAdjustModalOpen(true);
  };

  // Event summary metrics
  const totalTeamsCount = teams.length;
  const activeTeamsCount = useMemo(() => teams.filter((t) => t.status === 'active').length, [teams]);
  const eliminatedTeamsCount = useMemo(() => teams.filter((t) => t.status === 'eliminated').length, [teams]);
  const totalSoulCoins = useMemo(() => teams.reduce((acc, t) => acc + (t.balance || 0), 0), [teams]);
  const totalTransactionsCount = transactions.length;
  const lastTransactionTime = useMemo(() => {
    if (transactions.length === 0) return 'No activity yet';
    const latest = transactions[0];
    return new Date(latest.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, [transactions]);

  // Filtered & Sorted Teams
  const processedTeams = useMemo(() => {
    let result = [...teams];

    // Filter by search
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.teamNumber.toString().includes(term) ||
          t.teamName.toLowerCase().includes(term) ||
          `team ${t.teamNumber}`.includes(term)
      );
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'number') {
        return sortOrder === 'asc' ? a.teamNumber - b.teamNumber : b.teamNumber - a.teamNumber;
      }
      if (sortBy === 'balance') {
        return sortOrder === 'asc' ? a.balance - b.balance : b.balance - a.balance;
      }
      if (sortBy === 'recent') {
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return 0;
    });

    return result;
  }, [teams, search, statusFilter, sortBy, sortOrder]);

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 lg:p-7 space-y-6">
      {/* Top Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-red-950/80 border border-red-800/40 text-red-400">
              <Shield className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-300 to-red-400">
              Organizer Command Center
            </h1>
          </div>
          <p className="text-xs text-gray-400 font-mono">
            Mephisto&apos;s Bargain &bull; Central Ledger &amp; Manual Economy Engine
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Prominent Global Adjust Button */}
          <button
            type="button"
            onClick={() => openAdjust(null, 'GRANT')}
            className="py-2.5 px-4 bg-gradient-to-r from-red-800 via-amber-600 to-red-800 hover:from-red-700 hover:via-amber-500 hover:to-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-950/50 hover:shadow-amber-900/30 transition flex items-center gap-1.5 active:scale-95"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>Adjust Soul Coins</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-gray-800">
            <Radio
              className={`w-3.5 h-3.5 ${
                liveConnected ? 'text-emerald-400 animate-pulse' : 'text-gray-500'
              }`}
            />
            <span className="text-[11px] font-mono font-semibold uppercase text-gray-300">
              {liveConnected ? 'SSE Live' : 'Polling Sync'}
            </span>
          </div>

          <button
            type="button"
            onClick={refreshAll}
            title="Manual sync"
            className="p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 border border-gray-800 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Floating Action Feedback Notification */}
      {feedback && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-xs text-emerald-200 font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* A. EVENT SUMMARY METRICS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Registered Teams */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#12080c] border border-gray-800 flex flex-col justify-between shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Registered Teams
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-gray-200">{totalTeamsCount}</span>
            <Users className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Active Teams */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#0e140f] border border-emerald-900/30 flex flex-col justify-between shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
            Active Teams
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-emerald-400">{activeTeamsCount}</span>
            <UserCheck className="w-4 h-4 text-emerald-500/70" />
          </div>
        </div>

        {/* Eliminated Teams */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#160a0d] border border-red-900/30 flex flex-col justify-between shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/90">
            Eliminated Teams
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-red-400">{eliminatedTeamsCount}</span>
            <UserX className="w-4 h-4 text-red-500/70" />
          </div>
        </div>

        {/* Total Soul Coins in Circulation */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#1a0f0a] border border-amber-900/40 flex flex-col justify-between shadow-lg sm:col-span-1 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90">
            Coins In Circulation
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-amber-400 tracking-tight">
              {totalSoulCoins.toLocaleString()}
            </span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        {/* Number of Transactions */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#0e070a] border border-gray-800 flex flex-col justify-between shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Total Transactions
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black font-mono text-gray-200">{totalTransactionsCount}</span>
            <ReceiptText className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* Last Transaction Time */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-gray-900 to-[#0e070a] border border-gray-800 flex flex-col justify-between shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Last Activity
          </span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-sm font-bold font-mono text-amber-300 truncate" title={lastTransactionTime}>
              {lastTransactionTime}
            </span>
            <Clock className="w-4 h-4 text-gray-500" />
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Teams &amp; Balances ({teams.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === 'transactions'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <ReceiptText className="w-4 h-4" />
          <span>Ledger Transactions ({transactions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cards')}
          className={`py-2.5 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition flex items-center gap-2 ${
            activeTab === 'cards'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <QrIcon className="w-4 h-4" />
          <span>Team Credentials &amp; QR Cards</span>
        </button>
      </div>

      {/* TAB 1: B. LIVE TEAM TABLE */}
      {activeTab === 'teams' && (
        <section className="space-y-4">
          {/* Controls Bar: Search + Filter + Sort */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-2xl bg-black/60 border border-gray-800">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setSearch('');
                  }
                }}
                placeholder="Search team number or name..."
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-800 focus:border-amber-500 rounded-xl text-xs text-gray-100 placeholder:text-gray-600 outline-none transition"
              />
            </div>

            {/* Filters & Sorting */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter Pills */}
              <div className="inline-flex rounded-xl bg-gray-900 p-1 border border-gray-800">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`py-1 px-3 rounded-lg text-xs font-semibold transition ${
                    statusFilter === 'all'
                      ? 'bg-amber-500/20 text-amber-300 font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  All ({teams.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('active')}
                  className={`py-1 px-3 rounded-lg text-xs font-semibold transition ${
                    statusFilter === 'active'
                      ? 'bg-emerald-900/60 text-emerald-300 font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Active ({activeTeamsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('eliminated')}
                  className={`py-1 px-3 rounded-lg text-xs font-semibold transition ${
                    statusFilter === 'eliminated'
                      ? 'bg-red-900/60 text-red-300 font-bold'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  Eliminated ({eliminatedTeamsCount})
                </button>
              </div>

              {/* Sort selector */}
              <div className="flex items-center gap-1.5 pl-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [newSort, newOrder] = e.target.value.split('-') as [
                      'number' | 'balance' | 'recent',
                      'asc' | 'desc'
                    ];
                    setSortBy(newSort);
                    setSortOrder(newOrder);
                  }}
                  className="py-1.5 px-2.5 bg-gray-900 border border-gray-800 focus:border-amber-500 rounded-xl text-xs text-gray-300 outline-none transition"
                >
                  <option value="number-asc">Sort: Team # (Ascending)</option>
                  <option value="number-desc">Sort: Team # (Descending)</option>
                  <option value="balance-desc">Sort: Balance (High &rarr; Low)</option>
                  <option value="balance-asc">Sort: Balance (Low &rarr; High)</option>
                  <option value="recent-desc">Sort: Recently Updated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Live Team Ledger Table */}
          <div className="rounded-2xl bg-gradient-to-b from-gray-900/90 to-black border border-gray-800/80 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-black/60 text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="py-3.5 px-4 w-16">#</th>
                    <th className="py-3.5 px-4">Team Name</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Soul Coins</th>
                    <th className="py-3.5 px-4">Last Transaction</th>
                    <th className="py-3.5 px-4 text-right">Ledger Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {processedTeams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 text-xs">
                        No teams match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    processedTeams.map((team) => {
                      const isEliminated = team.status === 'eliminated';
                      const lastTx = team.lastTransaction;

                      return (
                        <tr
                          key={team.id}
                          className={`transition ${
                            isEliminated
                              ? 'bg-black/40 opacity-70 hover:opacity-100 hover:bg-red-950/10'
                              : 'hover:bg-red-950/20'
                          }`}
                        >
                          {/* Team Number */}
                          <td className="py-3.5 px-4 font-mono font-bold">
                            <span
                              className={`px-2 py-1 rounded-lg text-xs border ${
                                isEliminated
                                  ? 'bg-gray-900 text-gray-500 border-gray-800'
                                  : 'bg-gray-800 text-amber-400 border-gray-700'
                              }`}
                            >
                              {team.teamNumber < 10 ? `0${team.teamNumber}` : team.teamNumber}
                            </span>
                          </td>

                          {/* Team Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-sm ${
                                  isEliminated ? 'text-gray-400 line-through' : 'text-gray-100'
                                }`}
                              >
                                {team.teamName}
                              </span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              disabled={statusChangingId === team.id}
                              onClick={() => handleStatusChange(team.id, isEliminated ? 'active' : 'eliminated')}
                              title="Click to toggle status"
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition border ${
                                statusChangingId === team.id
                                  ? 'opacity-50 cursor-not-allowed'
                                  : isEliminated
                                  ? 'bg-red-950/80 text-red-400 border-red-800/60 hover:bg-red-900/80'
                                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60 hover:bg-emerald-900/80'
                              }`}
                            >
                              {statusChangingId === team.id ? '...' : team.status}
                            </button>
                          </td>

                          {/* Soul Coins Balance (Large & Prominent) */}
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`font-mono font-black text-lg md:text-xl tracking-tight ${
                                isEliminated ? 'text-gray-500' : 'text-amber-400 drop-shadow'
                              }`}
                            >
                              {team.balance}
                            </span>
                          </td>

                          {/* Last Transaction */}
                          <td className="py-3.5 px-4 text-gray-400">
                            {lastTx ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-mono font-bold text-xs ${
                                    lastTx.direction === 'INCOMING' ? 'text-emerald-400' : 'text-red-400'
                                  }`}
                                >
                                  {lastTx.direction === 'INCOMING' ? '+' : '-'}{lastTx.amount}
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  {lastTx.badge}
                                </span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  {new Date(lastTx.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-600 italic text-[11px]">No activity</span>
                            )}
                          </td>

                          {/* Ledger Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Quick Adjust Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAdjust(team, 'GRANT');
                                }}
                                className="py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1 active:scale-95 shadow-sm"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Adjust</span>
                              </button>

                              {/* View History Button */}
                              <button
                                type="button"
                                onClick={() => setSelectedTeamForHistory(team)}
                                title="View Team Transaction History"
                                className="py-1.5 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-xs font-semibold transition flex items-center gap-1"
                              >
                                <History className="w-3.5 h-3.5 text-gray-400" />
                                <span>History</span>
                              </button>

                              {/* QR Credentials View */}
                              <button
                                type="button"
                                onClick={() => setSelectedTeamForQr(team)}
                                title="View Team Access QR Link"
                                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 border border-gray-700 transition"
                              >
                                <QrIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 2: LEDGER TRANSACTIONS AUDIT */}
      {activeTab === 'transactions' && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-b from-gray-900/90 to-black border border-gray-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 bg-black/40 text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">TX ID &amp; Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Source &rarr; Dest</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Badge</th>
                    <th className="py-3 px-4">Note</th>
                    <th className="py-3 px-4 text-right">Metadata Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-medium">
                  {transactions.map((tx) => {
                    const isGrant = tx.type === 'ORGANIZER_GRANT';
                    const isDeduct = tx.type === 'ORGANIZER_DEDUCT';
                    const isTransfer = tx.type === 'TRANSFER';

                    return (
                      <tr key={tx.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-4 font-mono text-gray-400">
                          <span className="font-bold text-gray-300 block">#{tx.id}</span>
                          <span className="text-[10px] text-gray-500">
                            {new Date(tx.created_at).toLocaleTimeString()}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                              isGrant
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                                : isDeduct
                                ? 'bg-red-950/60 text-red-400 border border-red-800/50'
                                : 'bg-blue-950/60 text-blue-400 border border-blue-800/50'
                            }`}
                          >
                            {isGrant && <ArrowDownLeft className="w-3 h-3" />}
                            {isDeduct && <ArrowUpRight className="w-3 h-3" />}
                            <span>{tx.type}</span>
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono">
                          {isGrant && (
                            <span className="text-emerald-300 font-semibold">
                              Mephisto &rarr; Team {tx.destination_team_number}
                            </span>
                          )}
                          {isDeduct && (
                            <span className="text-red-300 font-semibold">
                              Team {tx.source_team_number} &rarr; Mephisto
                            </span>
                          )}
                          {isTransfer && (
                            <span className="text-gray-200">
                              Team {tx.source_team_number} &rarr; Team {tx.destination_team_number}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-amber-400">
                          {tx.amount}
                        </td>

                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                            <Tag className="w-2.5 h-2.5" />
                            {tx.badge}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-gray-400 italic max-w-xs truncate">
                          {tx.note || <span className="text-gray-600 font-sans not-italic">&mdash;</span>}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedTxForEdit(tx)}
                            className="py-1 px-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 text-[11px] font-semibold transition inline-flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Badge</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: TEAM CREDENTIALS & QR CARDS */}
      {activeTab === 'cards' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400 leading-relaxed">
              Print or preview team credential cards before the event. Initial team PINs are sealed in <code className="text-amber-400">team_credentials.json</code> for physical distribution.
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="py-2 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 transition flex items-center gap-2 shrink-0"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print All Cards</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {teams.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl bg-black/60 border border-gray-800 hover:border-amber-500/40 transition flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Team #{t.teamNumber < 10 ? `0${t.teamNumber}` : t.teamNumber}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {t.balance} Coins
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-gray-100 text-sm truncate">{t.teamName}</h4>
                  <div className="mt-2 p-2 rounded-lg bg-gray-900 border border-gray-800 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-semibold">PIN Protection:</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-semibold">BCrypt Hashed</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTeamForQr(t)}
                  className="w-full py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-200 border border-gray-700 transition flex items-center justify-center gap-1.5"
                >
                  <QrIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>View QR Code</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL 1: Adjustment Modal */}
      {isAdjustModalOpen && (
        <AdjustmentModal
          key={selectedTeamForAdjust ? `adjust-team-${selectedTeamForAdjust.id}` : 'adjust-general'}
          team={selectedTeamForAdjust}
          allTeams={teams}
          isOpen={isAdjustModalOpen}
          initialMode={adjustInitialMode}
          onClose={() => {
            setIsAdjustModalOpen(false);
            setSelectedTeamForAdjust(null);
          }}
          onSuccess={() => {
            showFeedback('Adjustment successfully recorded and synchronized.');
            refreshAll();
          }}
        />
      )}

      {/* MODAL 2: Team History / Detail Modal */}
      <TeamHistoryModal
        team={selectedTeamForHistory}
        isOpen={!!selectedTeamForHistory}
        onClose={() => setSelectedTeamForHistory(null)}
        onOpenAdjust={(targetTeam) => {
          setSelectedTeamForHistory(null);
          openAdjust(targetTeam, 'GRANT');
        }}
        onEditTransaction={(tx) => {
          setSelectedTxForEdit(tx);
        }}
        onStatusChange={async (teamId, newStatus) => {
          await handleStatusChange(teamId, newStatus);
        }}
      />

      {/* MODAL 3: Edit Badge / Note Modal */}
      <EditBadgeModal
        transaction={selectedTxForEdit}
        isOpen={!!selectedTxForEdit}
        onClose={() => setSelectedTxForEdit(null)}
        onSuccess={() => {
          showFeedback('Transaction badge/note metadata updated.');
          refreshAll();
        }}
      />

      {/* MODAL 4: Team QR Code Modal */}
      <TeamQrModal
        team={selectedTeamForQr}
        isOpen={!!selectedTeamForQr}
        onClose={() => setSelectedTeamForQr(null)}
      />
    </main>
  );
}
