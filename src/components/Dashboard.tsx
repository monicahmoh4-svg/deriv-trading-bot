'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';
import { TradingEngine, getMarketsByCategory, Signal, Trade } from '@/lib/trading-engine';
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

  const botRef = useRef(bot);
  const rulesRef = useRef(rules);
  const authRef = useRef(auth);
  const activeTradesRef = useRef<Map<string, Trade>>(new Map());
  const subscribedRef = useRef(false);

  useEffect(() => { botRef.current = bot; }, [bot]);
  useEffect(() => { rulesRef.current = rules; }, [rules]);
  useEffect(() => { authRef.current = auth; }, [auth]);

  useEffect(() => {
    if (!auth.token) {
      router.replace('/login');
      return;
    }

    const ws = getDerivWebSocket();
    let cancelled = false;

    const setup = async () => {
      setConnection('connecting');

      try {
        if (!ws.connected) {
          await ws.connect();
        }
        if (cancelled) return;
        setConnection('connected');

        const token = auth.token;
        if (!token) return;

        let authResponse: Record<string, unknown>;
        try {
          authResponse = await ws.authenticate(token) as Record<string, unknown>;
        } catch {
          throw new Error('Authentication failed');
        }

        if (cancelled) return;

        if (authResponse?.error) {
          const errData = authResponse.error as { message?: string };
          throw new Error(errData.message || 'Authentication failed');
        }

        setConnection('authenticated');

        const authorizeData = authResponse?.authorize as Record<string, unknown> | undefined;
        const balanceData = authResponse?.balance as { balance?: number; currency?: string } | undefined;

        if (balanceData && typeof balanceData.balance === 'number' && balanceData.currency) {
          setBalance(balanceData.balance, balanceData.currency);
        } else {
          try {
            const bal = await ws.getBalance() as { balance?: number; currency?: string };
            if (bal && typeof bal.balance === 'number' && bal.currency) {
              setBalance(bal.balance, bal.currency);
            }
          } catch {
            setBalance(0, 'USD');
          }
        }

        const accountType = authorizeData?.is_virtual ? 'Demo' : 'Real';
        const accountId = (authorizeData?.loginid as string) || 'Unknown';
        addActivity({ type: 'info', message: `Connected to Deriv (${accountType}: ${accountId})` });
        const email = authorizeData?.email as string;
        const fullname = authorizeData?.fullname as string;
        if (email) {
          addActivity({ type: 'info', message: `Logged in as ${fullname || email}` });
        }
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : 'Unknown error';
        setConnection('error', msg);
        addActivity({ type: 'error', message: `Connection failed: ${msg}` });
        if (msg.includes('Invalid token') || msg.includes('authorize') || msg.includes('Authentication')) {
          setTimeout(() => { logout(); router.replace('/login'); }, 2000);
        }
        return;
      }

      if (cancelled) return;

      const handleTick = (data: unknown) => {
        const tick = data as { symbol: string; quote: number; epoch: number };
        engine.addTick(tick.symbol, { quote: tick.quote, epoch: tick.epoch });

        const currentBot = botRef.current;
        const currentRules = rulesRef.current;
        const currentAuth = authRef.current;

        if (currentBot.isActive) {
          const marketData = engine.getMarketData(tick.symbol);
          if (marketData && marketData.ticks.length >= 30) {
            const signal = engine.generateSignal(marketData);
            if (signal) {
              addSignal(signal);
              addActivity({
                type: 'signal',
                message: `Signal: ${signal.direction} ${signal.symbol} (${signal.confidence}%) [${signal.strategy}]`,
              });

              if (currentRules.autoTrade && signal.confidence >= 60) {
                const result = engine.executeTrade(signal, currentRules, currentAuth.balance);
                if (result.success && result.trade) {
                  const trade = result.trade;
                  addTrade(trade);
                  activeTradesRef.current.set(trade.id, trade);
                  addActivity({
                    type: 'trade',
                    message: `Trade opened: ${trade.direction} ${trade.symbol} ($${trade.stake.toFixed(2)})`,
                  });

                  const contractType = trade.contractType;
                  const duration = currentRules.strategy === 'aggressive' ? 5 : currentRules.strategy === 'moderate' ? 10 : 15;

                  ws.getContractProposal({
                    contract_type: contractType,
                    symbol: trade.symbol,
                    duration,
                    duration_unit: 'm',
                    amount: trade.stake,
                    basis: 'stake',
                    currency: currentAuth.currency || 'USD',
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
                      ws.subscribeProposalOpenContract(br.contract_id);
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
      };

      const handleBalance = (data: unknown) => {
        const bal = data as { balance?: number; currency?: string };
        if (typeof bal.balance === 'number' && bal.currency) {
          setBalance(bal.balance, bal.currency);
        }
      };

      const handleContract = (data: unknown) => {
        const contract = data as {
          contract_id?: number;
          profit?: number;
          exit_tick?: number;
          is_sold?: boolean;
          is_expired?: boolean;
          status?: string;
        };
        if (contract.is_sold || contract.is_expired) {
          const profit = contract.profit || 0;
          addPnl(profit);

          for (const [tradeId, trade] of Array.from(activeTradesRef.current.entries())) {
            if (trade.contractId === contract.contract_id) {
              updateTrade(tradeId, {
                exitPrice: contract.exit_tick,
                profitLoss: profit,
                status: 'closed',
                closeTime: Date.now(),
              });
              activeTradesRef.current.delete(tradeId);

              engine.mlStrategy.recordSignalOutcome(
                trade.direction,
                trade.stake,
                trade.symbol,
                trade.contractType,
                profit
              );

              const mlStats = engine.getMLStats();
              useStore.getState().updateMLStats({
                accuracy: mlStats.accuracy,
                totalSignals: mlStats.totalSignals,
                regime: mlStats.recentRegime,
              });

              break;
            }
          }

          addActivity({
            type: profit >= 0 ? 'trade' : 'error',
            message: `Contract ${contract.contract_id} closed: ${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
          });
        }
      };

      const handleError = (data: unknown) => {
        const err = data as { message?: string };
        addActivity({
          type: 'error',
          message: err.message || 'WebSocket error',
        });
      };

      ws.on('tick', handleTick);
      ws.on('balance', handleBalance);
      ws.on('proposal_open_contract', handleContract);
      ws.on('error', handleError);

      if (!subscribedRef.current) {
        const markets = getMarketsByCategory(rulesRef.current.market);
        setScannedMarkets(markets.map((m) => m.symbol));
        markets.forEach((market) => {
          ws.subscribeTicks(market.symbol);
        });
        subscribedRef.current = true;
        addActivity({ type: 'info', message: `Subscribed to ${markets.length} markets` });
      }
    };

    setup();

    return () => {
      cancelled = true;
      ws.off('tick', () => {});
      ws.off('balance', () => {});
      ws.off('proposal_open_contract', () => {});
      ws.off('error', () => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token]);

  const handleLogout = () => {
    const ws = getDerivWebSocket();
    ws.disconnect();
    subscribedRef.current = false;
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
      <header className="hidden md:flex bg-gradient-to-r from-[#0d1321] to-[#111827] border-b border-deriv-border px-4 lg:px-6 py-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-deriv-cyan to-deriv-green flex items-center justify-center">
              <svg className="w-5 h-5 text-deriv-darker" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold text-gradient">DerivBot</span>
              <span className="text-[10px] text-deriv-muted ml-2">AI Trading</span>
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
              auth.isDemo
                ? 'bg-deriv-yellow/15 text-deriv-yellow border border-deriv-yellow/25'
                : 'bg-deriv-green/15 text-deriv-green border border-deriv-green/25'
            }`}
          >
            {auth.isDemo ? 'DEMO' : 'REAL'}
          </span>
          <ConnectionStatus />
        </div>

        <div className="flex items-center gap-4 lg:gap-6">
          <div className="text-right">
            <div className="text-[10px] text-deriv-muted uppercase tracking-wider">Balance</div>
            <div className="text-sm lg:text-base font-bold text-deriv-cyan">
              {auth.currency} {(auth.balance ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="w-px h-8 bg-deriv-border" />
          <div className="text-right">
            <div className="text-[10px] text-deriv-muted uppercase tracking-wider">P&L</div>
            <div className={`text-sm lg:text-base font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-deriv-green' : 'text-deriv-red'}`}>
              {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="w-px h-8 bg-deriv-border" />
          <BotToggle />
          <button
            onClick={handleLogout}
            className="text-deriv-muted hover:text-deriv-red transition-colors p-2 rounded-lg hover:bg-deriv-red/10"
            title="Logout"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-gradient-to-r from-[#0d1321] to-[#111827] border-b border-deriv-border px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-deriv-cyan to-deriv-green flex items-center justify-center">
              <svg className="w-4 h-4 text-deriv-darker" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-bold text-gradient">DerivBot</span>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <BotToggle />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-deriv-border/50">
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                auth.isDemo
                  ? 'bg-deriv-yellow/15 text-deriv-yellow border border-deriv-yellow/25'
                  : 'bg-deriv-green/15 text-deriv-green border border-deriv-green/25'
              }`}
            >
              {auth.isDemo ? 'DEMO' : 'REAL'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] text-deriv-muted uppercase tracking-wider">Balance</div>
              <div className="text-[11px] font-bold text-deriv-cyan">
                {auth.currency} {(auth.balance ?? 0).toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-deriv-muted uppercase tracking-wider">P&L</div>
              <div className={`text-[11px] font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-deriv-green' : 'text-deriv-red'}`}>
                {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Body */}
      <div className="hidden md:flex">
        <aside className="w-40 lg:w-52 bg-[#0d1321] border-r border-deriv-border min-h-[calc(100vh-60px)]">
          <nav className="p-3 space-y-1">
            <div className="text-[9px] uppercase tracking-widest text-deriv-muted px-3 py-2">Navigation</div>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 flex items-center gap-2.5 group ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-deriv-cyan/20 to-deriv-cyan/5 text-deriv-cyan border border-deriv-cyan/30'
                    : 'text-deriv-muted hover:text-deriv-text hover:bg-deriv-border/30'
                }`}
              >
                <svg className={`w-4 h-4 shrink-0 transition-colors ${activeTab === tab.id ? 'text-deriv-cyan' : 'text-deriv-muted group-hover:text-deriv-text'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span className="text-sm font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-deriv-cyan" />
                )}
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
      <main className="md:hidden pb-16 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 110px)' }}>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d1321] border-t border-deriv-border safe-bottom z-50">
        <div className="flex items-center justify-around py-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center py-1.5 px-2 rounded-lg transition-all min-w-[56px] ${
                activeTab === tab.id
                  ? 'text-deriv-cyan'
                  : 'text-deriv-muted active:text-deriv-text'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="text-[9px] mt-0.5 font-medium">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="w-4 h-0.5 rounded-full bg-deriv-cyan mt-0.5" />
              )}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center py-1.5 px-2 rounded-lg text-deriv-muted active:text-deriv-red min-w-[56px]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-[9px] mt-0.5 font-medium">Exit</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
