'use client';

import { useStore } from '@/lib/store';

export default function MLPanel() {
  const { mlStats, bot } = useStore();

  const regimeLabels: Record<string, { label: string; color: string }> = {
    trending_up: { label: 'Trending Up', color: 'text-deriv-green' },
    trending_down: { label: 'Trending Down', color: 'text-deriv-red' },
    ranging: { label: 'Ranging', color: 'text-deriv-yellow' },
    volatile: { label: 'Volatile', color: 'text-deriv-purple' },
    breakout: { label: 'Breakout', color: 'text-deriv-cyan' },
  };

  const regime = regimeLabels[mlStats.regime] || { label: 'Unknown', color: 'text-deriv-muted' };

  return (
    <div className="glass-card p-4 lg:p-6">
      <h2 className="text-base lg:text-lg font-semibold text-deriv-text mb-4">AI Strategy Engine</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-deriv-darker/50 rounded-lg p-3">
          <div className="text-xs text-deriv-muted mb-1">Accuracy</div>
          <div className="text-xl font-bold text-deriv-cyan">{mlStats.accuracy}%</div>
        </div>
        <div className="bg-deriv-darker/50 rounded-lg p-3">
          <div className="text-xs text-deriv-muted mb-1">Total Signals</div>
          <div className="text-xl font-bold text-deriv-text">{mlStats.totalSignals}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-2 bg-deriv-darker/30 rounded-lg">
          <span className="text-xs text-deriv-muted">Market Regime</span>
          <span className={`text-sm font-medium ${regime.color}`}>{regime.label}</span>
        </div>

        <div className="flex items-center justify-between p-2 bg-deriv-darker/30 rounded-lg">
          <span className="text-xs text-deriv-muted">Active Trades</span>
          <span className="text-sm font-medium text-deriv-text">
            {bot.trades.filter((t) => t.status === 'open').length}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 bg-deriv-darker/30 rounded-lg">
          <span className="text-xs text-deriv-muted">Bot Status</span>
          <span className={`text-sm font-medium ${bot.isActive ? 'text-deriv-green' : 'text-deriv-muted'}`}>
            {bot.isActive ? 'Scanning' : 'Paused'}
          </span>
        </div>
      </div>

      {mlStats.patterns.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-deriv-muted mb-2">Detected Patterns</div>
          <div className="flex flex-wrap gap-1">
            {mlStats.patterns.map((p, i) => (
              <span
                key={i}
                className="text-[10px] px-2 py-0.5 bg-deriv-cyan/10 text-deriv-cyan rounded-full border border-deriv-cyan/20"
              >
                {p.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 p-2 bg-deriv-darker/30 rounded-lg">
        <div className="text-[10px] text-deriv-muted mb-1">ML Adaptive Strategy</div>
        <p className="text-xs text-deriv-text leading-relaxed">
          Uses regime detection, pattern recognition, and historical performance
          to adapt signal thresholds and stake sizing for optimal risk-adjusted returns.
        </p>
      </div>
    </div>
  );
}
