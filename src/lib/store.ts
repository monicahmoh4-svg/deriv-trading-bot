import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Signal, Trade, TradingRules } from './trading-engine';
import { MarketRegime, PatternType } from './ml-strategy';

interface AuthState {
  token: string | null;
  isDemo: boolean;
  balance: number;
  currency: string;
}

interface BotState {
  isActive: boolean;
  trades: Trade[];
  signals: Signal[];
  pnl: number;
  scannedMarkets: string[];
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';
  error: string | null;
  lastConnected: number | null;
}

interface MLStats {
  accuracy: number;
  totalSignals: number;
  regime: MarketRegime;
  patterns: PatternType[];
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  type: 'scan' | 'signal' | 'trade' | 'error' | 'info';
  message: string;
}

interface AppState {
  auth: AuthState;
  bot: BotState;
  rules: TradingRules;
  activities: ActivityEntry[];
  activeTab: string;
  connection: ConnectionState;
  mlStats: MLStats;

  setAuth: (token: string, isDemo: boolean) => void;
  setDemo: (isDemo: boolean) => void;
  setBalance: (balance: number, currency: string) => void;
  logout: () => void;

  toggleBot: () => void;
  setBotActive: (active: boolean) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (tradeId: string, updates: Partial<Trade>) => void;
  removeTrade: (tradeId: string) => void;
  addSignal: (signal: Signal) => void;
  clearSignals: () => void;
  setPnl: (pnl: number) => void;
  addPnl: (amount: number) => void;
  setScannedMarkets: (markets: string[]) => void;

  setConnection: (status: ConnectionState['status'], error?: string) => void;
  updateMLStats: (stats: Partial<MLStats>) => void;

  updateRules: (rules: Partial<TradingRules>) => void;

  addActivity: (activity: Omit<ActivityEntry, 'id' | 'timestamp'>) => void;
  clearActivities: () => void;

  setActiveTab: (tab: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      auth: {
        token: null,
        isDemo: true,
        balance: 0,
        currency: 'USD',
      },
      bot: {
        isActive: false,
        trades: [],
        signals: [],
        pnl: 0,
        scannedMarkets: [],
      },
      rules: {
        stake: 1,
        maxStake: 100,
        targetProfit: 50,
        stopLoss: 20,
        maxTrades: 5,
        strategy: 'moderate',
        market: 'all',
        autoTrade: true,
      },
      activities: [],
      activeTab: 'dashboard',
      connection: {
        status: 'disconnected',
        error: null,
        lastConnected: null,
      },
      mlStats: {
        accuracy: 0,
        totalSignals: 0,
        regime: 'ranging',
        patterns: [],
      },

      setAuth: (token, isDemo) =>
        set((state) => ({
          auth: { ...state.auth, token, isDemo },
        })),

      setDemo: (isDemo) =>
        set((state) => ({
          auth: { ...state.auth, isDemo },
        })),

      setBalance: (balance, currency) =>
        set((state) => ({
          auth: { ...state.auth, balance, currency },
        })),

      logout: () =>
        set({
          auth: { token: null, isDemo: true, balance: 0, currency: 'USD' },
          bot: {
            isActive: false,
            trades: [],
            signals: [],
            pnl: 0,
            scannedMarkets: [],
          },
          activities: [],
          connection: { status: 'disconnected', error: null, lastConnected: null },
        }),

      toggleBot: () =>
        set((state) => ({
          bot: { ...state.bot, isActive: !state.bot.isActive },
        })),

      setBotActive: (active) =>
        set((state) => ({
          bot: { ...state.bot, isActive: active },
        })),

      addTrade: (trade) =>
        set((state) => ({
          bot: {
            ...state.bot,
            trades: [...state.bot.trades, trade],
          },
        })),

      updateTrade: (tradeId, updates) =>
        set((state) => ({
          bot: {
            ...state.bot,
            trades: state.bot.trades.map((t) =>
              t.id === tradeId ? { ...t, ...updates } : t
            ),
          },
        })),

      removeTrade: (tradeId) =>
        set((state) => ({
          bot: {
            ...state.bot,
            trades: state.bot.trades.filter((t) => t.id !== tradeId),
          },
        })),

      addSignal: (signal) =>
        set((state) => ({
          bot: {
            ...state.bot,
            signals: [signal, ...state.bot.signals].slice(0, 50),
          },
          mlStats: {
            ...state.mlStats,
            totalSignals: state.mlStats.totalSignals + 1,
            regime: signal.regime || state.mlStats.regime,
            patterns: signal.patterns || state.mlStats.patterns,
          },
        })),

      clearSignals: () =>
        set((state) => ({
          bot: { ...state.bot, signals: [] },
        })),

      setPnl: (pnl) =>
        set((state) => ({
          bot: { ...state.bot, pnl },
        })),

      addPnl: (amount) =>
        set((state) => ({
          bot: { ...state.bot, pnl: state.bot.pnl + amount },
        })),

      setScannedMarkets: (markets) =>
        set((state) => ({
          bot: { ...state.bot, scannedMarkets: markets },
        })),

      setConnection: (status, error) =>
        set((state) => ({
          connection: {
            status,
            error: error || null,
            lastConnected: status === 'authenticated' ? Date.now() : state.connection.lastConnected,
          },
        })),

      updateMLStats: (stats) =>
        set((state) => ({
          mlStats: { ...state.mlStats, ...stats },
        })),

      updateRules: (newRules) =>
        set((state) => ({
          rules: { ...state.rules, ...newRules },
        })),

      addActivity: (activity) =>
        set((state) => ({
          activities: [
            {
              ...activity,
              id: Math.random().toString(36).substring(2),
              timestamp: Date.now(),
            },
            ...state.activities,
          ].slice(0, 200),
        })),

      clearActivities: () => set({ activities: [] }),

      setActiveTab: (tab) => set({ activeTab: tab }),
    }),
    {
      name: 'deriv-trading-bot-storage',
      partialize: (state) => ({
        auth: { token: state.auth.token, isDemo: state.auth.isDemo },
        rules: state.rules,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>;
        return {
          ...currentState,
          ...persisted,
          auth: {
            ...currentState.auth,
            ...(persisted?.auth || {}),
          },
        };
      },
    }
  )
);
