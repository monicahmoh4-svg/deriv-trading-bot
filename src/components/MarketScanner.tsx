'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getMarketsByCategory, TradingEngine } from '@/lib/trading-engine';

interface MarketTick {
  symbol: string;
  name: string;
  price: number;
  change: number;
  lastUpdate: number;
  ticksReceived: number;
}

export default function MarketScanner({ engine }: { engine: TradingEngine }) {
  const { rules, bot } = useStore();
  const [markets, setMarkets] = useState<MarketTick[]>([]);

  useEffect(() => {
    const marketList = getMarketsByCategory(rules.market);
    setMarkets(marketList.map((m) => ({
      symbol: m.symbol, name: m.name, price: 0, change: 0, lastUpdate: 0, ticksReceived: 0,
    })));
  }, [rules.market]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets((prev) =>
        prev.map((m) => {
          const data = engine.getMarketData(m.symbol);
          if (data && data.ticks.length > 0) {
            const latest = data.ticks[data.ticks.length - 1];
            const prevTick = data.ticks.length > 1 ? data.ticks[data.ticks.length - 2] : null;
            return {
              ...m,
              price: latest.quote,
              change: prevTick ? latest.quote - prevTick.quote : 0,
              lastUpdate: latest.epoch * 1000,
              ticksReceived: data.ticks.length,
            };
          }
          return m;
        })
      );
    }, 500);
    return () => clearInterval(interval);
  }, [engine, rules.market]);

  const allMarkets = getMarketsByCategory(rules.market);

  return (
    <div className="glass-card p-4 sm:p-6 card-premium">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Market Scanner
        </h2>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${bot.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-[10px] text-brand-muted">{bot.isActive ? 'Live' : 'Paused'}</span>
        </div>
      </div>

      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
        {allMarkets.map((marketDef) => {
          const marketData = markets.find((m) => m.symbol === marketDef.symbol);
          const price = marketData?.price ?? 0;
          const change = marketData?.change ?? 0;
          const ticks = marketData?.ticksReceived ?? 0;

          return (
            <div
              key={marketDef.symbol}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5 hover:border-brand-blue/20 transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate">{marketDef.name}</div>
                <div className="text-[10px] text-brand-muted">{marketDef.symbol} &middot; {ticks} ticks</div>
              </div>

              <div className="flex-1 text-center px-2">
                <div className="text-xs sm:text-sm font-mono text-brand-blue font-medium">
                  {price > 0 ? price.toFixed(5) : '---'}
                </div>
                <div className={`text-[10px] font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {price > 0 ? `${change >= 0 ? '+' : ''}${change.toFixed(5)}` : '---'}
                </div>
              </div>

              <div className="flex-shrink-0">
                {ticks < 15 ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-yellow-400 bg-yellow-500/15">
                    Loading
                  </span>
                ) : bot.isActive ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-emerald-400 bg-emerald-500/15">
                    Active
                  </span>
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold text-brand-muted bg-white/5">
                    Ready
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-brand-muted text-center">
        {allMarkets.length} markets &middot; Tick data updates every second
      </div>
    </div>
  );
}
