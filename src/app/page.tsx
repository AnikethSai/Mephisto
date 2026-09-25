import Link from 'next/link';
import { Flame, Shield, QrCode } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle infernal backdrop lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-950/30 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-amber-950/20 blur-3xl rounded-full pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-8 text-center">
        {/* Emblem */}
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-red-950/60 to-black/80 border border-red-800/40 shadow-2xl">
          <Flame className="w-12 h-12 text-amber-500 animate-pulse" />
        </div>

        {/* Headings */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-amber-400 to-red-500 uppercase">
            Mephisto&apos;s Bargain
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-red-300/70 font-semibold">
            Soul Coin Management System
          </p>
        </div>

        {/* Security & Access Info Card */}
        <div className="p-5 rounded-xl bg-gradient-to-b from-gray-900/90 to-black/90 border border-gray-800 text-left space-y-4 shadow-xl">
          <div className="flex items-start gap-3">
            <QrCode className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Participant Access</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Scan your physical Team QR Code card and enter your confidential 4-digit PIN to access your team&apos;s Soul Coin balance and transfer portal.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-800/80 pt-3 flex items-start gap-3">
            <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-gray-200">Private Event Arena</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                There is no public leaderboard. Team balances and transaction histories are strictly confidential to each team and game organizers.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <Link
            href="/organizer/login"
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-200 border border-red-700/50 hover:border-red-600 transition font-medium text-sm tracking-wide shadow-lg"
          >
            <Shield className="w-4 h-4 text-red-400" />
            Organizer Command Portal
          </Link>
        </div>

        <p className="text-[10px] text-gray-600 uppercase tracking-widest">
          Live Fest Edition &bull; High Integrity Ledger
        </p>
      </div>
    </main>
  );
}
