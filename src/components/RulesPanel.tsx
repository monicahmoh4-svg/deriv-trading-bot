'use client';

import { useStore } from '@/lib/store';

export default function RulesPanel() {
  const { rules, updateRules } = useStore();

  const marketOptions = ['Major Pairs', 'Forex', 'Indices', 'Commodities', 'Synthetics'];
  const strategyOptions = ['moderate', 'aggressive', 'conservative'];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl">
      <h2 className="text-lg sm:text-xl font-bold gradient-text">Trading Rules</h2>

      <div className="glass-card p-4 sm:p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Market Category</label>
          <select
            value={rules.market}
            onChange={(e) => updateRules({ market: e.target.value })}
            className="input-field"
          >
            {marketOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Strategy Preset</label>
          <select
            value={rules.strategy}
            onChange={(e) => updateRules({ strategy: e.target.value })}
            className="input-field"
          >
            {strategyOptions.map((opt) => (
              <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Stake Amount (USD)</label>
          <input
            type="number"
            value={rules.stake}
            onChange={(e) => updateRules({ stake: parseFloat(e.target.value) || 1 })}
            className="input-field"
            min="1"
            step="1"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Min Confidence (%)</label>
          <input
            type="number"
            value={rules.minConfidence}
            onChange={(e) => updateRules({ minConfidence: parseInt(e.target.value) || 60 })}
            className="input-field"
            min="10"
            max="100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Max Daily Trades</label>
          <input
            type="number"
            value={rules.maxTrades}
            onChange={(e) => updateRules({ maxTrades: parseInt(e.target.value) || 20 })}
            className="input-field"
            min="1"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Stop Loss (USD)</label>
          <input
            type="number"
            value={rules.stopLoss}
            onChange={(e) => updateRules({ stopLoss: parseFloat(e.target.value) || 50 })}
            className="input-field"
            min="1"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Take Profit (USD)</label>
          <input
            type="number"
            value={rules.takeProfit}
            onChange={(e) => updateRules({ takeProfit: parseFloat(e.target.value) || 100 })}
            className="input-field"
            min="1"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <span className="text-sm font-medium text-white">Auto-Trade</span>
          <button
            onClick={() => updateRules({ autoTrade: !rules.autoTrade })}
            className={`w-10 h-5 rounded-full transition-colors duration-300 ${rules.autoTrade ? 'bg-brand-emerald' : 'bg-slate-600'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${rules.autoTrade ? 'translate-x-5.5 ml-[1px]' : 'translate-x-0.5 ml-[1px]'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
