'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Plus, Minus, Check, Loader2, AlertCircle, ArrowRight, ShieldAlert } from 'lucide-react';
import { ROUND_BADGES, OrganizerTeamSummary } from '@/lib/types';

interface Props {
  team: OrganizerTeamSummary | null;
  allTeams?: OrganizerTeamSummary[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'GRANT' | 'REVOKE';
}

export function AdjustmentModal({
  team,
  allTeams,
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'GRANT',
}: Props) {
  const initialTeamId = team?.id || (allTeams && allTeams.length > 0 ? allTeams[0].id : 0);
  const [selectedTeamId, setSelectedTeamId] = useState<number>(initialTeamId);
  const [mode, setMode] = useState<'GRANT' | 'REVOKE'>(initialMode);
  const [amount, setAmount] = useState<string>('10');
  const [badge, setBadge] = useState<string>('General / Adjustment');
  const [customBadge, setCustomBadge] = useState<string>('');
  const [isCustomBadge, setIsCustomBadge] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [confirmStep, setConfirmStep] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const prevIsOpenRef = useRef(isOpen);
  const prevTeamIdRef = useRef<number | null>(team?.id ?? null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Sync ONLY on modal open transition or explicit team change — NEVER on allTeams polling
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!wasOpen && isOpen) {
      const targetId = team?.id || (allTeams && allTeams.length > 0 ? allTeams[0].id : 0);
      setSelectedTeamId(targetId);
      prevTeamIdRef.current = targetId;
      setMode(initialMode);
      setAmount('10');
      setBadge('General / Adjustment');
      setIsCustomBadge(false);
      setCustomBadge('');
      setNote('');
      setConfirmStep(false);
      setError(null);
      setLoading(false);
    } else if (isOpen && team && team.id !== prevTeamIdRef.current) {
      setSelectedTeamId(team.id);
      prevTeamIdRef.current = team.id;
      setConfirmStep(false);
      setError(null);
    }
  }, [isOpen, team?.id, initialMode]);

  // Focus amount input when Step 1 is active
  useEffect(() => {
    if (isOpen && !confirmStep) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confirmStep]);

  // Focus Confirm button when Step 2 is active
  useEffect(() => {
    if (isOpen && confirmStep) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confirmStep]);

  // Escape key listener: on confirm step cancels back to form; on form step closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        if (confirmStep) {
          setConfirmStep(false);
          setError(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmStep, loading, onClose]);

  if (!isOpen) return null;

  // Resolve active team: prioritize live data from allTeams, fallback to team prop, fallback to first team in allTeams
  const currentTeamId = team?.id || selectedTeamId || (allTeams && allTeams.length > 0 ? allTeams[0].id : 0);
  const activeTeam =
    (allTeams && allTeams.find((t) => t.id === currentTeamId)) ||
    team ||
    (allTeams && allTeams.length > 0 ? allTeams[0] : null);

  if (!activeTeam) {
    return null;
  }

  const parsedAmount = parseInt(amount, 10);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const isRevoke = mode === 'REVOKE';
  const delta = validAmount ? (isRevoke ? -parsedAmount : parsedAmount) : 0;
  const newBalance = activeTeam.balance + delta;
  const wouldBeNegative = isRevoke && validAmount && newBalance < 0;

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validAmount) {
      setError('Please specify a positive whole integer amount of Soul Coins.');
      return;
    }

    if (wouldBeNegative) {
      setError(
        `Cannot revoke ${parsedAmount} coins. Team ${activeTeam.teamNumber} only has ${activeTeam.balance} coins. Resulting balance cannot fall below 0.`
      );
      return;
    }

    setConfirmStep(true);
  };

  const handleExecuteAdjustment = async () => {
    if (!validAmount || wouldBeNegative || loading) return;

    setLoading(true);
    setError(null);

    const selectedBadge = isCustomBadge ? customBadge.trim() || 'General / Adjustment' : badge;

    try {
      const res = await fetch('/api/organizer/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: activeTeam.id,
          amountDelta: delta,
          badge: selectedBadge,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Adjustment failed');
        setLoading(false);
        // Do NOT reset confirmStep — stay on review screen to show error
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError('Network communication failure. Please retry.');
      setLoading(false);
      // Do NOT reset confirmStep — stay on review screen to show error
    }
  };

  // Enter key listener on Confirmation step (Step 2) to trigger confirm
  useEffect(() => {
    if (!isOpen || !confirmStep) return;
    const handleConfirmKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading && validAmount && !wouldBeNegative) {
        e.preventDefault();
        handleExecuteAdjustment();
      }
    };
    window.addEventListener('keydown', handleConfirmKeyDown);
    return () => window.removeEventListener('keydown', handleConfirmKeyDown);
  });

  const quickAmounts = [1, 5, 10, 15, 20, 50, 100];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-gradient-to-b from-gray-900 to-[#12080c] border border-red-900/60 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
              Live Event Ledger Control
            </span>
            <h3 className="text-lg font-bold text-gray-100">
              Adjust Soul Coins &bull; Team {activeTeam.teamNumber < 10 ? `0${activeTeam.teamNumber}` : activeTeam.teamNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Validation or API Error Banner */}
        {error && (
          <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Calculation Preview Banner */}
        <div className="p-4 rounded-xl bg-black/70 border border-gray-800 flex items-center justify-between">
          <div className="text-center">
            <span className="text-[10px] uppercase text-gray-400 font-bold block tracking-wider">Current Balance</span>
            <span className="text-2xl font-mono font-black text-gray-300">{activeTeam.balance}</span>
          </div>

          <div className="text-center px-4">
            <span
              className={`text-lg font-mono font-bold ${
                isRevoke ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {isRevoke ? '-' : '+'}{validAmount ? parsedAmount : 0}
            </span>
            <span className="text-[10px] text-gray-500 block">&rarr;</span>
          </div>

          <div className="text-center">
            <span className="text-[10px] uppercase text-amber-400 font-bold block tracking-wider">New Balance</span>
            <span
              className={`text-2xl font-mono font-black tracking-tight ${
                wouldBeNegative ? 'text-red-500 underline decoration-wavy' : 'text-amber-400 drop-shadow'
              }`}
            >
              {wouldBeNegative ? 'Negative!' : newBalance}
            </span>
          </div>
        </div>

        {wouldBeNegative && (
          <div className="p-2.5 rounded-lg bg-red-950/80 border border-red-700/60 text-xs text-red-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>Zero-Floor Rule:</strong> Soul Coin balance cannot drop below 0. Maximum revokable is {activeTeam.balance}.
            </span>
          </div>
        )}

        {!confirmStep ? (
          /* STEP 1: FORM INPUT */
          <form onSubmit={handleReview} className="space-y-4">
            {/* Team Selector if multiple teams available and no fixed team */}
            {!team && allTeams && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Select Team
                </label>
                <select
                  value={selectedTeamId}
                  onChange={(e) => {
                    setSelectedTeamId(Number(e.target.value));
                    setError(null);
                  }}
                  className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-200 text-sm outline-none transition"
                >
                  {allTeams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-gray-900 text-gray-200">
                      Team {t.teamNumber < 10 ? `0${t.teamNumber}` : t.teamNumber} &mdash; {t.teamName} (Current: {t.balance} Coins)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Grant (+) vs Revoke (-) Toggle */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Adjustment Direction
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-black/60 border border-gray-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMode('GRANT');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    mode === 'GRANT'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  <span>Grant Coins (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('REVOKE');
                    setError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    mode === 'REVOKE'
                      ? 'bg-red-700 text-white shadow-lg shadow-red-950/50'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Minus className="w-4 h-4" />
                  <span>Revoke Coins (-)</span>
                </button>
              </div>
            </div>

            {/* Amount input & Quick Chips */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Amount (Soul Coins)
                </label>
                <span className="text-[11px] text-gray-500 font-mono">
                  {isRevoke ? `Max Revokable: ${activeTeam.balance}` : 'Any whole integer'}
                </span>
              </div>
              <input
                ref={amountInputRef}
                type="number"
                min={1}
                max={isRevoke ? activeTeam.balance : undefined}
                required
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 15"
                className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 font-mono text-base outline-none transition"
              />
              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickAmounts.map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => {
                      setAmount(String(q));
                      setError(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-gray-800/80 hover:bg-gray-700 text-xs font-mono text-gray-300 border border-gray-700 transition"
                  >
                    {mode === 'GRANT' ? '+' : '-'}{q}
                  </button>
                ))}
                {isRevoke && activeTeam.balance > 0 && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(activeTeam.balance))}
                    className="px-2.5 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 text-xs font-mono text-red-300 border border-red-800/60 transition"
                  >
                    All ({activeTeam.balance})
                  </button>
                )}
              </div>
            </div>

            {/* Badge Selector */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Transaction Badge (Metadata)
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomBadge(!isCustomBadge)}
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  {isCustomBadge ? 'Select Standard' : '+ Custom Badge'}
                </button>
              </div>

              {isCustomBadge ? (
                <input
                  type="text"
                  value={customBadge}
                  onChange={(e) => setCustomBadge(e.target.value)}
                  placeholder="Enter custom badge name..."
                  className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 text-sm outline-none transition"
                />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {ROUND_BADGES.map((b) => (
                    <button
                      type="button"
                      key={b}
                      onClick={() => setBadge(b)}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold truncate border transition ${
                        badge === b
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm'
                          : 'bg-black/40 text-gray-400 border-gray-800 hover:text-gray-200'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Note / Reason */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Optional Organizer Note / Reason
              </label>
              <input
                type="text"
                maxLength={150}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Clue purchase / Penalty / Round bonus"
                className="w-full px-4 py-2 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 text-sm outline-none transition"
              />
            </div>

            {/* Review Button */}
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!validAmount || wouldBeNegative}
                className="flex-1 py-3 bg-gradient-to-r from-red-800 via-amber-600 to-red-800 hover:from-red-700 hover:via-amber-500 hover:to-red-700 text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Review Adjustment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          /* STEP 2: EXPLICIT CONFIRMATION */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/80 border border-red-900/60 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs uppercase font-bold text-gray-400">Target Team</span>
                <span className="text-sm font-bold text-gray-100">
                  Team {activeTeam.teamNumber < 10 ? `0${activeTeam.teamNumber}` : activeTeam.teamNumber} ({activeTeam.teamName})
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs uppercase font-bold text-gray-400">Current Balance</span>
                <span className="font-mono text-base font-bold text-gray-300">{activeTeam.balance}</span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs uppercase font-bold text-gray-400">
                  {mode === 'GRANT' ? 'Grant (+)' : 'Revoke (-)'}
                </span>
                <span
                  className={`font-mono text-base font-black ${
                    mode === 'GRANT' ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {mode === 'GRANT' ? '+' : '-'}{parsedAmount}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="text-xs uppercase font-bold text-amber-400">Resulting Balance</span>
                <span className="font-mono text-2xl font-black text-amber-400 drop-shadow">
                  {newBalance}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-400 font-semibold">Badge:</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-semibold">
                  {isCustomBadge ? customBadge || 'General / Adjustment' : badge}
                </span>
              </div>

              {note && (
                <div className="text-xs text-gray-400 italic pt-1 border-t border-gray-900">
                  &ldquo;{note}&rdquo;
                </div>
              )}
            </div>

            <p className="text-xs text-amber-300/80 text-center font-medium">
              Confirming will immediately write an immutable ledger record and sync live across all connected displays.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmStep(false)}
                disabled={loading}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl text-xs transition"
              >
                Back
              </button>
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleExecuteAdjustment}
                disabled={loading}
                className={`flex-1 py-3 font-bold rounded-xl text-xs tracking-wider uppercase shadow-lg transition flex items-center justify-center gap-2 ${
                  mode === 'GRANT'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-red-700 hover:bg-red-600 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Committing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm Adjustment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
