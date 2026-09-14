'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { getDerivWebSocket, TickData } from '@/lib/deriv-websocket';
import { getMarketsByCategory } from '@/lib/trading-engine';

interface MarketTick {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdate: number;
  signalStrength: number;
}

export default function MarketScanner() {
  const { rules, bot } = useStore();
  const [markets, setMarkets] = useState<MarketTick[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const ws = getDerivWebSocket();
    const marketList = getMarketsByCategory(rules.market);
    const marketMap = new Map<string, MarketTick>();

    marketList.forEach((m) => {
      marketMap.set(m.symbol, {
        symbol: m.symbol, name: m.name, price: 0, change: 0,
        changePercent: 0, lastUpdate: 0, signalStrength: 0,
      });
    });

    setMarkets(Array.from(marketMap.values()));

    const handleTick = (data: unknown) => {
      const tick = data as TickData;
      const market = marketMap.get(tick.symbol);
      if (market) {
        const prevPrice = market.price;
        market.price = tick.quote;
        market.change = prevPrice > 0 ? tick.quote - prevPrice : 0;
        market.changePercent = prevPrice > 0 ? (market.change / prevPrice) * 100 : 0;
        market.lastUpdate = tick.epoch * 1000;
        market.signalStrength = Math.min(100, Math.max(0, market.signalStrength + Math.floor(Math.random() * 20 - 8)));
        setMarkets(Array.from(marketMap.values()));
        setLastUpdate(Date.now());
      }
    };

    ws.on('tick', handleTick);
    return () => { ws.off('tick', handleTick); };
  }, [rules.market]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarkets((prev) =>
        prev.map((m) => ({
          ...m,
          signalStrength: bot.isActive
            ? Math.min(100, m.signalStrength + Math.floor(Math.random() * 10 - 5))
            : 0,
        }))
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [bot.isActive]);

  const getSignalColor = (strength: number) => {
    if (strength >= 70) return 'text-emerald-400 bg-emerald-500/15';
    if (strength >= 40) return 'text-yellow-400 bg-yellow-500/15';
    return 'text-red-400 bg-red-500/15';
  };

  const getSignalLabel = (strength: number) => {
    if (strength >= 70) return 'Strong';
    if (strength >= 40) return 'Med';
    return 'Weak';
  };

  return (
    <div className="glass-card p-4 sm:p-6 card-premium">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Market Scanner
        </h2>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${bot.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          <span className="text-[10px] text-brand-muted">{bot.isActive ? 'Live' : 'Paused'}</span>
        </div>
      </div>

      <div className="space-y-2 max-h-64 sm:max-h-96 overflow-y-auto pr-1">
        {Array.from(new Map(
          getMarketsByCategory(rules.market).map(m => [m.symbol, m])
        ).values()).map((marketDef) => {
          const marketData = markets.find(m => m.symbol === marketDef.symbol) || {
            symbol: marketDef.symbol, name: marketDef.name, price: 0,
            change: 0, changePercent: 0, lastUpdate: 0, signalStrength: 0,
          };

          return (
            <div
              key={marketDef.symbol}
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-brand-blue/20 transition-all duration-200 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-brand-blue transition-colors">{marketDef.name}</div>
                <div className="text-[10px] text-brand-muted">{marketDef.symbol}</div>
              </div>

              <div className="flex-1 text-center px-2">
                <div className="text-xs sm:text-sm font-mono text-brand-blue font-medium">
                  {marketData.price > 0 ? marketData.price.toFixed(5) : '---'}
                </div>
                <div className={`text-[10px] sm:text-xs font-medium ${marketData.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {marketData.change >= 0 ? '+' : ''}{marketData.change.toFixed(5)}
                </div>
              </div>

              <div className="flex-shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-semibold ${getSignalColor(marketData.signalStrength)}`}>
                  {bot.isActive ? getSignalLabel(marketData.signalStrength) : '---'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] text-brand-muted text-center">
        Last update: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
}
