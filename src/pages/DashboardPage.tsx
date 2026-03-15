import { useQuery } from '@tanstack/react-query';
import { useWedding } from '@/contexts/WeddingContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchGuests } from '@/lib/queries/guests';
import { fetchBudgetExpenses } from '@/lib/queries/budget';
import { fetchChecklist } from '@/lib/queries/checklist';
import { CountdownTimer } from '@/components/dashboard/CountdownTimer';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { CheckSquare } from 'lucide-react';


export default function DashboardPage() {
  const { wedding, weddingId } = useWedding();

  const { data: guests = [] } = useQuery({
    queryKey: queryKeys.guests(weddingId!),
    queryFn: () => fetchGuests(weddingId!),
    enabled: !!weddingId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: queryKeys.budgetExpenses(weddingId!),
    queryFn: () => fetchBudgetExpenses(weddingId!),
    enabled: !!weddingId,
  });

  const { data: checklist = [] } = useQuery({
    queryKey: queryKeys.checklist(weddingId!),
    queryFn: () => fetchChecklist(weddingId!),
    enabled: !!weddingId,
  });

  if (!wedding || !weddingId) return null;

  const completedTasks = checklist.filter((t) => t.is_completed).length;
  const upcomingTasks = checklist
    .filter((t) => !t.is_completed)
    .sort((a, b) => (a.sort_order) - (b.sort_order))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {wedding.wedding_date && (
        <CountdownTimer
          weddingDate={wedding.wedding_date}
          partner1={wedding.partner1_name}
          partner2={wedding.partner2_name}
        />
      )}

      <QuickStats
        guests={guests}
        expenses={expenses}
        overallBudget={wedding.overall_budget}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Tasks */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-gray-500" />
              <h3 className="font-semibold">Upcoming Tasks</h3>
            </div>
            <span className="text-sm text-gray-400">
              {completedTasks}/{checklist.length} done
            </span>
          </div>
          <ProgressBar
            value={completedTasks}
            max={checklist.length || 1}
            color="green"
            className="mb-4"
          />
          <div className="space-y-2">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-gray-400">All tasks completed!</p>
            ) : (
              upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm">{task.title}</span>
                  <Badge>{task.time_period}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Activity Feed */}
        <ActivityFeed weddingId={weddingId} />
      </div>

      {/* Budget Summary */}
      <Card>
        <h3 className="font-semibold mb-3">Budget Summary</h3>
        {(() => {
          const totalEstimated = expenses.reduce((s, e) => s + e.estimated_cost, 0);
          const totalActual = expenses.reduce((s, e) => s + (e.actual_cost ?? 0), 0);
          const totalSpent = expenses.reduce((s, e) => s + (e.actual_cost ?? e.estimated_cost), 0);
          return (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Overall Budget</span>
                <span className="font-medium">${wedding.overall_budget.toLocaleString()}</span>
              </div>
              <ProgressBar
                value={totalSpent}
                max={wedding.overall_budget || 1}
                color={totalSpent > wedding.overall_budget ? 'red' : 'primary'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>Estimated: ${totalEstimated.toLocaleString()}</span>
                <span>Actual: ${totalActual.toLocaleString()}</span>
              </div>
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
