import { ArrowDownLeft, ArrowUpRight, History, ShieldAlert, Tag } from 'lucide-react';

interface ParticipantTransactionItem {
  id: number;
  type: 'ORGANIZER_GRANT' | 'ORGANIZER_DEDUCT' | 'TRANSFER';
  direction: 'INCOMING' | 'OUTGOING';
  amount: number;
  badge: string;
  note: string | null;
  createdAt: string;
  counterparty: {
    teamNumber: number | null;
    teamName: string | null;
  } | null;
}

interface Props {
  transactions: ParticipantTransactionItem[];
  loading: boolean;
}

export function TransactionList({ transactions, loading }: Props) {
  if (loading && transactions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-xs tracking-wider uppercase animate-pulse">
        Fetching ledger entries...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl bg-black/40 border border-gray-800/60 space-y-2">
        <History className="w-8 h-8 text-gray-600 mx-auto" />
        <p className="text-xs text-gray-400 font-medium">No recorded transactions yet</p>
        <p className="text-[11px] text-gray-600">Soul Coin grants and transfers will appear here in real-time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-amber-500" />
          <span>Ledger History</span>
        </h3>
        <span className="text-[10px] text-gray-500 font-mono">
          {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="space-y-2">
        {transactions.map((tx) => {
          const isIncoming = tx.direction === 'INCOMING';

          let description = '';
          if (tx.type === 'ORGANIZER_GRANT') {
            description = 'Granted by Mephisto (Organizer)';
          } else if (tx.type === 'ORGANIZER_DEDUCT') {
            description = 'Revoked by Mephisto (Organizer)';
          } else if (tx.type === 'TRANSFER') {
            if (isIncoming) {
              description = `Received from Team ${tx.counterparty?.teamNumber ?? '?'}`;
            } else {
              description = `Transferred to Team ${tx.counterparty?.teamNumber ?? '?'}`;
            }
          }

          return (
            <div
              key={tx.id}
              className="p-3.5 rounded-xl bg-gradient-to-r from-gray-900/90 to-black/90 border border-gray-800/80 hover:border-gray-700/80 transition flex items-center justify-between gap-3 shadow-md"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    isIncoming
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                      : 'bg-red-950/60 text-red-400 border border-red-800/40'
                  }`}
                >
                  {isIncoming ? (
                    <ArrowDownLeft className="w-4 h-4 shrink-0" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 shrink-0" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-200">{description}</span>
                    {tx.badge && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Tag className="w-2.5 h-2.5" />
                        {tx.badge}
                      </span>
                    )}
                  </div>

                  {tx.note && (
                    <p className="text-[11px] text-gray-400 italic">
                      &ldquo;{tx.note}&rdquo;
                    </p>
                  )}

                  <span className="text-[10px] text-gray-500 font-mono block">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} &bull; {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div
                className={`text-right shrink-0 font-bold font-mono text-sm md:text-base ${
                  isIncoming ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isIncoming ? '+' : '-'}{tx.amount}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
