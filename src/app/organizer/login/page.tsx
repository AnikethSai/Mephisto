'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function OrganizerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!password.trim()) {
      setError('Password is required');
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Authentication failed');
        setLoading(false);
        setTimeout(() => {
          passwordInputRef.current?.focus();
          passwordInputRef.current?.select();
        }, 20);
        return;
      }

      router.push('/organizer');
      router.refresh();
    } catch {
      setError('Network communication failed');
      setLoading(false);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 20);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-950/20 blur-3xl rounded-full pointer-events-none" />

      <div className="max-w-sm w-full relative z-10 p-8 rounded-2xl bg-gradient-to-b from-gray-900 to-black border border-red-900/60 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-full bg-red-950/60 border border-red-800/40 text-red-400">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-gray-100 uppercase">
            Organizer Console
          </h1>
          <p className="text-xs text-gray-400">
            Mephisto&apos;s Bargain &bull; Central Control
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Organizer Master Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <KeyRound className="w-4 h-4 text-red-400/80" />
              </div>
              <input
                ref={passwordInputRef}
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-2.5 bg-black/60 border border-gray-700 focus:border-red-500 rounded-xl text-gray-100 text-sm outline-none transition"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-950/70 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-red-900 hover:bg-red-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Access Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-300 transition">
            &larr; Back to Portal
          </Link>
        </div>
      </div>
    </main>
  );
}
