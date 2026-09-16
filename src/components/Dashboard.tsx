'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { getDerivWebSocket } from '@/lib/deriv-websocket';
import { TradingEngine, getMarketsByCategory, Trade } from '@/lib/trading-engine';
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const botRef = useRef(bot);
  const rulesRef = useRef(rules);
  const authRef = useRef(auth);
  const activeTradesRef = useRef<Map<string, Trade>>(new Map());
  const subscribedRef = useRef(false);
  const engineRef = useRef(engine);

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

        try {
          const bal = await ws.getBalance() as { balance?: number; currency?: string };
          if (bal && typeof bal.balance === 'number' && bal.currency) {
            setBalance(bal.balance, bal.currency);
          }
        } catch {
          setBalance(0, 'USD');
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
        engineRef.current.addTick(tick.symbol, { quote: tick.quote, epoch: tick.epoch });

        const currentBot = botRef.current;
        const currentRules = rulesRef.current;
        const currentAuth = authRef.current;

        if (currentBot.isActive) {
          const marketData = engineRef.current.getMarketData(tick.symbol);
          if (marketData && marketData.ticks.length >= 15) {
            const signal = engineRef.current.generateSignal(marketData);
            if (signal) {
              addSignal(signal);
              addActivity({
                type: 'signal',
                message: `Signal: ${signal.direction} ${signal.symbol} (${signal.confidence}%) [${signal.strategy}]`,
              });

              if (currentRules.autoTrade && signal.confidence >= 45) {
                const result = engineRef.current.executeTrade(signal, currentRules, currentAuth.balance);
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
                      addActivity({ type: 'trade', message: `Contract purchased: ${br.contract_id}` });
                      ws.subscribeProposalOpenContract(br.contract_id);
                    }
                  }).catch((err) => {
                    addActivity({ type: 'error', message: `Trade execution failed: ${err.message || 'Unknown error'}` });
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
          contract_id?: number; profit?: number; exit_tick?: number;
          is_sold?: boolean; is_expired?: boolean; status?: string;
        };
        if (contract.is_sold || contract.is_expired) {
          const profit = contract.profit || 0;
          addPnl(profit);

          for (const [tradeId, trade] of Array.from(activeTradesRef.current.entries())) {
            if (trade.contractId === contract.contract_id) {
              updateTrade(tradeId, {
                exitPrice: contract.exit_tick, profitLoss: profit,
                status: 'closed', closeTime: Date.now(),
              });
              activeTradesRef.current.delete(tradeId);
              engineRef.current.mlStrategy.recordSignalOutcome(
                trade.direction, trade.confidence, trade.symbol, trade.contractType, profit
              );
              const mlStats = engineRef.current.getMLStats();
              useStore.getState().updateMLStats({ accuracy: mlStats.accuracy, regime: mlStats.recentRegime });
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
        addActivity({ type: 'error', message: err.message || 'WebSocket error' });
      };

      ws.on('tick', handleTick);
      ws.on('balance', handleBalance);
      ws.on('proposal_open_contract', handleContract);
      ws.on('error', handleError);

      if (!subscribedRef.current) {
        const markets = getMarketsByCategory(rulesRef.current.market);
        setScannedMarkets(markets.map((m) => m.symbol));
        markets.forEach((market) => ws.subscribeTicks(market.symbol));
        subscribedRef.current = true;
        addActivity({ type: 'info', message: `Subscribed to ${markets.length} markets` });
      }
    };

    setup();
    return () => { cancelled = true; };
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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'signals', label: 'Signals', icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    { id: 'trades', label: 'Trades', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  ];

  return (
    <div className="min-h-screen bg-brand-dark pb-20 md:pb-0">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-brand-dark/90 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-emerald flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-base font-bold gradient-text">DerivBot</span>
            </div>

            {/* Desktop center nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-brand-blue/15 text-brand-blue border border-brand-blue/20'
                      : 'text-brand-muted hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
            </div>

            {/* Desktop right */}
            <div className="hidden md:flex items-center gap-3">
              <ConnectionStatus />
              <div className="w-px h-5 bg-white/10" />
              <div className="text-right">
                <div className="text-[10px] text-brand-muted leading-none">Balance</div>
                <div className="text-sm font-bold text-brand-emerald">{auth.currency} {(auth.balance ?? 0).toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-brand-muted leading-none">P&L</div>
                <div className={`text-sm font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => setBotActive(!bot.isActive)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  bot.isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : 'bg-gradient-to-r from-brand-blue to-brand-emerald text-white shadow-lg shadow-brand-blue/20'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${bot.isActive ? 'bg-white animate-pulse' : 'bg-white/60'}`} />
                {bot.isActive ? 'STOP BOT' : 'START BOT'}
              </button>
              <button onClick={handleLogout} className="text-brand-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors" title="Logout">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* Mobile: connection + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <ConnectionStatus />
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-lg text-brand-muted hover:text-white">
                {mobileMenuOpen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-3 border-t border-white/5 pt-2 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                    activeTab === item.id ? 'bg-brand-blue/15 text-brand-blue' : 'text-brand-muted hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.label}
                </button>
              ))}
              <div className="flex items-center justify-between px-3 pt-2 border-t border-white/5 mt-2">
                <div className="text-xs text-brand-muted">
                  {auth.currency} <span className="text-brand-emerald font-bold">{(auth.balance ?? 0).toFixed(2)}</span>
                </div>
                <button onClick={handleLogout} className="text-xs text-red-400">Logout</button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Bot Status Banner */}
            <div className={`glass-card p-4 flex items-center justify-between ${bot.isActive ? 'border border-emerald-500/30' : 'border border-white/5'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bot.isActive ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                  {bot.isActive ? (
                    <svg className="w-5 h-5 text-emerald-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{bot.isActive ? 'Bot Active' : 'Bot Inactive'}</div>
                  <div className="text-[11px] text-brand-muted">
                    {bot.isActive ? `Scanning ${getMarketsByCategory(rules.market).length} markets` : 'Click Start Bot to begin trading'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setBotActive(!bot.isActive)}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  bot.isActive
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                    : 'bg-gradient-to-r from-brand-blue to-brand-emerald text-white shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40'
                }`}
              >
                {bot.isActive ? 'STOP' : 'START BOT'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MarketScanner engine={engineRef.current} />
              <ActivityLog />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProfitChart />
              <MLPanel />
            </div>
          </div>
        )}
        {activeTab === 'signals' && <SignalPanel />}
        {activeTab === 'trades' && <TradeHistory />}
        {activeTab === 'settings' && <RulesPanel />}
      </main>

      {/* Fixed Bottom Tab Bar (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-brand-dark/95 backdrop-blur-lg border-t border-white/5 safe-bottom">
        <div className="flex items-center justify-around h-14 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0 ${
                activeTab === item.id ? 'text-brand-blue' : 'text-brand-muted'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setBotActive(!bot.isActive)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg min-w-0 ${
              bot.isActive ? 'text-emerald-400' : 'text-brand-blue'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              bot.isActive ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-gradient-to-r from-brand-blue to-brand-emerald'
            }`}>
              {bot.isActive ? (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
              )}
            </div>
            <span className="text-[10px] font-medium">{bot.isActive ? 'Stop' : 'Start'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
