'use client';

import { useStore } from '@/lib/store';

export default function SignalPanel() {
  const { bot } = useStore();

  return (
    <div className="space-y-4 lg:space-y-6">
      <h2 className="text-base lg:text-lg font-semibold text-deriv-text">Active Signals</h2>

      {bot.signals.length === 0 ? (
        <div className="glass-card p-8 lg:p-12 text-center">
          <svg
            className="w-12 h-12 lg:w-16 lg:h-16 text-deriv-muted mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-deriv-muted">
            {bot.isActive
              ? 'Waiting for signals...'
              : 'Activate the bot to start receiving signals'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {bot.signals.map((signal) => (
            <div
              key={signal.id}
              className={`glass-card p-3 lg:p-4 border-l-4 ${
                signal.direction === 'BUY'
                  ? 'border-l-deriv-green'
                  : 'border-l-deriv-red'
              }`}
            >
              <div className="flex items-center justify-between mb-2 lg:mb-3">
                <span
                  className={`px-2 lg:px-3 py-0.5 lg:py-1 rounded-full text-xs lg:text-sm font-bold ${
                    signal.direction === 'BUY'
                      ? 'bg-deriv-green/20 text-deriv-green'
                      : 'bg-deriv-red/20 text-deriv-red'
                  }`}
                >
                  {signal.direction}
                </span>
                <span className="text-[10px] lg:text-xs text-deriv-muted">
                  {new Date(signal.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <div className="space-y-1.5 lg:space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-deriv-muted">Market</span>
                  <span className="text-xs lg:text-sm font-medium text-deriv-text">{signal.symbol}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-deriv-muted">Confidence</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-14 lg:w-16 h-1.5 bg-deriv-darker rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          signal.confidence >= 70
                            ? 'bg-deriv-green'
                            : signal.confidence >= 40
                            ? 'bg-deriv-yellow'
                            : 'bg-deriv-red'
                        }`}
                        style={{ width: `${signal.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-deriv-text">
                      {signal.confidence}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-deriv-muted">Entry</span>
                  <span className="text-xs font-mono text-deriv-cyan">
                    {signal.entry_price.toFixed(5)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-xs text-deriv-muted">Strategy</span>
                  <span className="text-[10px] lg:text-xs text-deriv-text truncate ml-2">{signal.strategy}</span>
                </div>

                {signal.regime && (
                  <div className="flex justify-between">
                    <span className="text-xs text-deriv-muted">Regime</span>
                    <span className="text-[10px] lg:text-xs text-deriv-purple capitalize">
                      {signal.regime.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
