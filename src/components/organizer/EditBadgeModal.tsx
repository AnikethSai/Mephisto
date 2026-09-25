'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Tag, Check, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';
import { ROUND_BADGES, Transaction } from '@/lib/types';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditBadgeModal({ transaction, isOpen, onClose, onSuccess }: Props) {
  const [badge, setBadge] = useState<string>('General / Adjustment');
  const [customBadge, setCustomBadge] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (transaction) {
      if ((ROUND_BADGES as readonly string[]).includes(transaction.badge)) {
        setBadge(transaction.badge);
        setIsCustom(false);
      } else {
        setIsCustom(true);
        setCustomBadge(transaction.badge);
      }
      setNote(transaction.note || '');
      setError(null);
    }
  }, [transaction]);

  // Focus note input on open
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        noteInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape key listener for modal dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    const finalBadge = isCustom ? customBadge.trim() || 'General / Adjustment' : badge;

    try {
      const res = await fetch(`/api/organizer/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          badge: finalBadge,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to update transaction badge');
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError('Network communication error');
      setLoading(false);
    }
  };

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
        className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-gray-900 to-[#12080c] border border-amber-900/60 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-gray-100 text-base">
              Edit Transaction Badge / Metadata
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

        {error && (
          <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Accounting Integrity Guarantee Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Accounting Protection:</strong> Changing the badge or note is purely organizational and will <span className="underline">never</span> modify or alter coin balances.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Round / Event Badge
              </label>
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-[11px] text-amber-400 hover:underline"
              >
                {isCustom ? 'Standard Badges' : '+ Custom Badge'}
              </button>
            </div>

            {isCustom ? (
              <input
                type="text"
                value={customBadge}
                onChange={(e) => setCustomBadge(e.target.value)}
                placeholder="Enter custom badge..."
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

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Note / Reason
            </label>
            <input
              ref={noteInputRef}
              type="text"
              maxLength={150}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Audit note / reason..."
              className="w-full px-4 py-2 bg-black/60 border border-gray-700 focus:border-amber-500 rounded-xl text-gray-100 text-sm outline-none transition"
            />
          </div>

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
              disabled={loading}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl text-xs tracking-wider uppercase transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Badge</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
