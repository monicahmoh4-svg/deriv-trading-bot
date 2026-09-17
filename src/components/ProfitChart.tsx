'use client';

import { useStore } from '@/lib/store';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ProfitChart() {
  const { bot } = useStore();

  let cumulative = 0;
  const closedTrades = bot.trades.filter(t => t.status === 'closed');
  const data = closedTrades.map((entry, idx) => {
    const pnl = entry.profitLoss || 0;
    cumulative += pnl;
    return { name: `Trade ${idx + 1}`, profit: Math.round(cumulative * 100) / 100, pnl };
  });

  if (data.length === 0) {
    data.push({ name: 'Start', profit: 0, pnl: 0 });
  }

  return (
    <div className="glass-card p-4 sm:p-6 card-premium">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <svg className="w-4 h-4 text-brand-emerald" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Cumulative Profit
        </h2>
        <span className={`text-sm font-bold ${(bot.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {(bot.pnl ?? 0) >= 0 ? '+' : ''}${(bot.pnl ?? 0).toFixed(2)}
        </span>
      </div>

      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} />
            <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
              itemStyle={{ color: '#f1f5f9' }}
            />
            <Area type="monotone" dataKey="profit" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
