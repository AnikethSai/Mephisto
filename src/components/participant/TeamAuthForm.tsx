'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  accessKey: string;
  teamNumber: number;
  teamName: string;
}

export function TeamAuthForm({ accessKey, teamNumber, teamName }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!pin.trim()) {
      setError('Please enter your team PIN');
      pinInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey, pin: pin.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Incorrect PIN');
        setLoading(false);
        setTimeout(() => {
          pinInputRef.current?.focus();
          pinInputRef.current?.select();
        }, 20);
        return;
      }

      // Success: redirect to participant dashboard
      router.push('/participant');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 20);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <div className="text-center space-y-1">
        <span className="px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Team #{teamNumber}
        </span>
        <h2 className="text-2xl font-bold text-gray-100 tracking-wide mt-2">{teamName}</h2>
        <p className="text-xs text-gray-400">Enter your confidential team PIN to access your vault</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
            <KeyRound className="w-5 h-5 text-amber-500/70" />
          </div>
          <input
            ref={pinInputRef}
            type="password"
            inputMode="numeric"
            maxLength={8}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter Team PIN"
            className="w-full pl-11 pr-4 py-3 bg-black/60 border border-gray-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-center tracking-[0.4em] font-mono text-xl text-amber-300 rounded-xl outline-none placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-gray-600 transition"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !pin}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-red-800 via-amber-600 to-red-800 hover:from-red-700 hover:via-amber-500 hover:to-red-700 text-white font-semibold rounded-xl text-sm tracking-wide shadow-lg shadow-amber-950/40 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verifying PIN...</span>
            </>
          ) : (
            <>
              <span>Enter Mephisto&apos;s Domain</span>
              <ArrowRight className="w-4 h-4 text-amber-200" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
