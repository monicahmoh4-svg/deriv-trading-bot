'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';
import { TradingEngine, getMarketsByCategory } from '@/lib/trading-engine';
import BotToggle from './BotToggle';
import MarketScanner from './MarketScanner';
import SignalPanel from './SignalPanel';
import TradeHistory from './TradeHistory';
import ProfitChart from './ProfitChart';
import RulesPanel from './RulesPanel';
import ActivityLog from './ActivityLog';
import ConnectionStatus from './ConnectionStatus';
import MLPanel from './MLPanel';

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
    setConnection,
    logout,
  } = useStore();

  const connectWebSocket = useCallback(async () => {
    if (!auth.token) return;

    const ws = getDerivWebSocket();
    setConnection('connecting');

    try {
      await ws.connect();
      setConnection('connected');

      const authResponse = await ws.authenticate(auth.token) as {
        balance?: number;
        currency?: string;
        loginid?: string;
        email?: string;
        fullname?: string;
        is_virtual?: number;
        error?: { code?: string; message?: string };
      };

      if (authResponse?.error) {
        throw new Error(authResponse.error.message || 'Authentication failed');
      }

      setConnection('authenticated');

      if (authResponse) {
        if (authResponse.balance !== undefined && authResponse.currency) {
          setBalance(authResponse.balance, authResponse.currency);
        } else {
          const balanceData = await ws.getBalance() as { balance: number; currency: string };
          setBalance(balanceData.balance, balanceData.currency);
        }

        const accountType = authResponse.is_virtual ? 'Demo' : 'Real';
        const accountId = authResponse.loginid || 'Unknown';
        addActivity({ type: 'info', message: `Connected to Deriv (${accountType}: ${accountId})` });
        if (authResponse.email) {
          addActivity({ type: 'info', message: `Logged in as ${authResponse.fullname || authResponse.email}` });
        }
      }

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
                message: `Signal: ${signal.direction} ${signal.symbol} (${signal.confidence}% confidence) [${signal.strategy}]`,
              });

              if (rules.autoTrade && signal.confidence >= 60) {
                const result = engine.executeTrade(signal, rules, auth.balance);
                if (result.success && result.trade) {
                  const trade = result.trade;
                  addTrade(trade);
                  addActivity({
                    type: 'trade',
                    message: `Trade opened: ${trade.direction} ${trade.symbol} ($${trade.stake.toFixed(2)})`,
                  });

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
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setConnection('error', msg);

      if (msg.includes('Invalid token') || msg.includes('authorize') || msg.includes('Authentication failed')) {
        addActivity({ type: 'error', message: 'Authentication failed. Token may be invalid or expired.' });
        setTimeout(() => {
          logout();
          router.replace('/login');
        }, 2000);
      } else {
        addActivity({ type: 'error', message: `Connection failed: ${msg}` });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      const ws = getDerivWebSocket();
      ws.disconnect();
      setConnection('disconnected');
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
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'signals', label: 'Signals', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'trades', label: 'Trades', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="min-h-screen bg-deriv-darker">
      {/* Desktop Header */}
      <header className="hidden md:flex bg-deriv-card border-b border-deriv-border px-4 lg:px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-7 h-7 lg:w-8 lg:h-8 text-deriv-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-lg lg:text-xl font-bold text-gradient">Deriv Bot</span>
          </div>
          <span
            className={`text-[10px] lg:text-xs px-2 py-0.5 rounded-full font-medium ${
              auth.isDemo
                ? 'bg-deriv-yellow/20 text-deriv-yellow border border-deriv-yellow/30'
                : 'bg-deriv-green/20 text-deriv-green border border-deriv-green/30'
            }`}
          >
            {auth.isDemo ? 'DEMO' : 'REAL'}
          </span>
          <ConnectionStatus />
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="text-right">
            <div className="text-xs text-deriv-muted">Balance</div>
            <div className="text-sm lg:text-base font-bold text-deriv-cyan">
              {auth.currency} {(auth.balance ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-deriv-muted">P&L</div>
            <div className={`text-sm lg:text-base font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-deriv-green' : 'text-deriv-red'}`}>
              {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
            </div>
          </div>
          <BotToggle />
          <button
            onClick={handleLogout}
            className="text-deriv-muted hover:text-deriv-red transition-colors p-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-deriv-card border-b border-deriv-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-deriv-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span className="text-base font-bold text-gradient">Deriv Bot</span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus />
            <BotToggle />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                auth.isDemo
                  ? 'bg-deriv-yellow/20 text-deriv-yellow border border-deriv-yellow/30'
                  : 'bg-deriv-green/20 text-deriv-green border border-deriv-green/30'
              }`}
            >
              {auth.isDemo ? 'DEMO' : 'REAL'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[10px] text-deriv-muted">Balance</div>
              <div className="text-xs font-bold text-deriv-cyan">
                {auth.currency} {(auth.balance ?? 0).toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-deriv-muted">P&L</div>
              <div className={`text-xs font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-deriv-green' : 'text-deriv-red'}`}>
                {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Body */}
      <div className="hidden md:flex">
        <aside className="w-40 lg:w-48 bg-deriv-card border-r border-deriv-border min-h-[calc(100vh-60px)]">
          <nav className="p-3 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-deriv-cyan/20 text-deriv-cyan border border-deriv-cyan/30'
                    : 'text-deriv-muted hover:text-deriv-text hover:bg-deriv-border/50'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 60px)' }}>
          {activeTab === 'dashboard' && (
            <div className="space-y-4 lg:space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                <MarketScanner />
                <ActivityLog />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
                <ProfitChart />
                <MLPanel />
              </div>
            </div>
          )}
          {activeTab === 'signals' && <SignalPanel />}
          {activeTab === 'trades' && <TradeHistory />}
          {activeTab === 'settings' && <RulesPanel />}
        </main>
      </div>

      {/* Mobile Body */}
      <main className="md:hidden pb-20 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 110px)' }}>
        <div className="p-3 space-y-3">
          {activeTab === 'dashboard' && (
            <>
              <MarketScanner />
              <ActivityLog />
              <ProfitChart />
              <MLPanel />
            </>
          )}
          {activeTab === 'signals' && <SignalPanel />}
          {activeTab === 'trades' && <TradeHistory />}
          {activeTab === 'settings' && <RulesPanel />}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-deriv-card border-t border-deriv-border px-2 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-1.5 px-3 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'text-deriv-cyan'
                  : 'text-deriv-muted'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center py-1.5 px-3 rounded-lg text-deriv-muted"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-[10px] mt-0.5">Exit</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
