import { Coins, Flame, Skull, Ban, ShieldAlert } from 'lucide-react';

interface Props {
  teamNumber: number;
  teamName: string;
  balance: number;
  status?: string;
  onOpenTransfer: () => void;
}

export function BalanceCard({ teamNumber, teamName, balance, status = 'active', onOpenTransfer }: Props) {
  const isEliminated = status === 'eliminated';

  return (
    <div
      className={`relative rounded-3xl bg-gradient-to-b from-gray-900 via-[#140b0f] to-[#0c0608] border ${
        isEliminated ? 'border-red-800/80' : 'border-red-950/80'
      } p-6 md:p-8 shadow-2xl overflow-hidden`}
    >
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-600/10 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-red-600/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        {/* Header Title & Status */}
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-red-400/80">
            Mephisto&apos;s Bargain
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-800/40 text-xs font-semibold text-amber-300">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>TEAM {teamNumber < 10 ? `0${teamNumber}` : teamNumber}</span>
            </div>

            {isEliminated ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950 border border-red-600/80 text-xs font-black uppercase tracking-wider text-red-400 shadow-lg shadow-red-950/80 animate-pulse">
                <Skull className="w-3.5 h-3.5 text-red-500" />
                <span>ELIMINATED</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>ACTIVE</span>
              </div>
            )}
          </div>
          <h2 className="text-xl font-bold text-gray-200 tracking-wide">{teamName}</h2>
        </div>

        {/* Informative Elimination Banner */}
        {isEliminated && (
          <div className="w-full p-4 rounded-2xl bg-red-950/70 border border-red-800/80 text-left flex items-start gap-3 shadow-inner">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-red-200 uppercase tracking-wide">
                Team Status: Eliminated
              </p>
              <p className="text-[11px] text-red-300/80 leading-relaxed">
                Your team has been marked as eliminated from active competition. Soul Coin transfers are disabled. Your current balance and transaction history remain fully preserved in the ledger.
              </p>
            </div>
          </div>
        )}

        {/* Soul Coins Display */}
        <div className="w-full py-6 px-4 rounded-2xl bg-black/50 border border-amber-950/40 flex flex-col items-center justify-center space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-amber-500/80">
            Soul Coins
          </span>
          <div className="flex items-center justify-center gap-3">
            <Coins className="w-8 h-8 text-amber-400 animate-pulse shrink-0" />
            <span className="text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600 drop-shadow-md">
              {balance.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Action Button */}
        {isEliminated ? (
          <button
            type="button"
            disabled={true}
            className="w-full py-4 px-6 rounded-xl bg-gray-900 border border-red-900/40 text-gray-500 font-bold text-xs tracking-wider uppercase cursor-not-allowed opacity-60 flex items-center justify-center gap-2 select-none shadow-none"
            title="Transfers disabled — team is eliminated"
          >
            <Ban className="w-4 h-4 text-red-500/80" />
            <span>Transfers Disabled &bull; Team Eliminated</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenTransfer}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-red-800 via-amber-600 to-red-800 hover:from-red-700 hover:via-amber-500 hover:to-red-700 text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-red-950/50 hover:shadow-amber-900/30 transition active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <Coins className="w-4 h-4 text-amber-300" />
            <span>Transfer Soul Coins</span>
          </button>
        )}
      </div>
    </div>
  );
}
