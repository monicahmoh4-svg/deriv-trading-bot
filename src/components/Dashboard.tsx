'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';
import { TradingEngine, getMarketsByCategory, Signal } from '@/lib/trading-engine';
import BotToggle from './BotToggle';
import MarketScanner from './MarketScanner';
import SignalPanel from './SignalPanel';
import TradeHistory from './TradeHistory';
import ProfitChart from './ProfitChart';
import RulesPanel from './RulesPanel';
import ActivityLog from './ActivityLog';

const engine = new TradingEngine();

export default function Dashboard() {
  const router = useRouter();
  const {
    auth,
    bot,
    rules,
    activeTab,
    setAuth,
    setBalance,
    setBotActive,
    addTrade,
    updateTrade,
    addSignal,
    addPnl,
    setScannedMarkets,
    addActivity,
    setActiveTab,
    logout,
  } = useStore();

  const connectWebSocket = useCallback(async () => {
    if (!auth.token) return;

    const ws = getDerivWebSocket();
    try {
      await ws.connect();
      await ws.authenticate(auth.token);

      const balanceData = await ws.getBalance() as { balance: number; currency: string };
      setBalance(balanceData.balance, balanceData.currency);

      addActivity({ type: 'info', message: 'Connected to Deriv WebSocket' });

      ws.on('tick', (data) => {
        const tick = data as { symbol: string; quote: number; epoch: number };
        engine.addTick(tick.symbol, { quote: tick.quote, epoch: tick.epoch });

        if (bot.isActive) {
          const marketData = engine.getMarketData(tick.symbol);
          if (marketData && marketData.ticks.length >= 30) {
            const signal = engine.generateSignal(marketData);
            if (signal) {
              addSignal(signal);
              addActivity({
                type: 'signal',
                message: `Signal: ${signal.direction} ${signal.symbol} (${signal.confidence}% confidence)`,
              });

              if (rules.autoTrade && signal.confidence >= 60) {
                const result = engine.executeTrade(signal, rules, auth.balance);
                if (result.success && result.trade) {
                  const trade = result.trade;
                  addTrade(trade);
                  addActivity({
                    type: 'trade',
                    message: `Trade opened: ${trade.direction} ${trade.symbol} ($${trade.stake})`,
                  });

                  // Execute real trade on Deriv
                  const contractType = trade.contractType;
                  const duration = rules.strategy === 'aggressive' ? 5 : rules.strategy === 'moderate' ? 10 : 15;

                  ws.getContractProposal({
                    contract_type: contractType,
                    symbol: trade.symbol,
                    duration,
                    duration_unit: 'm',
                    amount: trade.stake,
                    basis: 'stake',
                    currency: auth.currency,
                  }).then((proposal) => {
                    return ws.buyContract(proposal.contract_id, trade.stake);
                  }).then((buyResult) => {
                    const br = buyResult as { contract_id?: number };
                    if (br.contract_id) {
                      updateTrade(trade.id, { contractId: br.contract_id });
                      addActivity({
                        type: 'trade',
                        message: `Contract purchased: ${br.contract_id}`,
                      });
                    }
                  }).catch((err) => {
                    addActivity({
                      type: 'error',
                      message: `Trade execution failed: ${err.message || 'Unknown error'}`,
                    });
                  });
                }
              }
            }
          }
        }
      });

      ws.on('balance', (data) => {
        const bal = data as { balance: number; currency: string };
        setBalance(bal.balance, bal.currency);
      });

      ws.on('proposal_open_contract', (data) => {
        const contract = data as { contract_id?: number; profit?: number; exit_tick?: number; is_sold?: boolean; is_expired?: boolean; status?: string };
        if (contract.is_sold || contract.is_expired) {
          const profit = contract.profit || 0;
          addPnl(profit);
          addActivity({
            type: profit >= 0 ? 'trade' : 'error',
            message: `Contract ${contract.contract_id} closed: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
          });
        }
      });

      ws.on('error', (data) => {
        const err = data as { message?: string };
        addActivity({
          type: 'error',
          message: err.message || 'WebSocket error',
        });
      });

      const markets = getMarketsByCategory(rules.market);
      setScannedMarkets(markets.map((m) => m.symbol));

      markets.forEach((market) => {
        ws.subscribeTicks(market.symbol);
      });

      addActivity({ type: 'info', message: `Subscribed to ${markets.length} markets` });
    } catch (error) {
      addActivity({
        type: 'error',
        message: 'Failed to connect to Deriv WebSocket',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      const ws = getDerivWebSocket();
      ws.disconnect();
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (!auth.token) {
      router.replace('/login');
    }
  }, [auth.token, router]);

  const handleLogout = () => {
    const ws = getDerivWebSocket();
    ws.disconnect();
    setBotActive(false);
    logout();
    router.replace('/login');
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'signals', label: 'Signals' },
    { id: 'trades', label: 'Trades' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-deriv-darker">
      <header className="bg-deriv-card border-b border-deriv-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-deriv-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-xl font-bold text-gradient">Deriv Bot</span>
            </div>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                auth.isDemo
                  ? 'bg-deriv-yellow/20 text-deriv-yellow border border-deriv-yellow/30'
                  : 'bg-deriv-green/20 text-deriv-green border border-deriv-green/30'
              }`}
            >
              {auth.isDemo ? 'DEMO' : 'REAL'}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-sm text-deriv-muted">Balance</div>
              <div className="text-lg font-bold text-deriv-cyan">
                {auth.currency} {auth.balance.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-deriv-muted">P&L</div>
              <div
                className={`text-lg font-bold ${
                  bot.pnl >= 0 ? 'text-deriv-green' : 'text-deriv-red'
                }`}
              >
                {bot.pnl >= 0 ? '+' : ''}${bot.pnl.toFixed(2)}
              </div>
            </div>
            <BotToggle />
            <button
              onClick={handleLogout}
              className="text-deriv-muted hover:text-deriv-red transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-48 bg-deriv-card border-r border-deriv-border min-h-[calc(100vh-60px)]">
          <nav className="p-4 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-deriv-cyan/20 text-deriv-cyan border border-deriv-cyan/30'
                    : 'text-deriv-muted hover:text-deriv-text hover:bg-deriv-border/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MarketScanner />
                <ActivityLog />
              </div>
              <ProfitChart />
            </div>
          )}
          {activeTab === 'signals' && <SignalPanel />}
          {activeTab === 'trades' && <TradeHistory />}
          {activeTab === 'settings' && <RulesPanel />}
        </main>
      </div>
    </div>
  );
}
