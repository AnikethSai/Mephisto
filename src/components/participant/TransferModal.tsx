'use client';

import { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, AlertCircle, CheckCircle2, Loader2, Coins } from 'lucide-react';

interface Props {
  currentBalance: number;
  currentTeamNumber: number;
  isEliminated?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({
  currentBalance,
  currentTeamNumber,
  isEliminated = false,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const [recipientTeam, setRecipientTeam] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recipientInputRef = useRef<HTMLInputElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Autofocus recipient input on Step 1 open
  useEffect(() => {
    if (isOpen && !confirmStep) {
      const timer = setTimeout(() => {
        recipientInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confirmStep]);

  // Autofocus confirm button on Step 2 (review step)
  useEffect(() => {
    if (isOpen && confirmStep) {
      const timer = setTimeout(() => {
        confirmBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, confirmStep]);

  const handleClose = () => {
    setRecipientTeam('');
    setAmount('');
    setNote('');
    setConfirmStep(false);
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  // Safe Escape key handler: Step 2 cancels back to Step 1; Step 1 closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        if (confirmStep) {
          setConfirmStep(false);
          setError(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmStep, loading]);

  // Enter key listener on Confirmation step (Step 2) to trigger confirm
  useEffect(() => {
    if (!isOpen || !confirmStep) return;
    const handleConfirmKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading && !isEliminated) {
        e.preventDefault();
        handleExecuteTransfer();
      }
    };
    window.addEventListener('keydown', handleConfirmKeyDown);
    return () => window.removeEventListener('keydown', handleConfirmKeyDown);
  });

  if (!isOpen || isEliminated) return null;

  const parsedAmount = parseInt(amount, 10);
  const parsedRecipient = parseInt(recipientTeam, 10);

  const handleInitialValidate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEliminated) {
      setError('Your team is eliminated and cannot transfer Soul Coins.');
      return;
    }

    if (isNaN(parsedRecipient) || parsedRecipient <= 0) {
      setError('Please enter a valid recipient team number');
      return;
    }

    if (parsedRecipient === currentTeamNumber) {
      setError('You cannot transfer Soul Coins to your own team');
      return;
    }

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Transfer amount must be at least 1 Soul Coin');
      return;
    }

    if (parsedAmount > currentBalance) {
      setError(`Insufficient Soul Coins. Maximum available: ${currentBalance}`);
      return;
    }

    setConfirmStep(true);
  };

  const handleExecuteTransfer = async () => {
    if (isEliminated || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/participant/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientTeamNumber: parsedRecipient,
          amount: parsedAmount,
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Transfer failed');
        setLoading(false);
        // Retain confirmStep to show the error banner without losing context
        return;
      }

      setSuccessMessage(
        `Successfully transferred ${parsedAmount} Soul Coins to Team ${data.data.recipientTeamNumber} (${data.data.recipientTeamName})`
      );
      setLoading(false);
      onSuccess();

      // Reset and close after a brief delay
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch {
      setError('Network error during transfer. Please check connection.');
      setLoading(false);
      // Retain confirmStep to show the error banner without losing context
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          handleClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-gray-900 to-[#0e070a] border border-red-900/60 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-gray-100 tracking-wide text-base">Transfer Soul Coins</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success notification */}
        {successMessage ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
            <p className="text-sm font-semibold text-emerald-300">{successMessage}</p>
          </div>
        ) : !confirmStep ? (
          /* Step 1: Input Details */
          <form onSubmit={handleInitialValidate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Recipient Team Number
              </label>
              <input
                ref={recipientInputRef}
                type="number"
                min={1}
                max={99}
                required
                value={recipientTeam}
                onChange={(e) => setRecipientTeam(e.target.value)}
                placeholder="e.g. 14"
                className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 placeholder:text-gray-600 outline-none text-sm transition"
              />
              <span className="text-[11px] text-gray-500 mt-1 block">
                Enter the numerical team ID of the recipient
              </span>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Amount
                </label>
                <span className="text-xs text-amber-400/80 font-medium">
                  Available: {currentBalance}
                </span>
              </div>
              <input
                type="number"
                min={1}
                max={currentBalance}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Number of Soul Coins"
                className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-amber-300 font-mono placeholder:text-gray-600 outline-none text-sm transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                Note / Memo (Optional)
              </label>
              <input
                type="text"
                maxLength={100}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Pact settlement / Alliance share"
                className="w-full px-4 py-2.5 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 placeholder:text-gray-600 outline-none text-sm transition"
              />
            </div>

            <button
              type="submit"
              disabled={!recipientTeam || !amount || parsedAmount <= 0 || parsedAmount > currentBalance}
              className="w-full py-3 bg-red-900/80 hover:bg-red-800 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
              <span>Review Transfer</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Step 2: Confirmation */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 space-y-2 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                Transfer Confirmation
              </span>
              <div className="text-2xl font-black text-amber-300">
                {parsedAmount} Soul Coins
              </div>
              <div className="text-xs text-gray-300">
                Sending to: <span className="font-bold text-white">Team {parsedRecipient}</span>
              </div>
              {note && (
                <div className="text-xs italic text-gray-400 border-t border-red-900/40 pt-2">
                  &ldquo;{note}&rdquo;
                </div>
              )}
            </div>

            <p className="text-xs text-amber-500/90 text-center font-medium">
              This transfer is atomic and permanent. Are you sure you wish to proceed?
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
                onClick={handleExecuteTransfer}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-red-700 via-amber-600 to-red-700 hover:from-red-600 hover:via-amber-500 hover:to-red-600 text-white font-bold rounded-xl text-xs tracking-wider uppercase shadow-lg transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Confirm Transfer</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
