import { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { formatCurrency } from '@/lib/formatters';
import type { BudgetCategory, BudgetExpense } from '@/types/database';

interface BudgetOverviewProps {
  overallBudget: number;
  categories: BudgetCategory[];
  expenses: BudgetExpense[];
}

interface SummaryCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function SummaryCard({ label, value, icon, color }: SummaryCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-gray-900">{value}</p>
      </div>
    </Card>
  );
}

export function BudgetOverview({ overallBudget, categories, expenses }: BudgetOverviewProps) {
  const totals = useMemo(() => {
    const totalAllocated = categories.reduce((sum, c) => sum + c.allocated_amount, 0);
    const totalEstimated = expenses.reduce((sum, e) => sum + e.estimated_cost, 0);
    const totalActual = expenses.reduce((sum, e) => sum + (e.actual_cost ?? 0), 0);
    const totalRemaining = overallBudget - totalActual;

    return { totalAllocated, totalEstimated, totalActual, totalRemaining };
  }, [overallBudget, categories, expenses]);

  const spentPercent = overallBudget > 0 ? (totals.totalActual / overallBudget) * 100 : 0;

  const progressColor: 'green' | 'yellow' | 'red' =
    spentPercent <= 75 ? 'green' : spentPercent <= 100 ? 'yellow' : 'red';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Budget"
          value={formatCurrency(overallBudget)}
          icon={<DollarSign className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <SummaryCard
          label="Total Allocated"
          value={formatCurrency(totals.totalAllocated)}
          icon={<Wallet className="w-6 h-6 text-purple-600" />}
          color="bg-purple-50"
        />
        <SummaryCard
          label="Total Estimated"
          value={formatCurrency(totals.totalEstimated)}
          icon={<TrendingUp className="w-6 h-6 text-amber-600" />}
          color="bg-amber-50"
        />
        <SummaryCard
          label="Total Actual"
          value={formatCurrency(totals.totalActual)}
          icon={<TrendingDown className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
        />
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Budget Spent</h3>
            <span className="text-sm text-gray-500">
              {formatCurrency(totals.totalActual)} of {formatCurrency(overallBudget)}
            </span>
          </div>
          <ProgressBar value={totals.totalActual} max={overallBudget} color={progressColor} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Remaining: <span className="font-medium text-gray-900">{formatCurrency(totals.totalRemaining)}</span>
            </span>
            <span className="text-gray-500">
              Unallocated:{' '}
              <span className="font-medium text-gray-900">
                {formatCurrency(overallBudget - totals.totalAllocated)}
              </span>
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-medium text-gray-700 mb-4">Category Breakdown</h3>
        <div className="space-y-4">
          {categories.map((category) => {
            const categoryExpenses = expenses.filter((e) => e.category_id === category.id);
            const spent = categoryExpenses.reduce((sum, e) => sum + (e.actual_cost ?? 0), 0);
            const allocated = category.allocated_amount;

            return (
              <div key={category.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">{category.name}</span>
                  <span className="text-gray-500">
                    {formatCurrency(spent)} / {formatCurrency(allocated)}
                  </span>
                </div>
                <ProgressBar
                  value={spent}
                  max={allocated || 1}
                  color={allocated > 0 && spent > allocated ? 'red' : 'primary'}
                />
              </div>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No budget categories yet. Add categories to start tracking your budget.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
