'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ExpenseSlice {
  name: string
  value: number
}

interface ExpenseDonutChartProps {
  data: ExpenseSlice[]
}

// Monochrome palette: dark → light gray
const COLORS = ['#1a1a1a', '#3d3d3d', '#616161', '#858585', '#a8a8a8', '#cccccc']

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function ExpenseDonutChart({ data }: ExpenseDonutChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No expense data for this period
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="38%"
          cy="50%"
          innerRadius={55}
          outerRadius={82}
          paddingAngle={2}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            `${USD.format(value as number)} (${(((value as number) / total) * 100).toFixed(1)}%)`,
            name as string,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 11, color: '#6b7280' }}>{value as string}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
