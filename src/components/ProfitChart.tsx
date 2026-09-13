'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useStore } from '@/lib/store';

export default function ProfitChart() {
  const { bot } = useStore();

  const chartData = useMemo(() => {
    const data: { time: string; pnl: number; balance: number }[] = [];
    let cumulativePnl = 0;

    const sortedTrades = [...bot.trades]
      .filter((t) => t.status === 'closed')
      .sort((a, b) => a.closeTime! - b.closeTime);

    sortedTrades.forEach((trade) => {
      cumulativePnl += trade.profitLoss || 0;
      data.push({
        time: new Date(trade.closeTime || trade.openTime).toLocaleTimeString(),
        pnl: cumulativePnl,
        balance: 1000 + cumulativePnl,
      });
    });

    if (data.length === 0) {
      data.push({ time: 'Start', pnl: 0, balance: 1000 });
    }

    return data;
  }, [bot.trades]);

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-deriv-text mb-4">Cumulative Profit</h2>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value: number) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111827',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#e2e8f0',
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="#00d4ff"
              strokeWidth={2}
              dot={{ fill: '#00d4ff', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {chartData.length <= 1 && (
        <div className="text-center text-deriv-muted text-sm mt-4">
          Profit data will appear here after closing trades
        </div>
      )}
    </div>
  );
}
