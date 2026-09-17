'use client';

import { useStore } from '@/lib/store';

export default function TradeHistory() {
  const { bot } = useStore();
  const trades = bot.trades;

  const totalPnl = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const wins = trades.filter((t) => (t.profitLoss || 0) > 0).length;
  const winRate = trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold gradient-text">Trade History</h2>
        <div className="flex gap-3 text-xs">
          <span className="text-brand-muted">Total: <span className="text-white font-semibold">{trades.length}</span></span>
          <span className="text-brand-muted">Win: <span className="text-emerald-400 font-semibold">{winRate}%</span></span>
          <span className="text-brand-muted">P&L: <span className={`font-semibold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}</span></span>
        </div>
      </div>

      {trades.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-emerald/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-brand-muted text-sm">No trades yet. Trades will appear here once executed.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {trades.slice().reverse().map((trade) => (
              <div key={trade.id} className="glass-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    trade.direction === 'BUY'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                      : 'bg-red-500/15 text-red-400 border border-red-500/25'
                  }`}>
                    {trade.direction}
                  </span>
                  <span className={`text-xs font-bold ${(trade.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {(trade.profitLoss || 0) >= 0 ? '+' : ''}${(trade.profitLoss || 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-brand-muted">
                  <span>{trade.symbol}</span>
                  <span>${trade.stake.toFixed(2)}</span>
                  <span>{trade.openTime ? new Date(trade.openTime).toLocaleTimeString() : '--:--'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">Time</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">Market</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">Direction</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">Stake</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">P&L</th>
                    <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-brand-muted font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {trades.slice().reverse().map((trade) => (
                    <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5 text-brand-muted text-xs">{trade.openTime ? new Date(trade.openTime).toLocaleTimeString() : '--:--'}</td>
                      <td className="px-4 py-2.5 font-medium text-white text-xs">{trade.symbol}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          trade.direction === 'BUY'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 border border-red-500/25'
                        }`}>
                          {trade.direction}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-brand-text text-xs">${trade.stake.toFixed(2)}</td>
                      <td className={`px-4 py-2.5 font-semibold text-xs ${(trade.profitLoss || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(trade.profitLoss || 0) >= 0 ? '+' : ''}${(trade.profitLoss || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          trade.status === 'closed' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                        }`}>
                          {trade.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
