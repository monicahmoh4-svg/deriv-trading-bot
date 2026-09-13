'use client';

import { useStore } from '@/lib/store';

export default function TradeHistory() {
  const { bot } = useStore();

  const totalPnl = bot.trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
  const closedTrades = bot.trades.filter((t) => t.status === 'closed');
  const winTrades = closedTrades.filter((t) => (t.profitLoss || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-deriv-text">Trade History</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <div className="text-sm text-deriv-muted">Total Trades</div>
          <div className="text-2xl font-bold text-deriv-text">{bot.trades.length}</div>
        </div>
        <div className="glass-card p-4">
          <div className="text-sm text-deriv-muted">Total P&L</div>
          <div
            className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-deriv-green' : 'text-deriv-red'}`}
          >
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-sm text-deriv-muted">Win Rate</div>
          <div className="text-2xl font-bold text-deriv-cyan">{winRate.toFixed(1)}%</div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-deriv-border">
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Trade ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Market
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Stake
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Entry
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Exit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  P&L
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-deriv-muted uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {bot.trades.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-deriv-muted">
                    No trades yet
                  </td>
                </tr>
              ) : (
                bot.trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-deriv-border/50 hover:bg-deriv-border/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-deriv-muted">
                      {trade.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-deriv-text">{trade.symbol}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm font-medium ${
                          trade.direction === 'BUY' ? 'text-deriv-green' : 'text-deriv-red'
                        }`}
                      >
                        {trade.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-deriv-text">${trade.stake.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-mono text-deriv-text">
                      {trade.entryPrice.toFixed(5)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-deriv-text">
                      {trade.exitPrice ? trade.exitPrice.toFixed(5) : '---'}
                    </td>
                    <td className="px-4 py-3">
                      {trade.profitLoss !== undefined ? (
                        <span
                          className={`text-sm font-medium ${
                            trade.profitLoss >= 0 ? 'text-deriv-green' : 'text-deriv-red'
                          }`}
                        >
                          {trade.profitLoss >= 0 ? '+' : ''}${trade.profitLoss.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-sm text-deriv-muted">---</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          trade.status === 'open'
                            ? 'bg-deriv-cyan/20 text-deriv-cyan'
                            : trade.status === 'closed'
                            ? 'bg-deriv-green/20 text-deriv-green'
                            : 'bg-deriv-yellow/20 text-deriv-yellow'
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
