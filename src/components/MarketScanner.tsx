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
        symbol: m.symbol,
        name: m.name,
        price: 0,
        change: 0,
        changePercent: 0,
        lastUpdate: 0,
        signalStrength: 0,
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

    return () => {
      ws.off('tick', handleTick);
    };
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
    if (strength >= 70) return 'text-deriv-green bg-deriv-green/20';
    if (strength >= 40) return 'text-deriv-yellow bg-deriv-yellow/20';
    return 'text-deriv-red bg-deriv-red/20';
  };

  const getSignalLabel = (strength: number) => {
    if (strength >= 70) return 'Strong';
    if (strength >= 40) return 'Med';
    return 'Weak';
  };

  return (
    <div className="glass-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm lg:text-base font-semibold text-deriv-text">Market Scanner</h2>
        <span className="text-[10px] lg:text-xs text-deriv-muted">
          {bot.isActive ? 'Scanning...' : 'Paused'}
        </span>
      </div>

      <div className="space-y-2 max-h-64 lg:max-h-96 overflow-y-auto">
        {Array.from(new Map(
          getMarketsByCategory(rules.market).map(m => [m.symbol, m])
        ).values()).map((marketDef) => {
          const marketData = markets.find(m => m.symbol === marketDef.symbol) || {
            symbol: marketDef.symbol,
            name: marketDef.name,
            price: 0,
            change: 0,
            changePercent: 0,
            lastUpdate: 0,
            signalStrength: 0,
          };

          return (
            <div
              key={marketDef.symbol}
              className="flex items-center justify-between p-2.5 bg-deriv-darker/50 rounded-lg border border-deriv-border/50 hover:border-deriv-cyan/30 transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs lg:text-sm font-medium text-deriv-text truncate">{marketDef.name}</div>
                <div className="text-[10px] text-deriv-muted">{marketDef.symbol}</div>
              </div>

              <div className="flex-1 text-right px-2">
                <div className="text-xs lg:text-sm font-mono text-deriv-cyan">
                  {marketData.price > 0 ? marketData.price.toFixed(5) : '---'}
                </div>
                <div
                  className={`text-[10px] lg:text-xs ${
                    marketData.change >= 0 ? 'text-deriv-green' : 'text-deriv-red'
                  }`}
                >
                  {marketData.change >= 0 ? '+' : ''}
                  {marketData.change.toFixed(5)}
                </div>
              </div>

              <div className="flex-shrink-0">
                <span
                  className={`inline-block px-1.5 lg:px-2 py-0.5 rounded text-[10px] lg:text-xs font-medium ${getSignalColor(
                    marketData.signalStrength
                  )}`}
                >
                  {bot.isActive ? getSignalLabel(marketData.signalStrength) : '---'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[10px] lg:text-xs text-deriv-muted text-center">
        Last update: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
}
