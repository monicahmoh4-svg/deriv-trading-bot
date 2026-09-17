'use client';

import { useStore } from '@/lib/store';

export default function SignalPanel() {
  const { bot } = useStore();
  const signals = bot.signals;

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-lg sm:text-xl font-bold gradient-text">AI Signals</h2>

      {signals.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-brand-muted text-sm">No signals yet. Start the bot to generate AI signals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {signals.slice().reverse().map((signal, idx) => (
            <div key={idx} className="glass-card p-4 card-premium">
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                  signal.direction === 'BUY'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-red-500/15 text-red-400 border border-red-500/25'
                }`}>
                  {signal.direction}
                </span>
                <span className="text-[10px] text-brand-muted">{signal.symbol}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-bold text-white">{signal.confidence}%</div>
                <div className="text-[10px] text-brand-muted truncate">{signal.strategy}</div>
              </div>
              {signal.regime && (
                <div className="mt-2 text-[10px] text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded-md inline-block">
                  {signal.regime}
                </div>
              )}
              <div className="mt-2 text-[10px] text-brand-muted">{new Date(signal.timestamp).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
