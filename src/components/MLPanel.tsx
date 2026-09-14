'use client';

import { useStore } from '@/lib/store';

export default function MLPanel() {
  const { mlStats } = useStore();

  return (
    <div className="glass-card p-4 sm:p-6 card-premium">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          ML Strategy
        </h2>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold">
          Active
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-brand-muted uppercase tracking-wider">Accuracy</div>
          <div className="text-lg font-bold text-brand-emerald mt-1">
            {mlStats.accuracy}%
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-brand-muted uppercase tracking-wider">Regime</div>
          <div className="text-sm font-bold text-brand-blue mt-1 truncate">
            {mlStats.regime || '---'}
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-brand-muted uppercase tracking-wider">Signals</div>
          <div className="text-lg font-bold text-white mt-1">
            {mlStats.totalSignals}
          </div>
        </div>
        <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <div className="text-[10px] text-brand-muted uppercase tracking-wider">Patterns</div>
          <div className="text-lg font-bold text-white mt-1">
            {mlStats.patterns?.length || 0}
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/5">
        <div className="text-[10px] text-brand-muted text-center">Adaptive algorithm learns from every trade outcome</div>
      </div>
    </div>
  );
}
