'use client';

import { useStore } from '@/lib/store';

export default function RulesPanel() {
  const { rules, updateRules } = useStore();

  const strategies = [
    { value: 'conservative', label: 'Conservative', desc: 'Lower risk, smaller stakes' },
    { value: 'moderate', label: 'Moderate', desc: 'Balanced risk and reward' },
    { value: 'aggressive', label: 'Aggressive', desc: 'Higher risk, larger stakes' },
  ];

  const markets = [
    { value: 'all', label: 'All Markets' },
    { value: 'synthetic', label: 'Synthetic Indices' },
    { value: 'forex', label: 'Forex' },
    { value: 'commodities', label: 'Commodities' },
    { value: 'digits', label: 'Digits Trading' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-deriv-text">Trading Rules</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-md font-medium text-deriv-text">Risk Management</h3>

          <div>
            <label className="block text-sm text-deriv-muted mb-1">Stake Amount ($)</label>
            <input
              type="number"
              value={rules.stake}
              onChange={(e) => updateRules({ stake: Number(e.target.value) })}
              className="input-field"
              min="0.35"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm text-deriv-muted mb-1">Max Stake ($)</label>
            <input
              type="number"
              value={rules.maxStake}
              onChange={(e) => updateRules({ maxStake: Number(e.target.value) })}
              className="input-field"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-deriv-muted mb-1">Target Profit ($)</label>
            <input
              type="number"
              value={rules.targetProfit}
              onChange={(e) => updateRules({ targetProfit: Number(e.target.value) })}
              className="input-field"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-deriv-muted mb-1">Stop Loss ($)</label>
            <input
              type="number"
              value={rules.stopLoss}
              onChange={(e) => updateRules({ stopLoss: Number(e.target.value) })}
              className="input-field"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-deriv-muted mb-1">Max Simultaneous Trades</label>
            <input
              type="number"
              value={rules.maxTrades}
              onChange={(e) => updateRules({ maxTrades: Number(e.target.value) })}
              className="input-field"
              min="1"
              max="20"
            />
          </div>
        </div>

        <div className="glass-card p-6 space-y-4">
          <h3 className="text-md font-medium text-deriv-text">Strategy</h3>

          <div className="space-y-2">
            {strategies.map((s) => (
              <button
                key={s.value}
                onClick={() =>
                  updateRules({ strategy: s.value as 'conservative' | 'moderate' | 'aggressive' })
                }
                className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                  rules.strategy === s.value
                    ? 'border-deriv-cyan bg-deriv-cyan/10'
                    : 'border-deriv-border hover:border-deriv-cyan/50'
                }`}
              >
                <div className="font-medium text-deriv-text">{s.label}</div>
                <div className="text-xs text-deriv-muted">{s.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label className="block text-sm text-deriv-muted mb-2">Market Selection</label>
            <select
              value={rules.market}
              onChange={(e) =>
                updateRules({ market: e.target.value as typeof rules.market })
              }
              className="input-field"
            >
              {markets.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between mt-4 p-3 bg-deriv-darker/50 rounded-lg">
            <div>
              <div className="text-sm font-medium text-deriv-text">Auto-Trade</div>
              <div className="text-xs text-deriv-muted">
                Automatically execute trades on strong signals
              </div>
            </div>
            <button
              onClick={() => updateRules({ autoTrade: !rules.autoTrade })}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                rules.autoTrade
                  ? 'bg-deriv-green'
                  : 'bg-deriv-border'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all duration-300 ${
                  rules.autoTrade ? 'left-6' : 'left-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
