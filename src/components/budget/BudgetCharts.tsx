import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/formatters';
import type { BudgetCategory, BudgetExpense } from '@/types/database';

interface BudgetChartsProps {
  categories: BudgetCategory[];
  expenses: BudgetExpense[];
}

const COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

export function BudgetCharts({ categories, expenses }: BudgetChartsProps) {
  const pieData = useMemo(() => {
    return categories
      .map((category) => {
        const total = expenses
          .filter((e) => e.category_id === category.id)
          .reduce((sum, e) => sum + (e.actual_cost ?? e.estimated_cost), 0);
        return { name: category.name, value: total };
      })
      .filter((d) => d.value > 0);
  }, [categories, expenses]);

  const barData = useMemo(() => {
    return categories.map((category) => {
      const categoryExpenses = expenses.filter((e) => e.category_id === category.id);
      const estimated = categoryExpenses.reduce((sum, e) => sum + e.estimated_cost, 0);
      const actual = categoryExpenses.reduce((sum, e) => sum + (e.actual_cost ?? 0), 0);
      return { name: category.name, estimated, actual };
    });
  }, [categories, expenses]);

  if (categories.length === 0) {
    return (
      <Card>
        <p className="text-sm text-gray-400 text-center py-8">
          Add categories and expenses to see budget charts.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Spend by Category</h3>
        {pieData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No spending data to display yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
              >
                {pieData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => formatCurrency(Number(value))}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Estimated vs Actual</h3>
        {barData.every((d) => d.estimated === 0 && d.actual === 0) ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No expense data to display yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="estimated" name="Estimated" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}
