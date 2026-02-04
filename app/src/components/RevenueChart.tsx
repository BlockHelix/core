'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MockRevenueDataPoint } from '@/lib/mock';
import { formatUSDC } from '@/lib/format';

interface RevenueChartProps {
  data: MockRevenueDataPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="bg-helix-card border border-helix-border rounded-lg p-6">
      <h3 className="text-lg font-data text-helix-primary mb-6">Revenue (Last 30 Days)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            tickLine={{ stroke: '#1e1e2e' }}
            axisLine={{ stroke: '#1e1e2e' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 12, fontFamily: 'var(--font-jetbrains-mono)' }}
            tickLine={{ stroke: '#1e1e2e' }}
            axisLine={{ stroke: '#1e1e2e' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1117',
              border: '1px solid #1e1e2e',
              borderRadius: '6px',
              fontFamily: 'var(--font-jetbrains-mono)',
              fontSize: '14px',
            }}
            labelStyle={{ color: '#a1a1aa' }}
            itemStyle={{ color: '#22d3ee' }}
            formatter={(value: number | undefined) => value !== undefined ? [`$${formatUSDC(value)}`, 'Revenue'] : ['-', 'Revenue']}
            labelFormatter={(label) => {
              const date = new Date(label);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
