import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWedding } from '@/contexts/WeddingContext';
import { useChatAction } from '@/contexts/ChatContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchGuests } from '@/lib/queries/guests';
import { fetchBudgetExpenses } from '@/lib/queries/budget';
import { fetchChecklist } from '@/lib/queries/checklist';
import { CountdownTimer } from '@/components/dashboard/CountdownTimer';
import { QuickStats } from '@/components/dashboard/QuickStats';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { ClementineLogo } from '@/components/ui/Logo';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { CheckSquare } from 'lucide-react';


export default function DashboardPage() {
  const { wedding, weddingId, loading: weddingLoading } = useWedding();
  const { openChatForPage } = useChatAction();

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

  const completedTasks = checklist.filter((t) => t.is_completed).length;
  const upcomingTasks = checklist
    .filter((t) => !t.is_completed)
    .sort((a, b) => (a.sort_order) - (b.sort_order))
    .slice(0, 5);

  const overallBudget = wedding?.overall_budget || 0;
  const insights = useMemo(() => {
    const tips: string[] = [];
    const pending = guests.filter(g => g.rsvp_status === 'pending').length;
    if (pending > 0) tips.push(`You have **${pending} pending RSVP${pending > 1 ? 's'  : ''}** — want me to help follow up?`);
    const totalSpent = expenses.reduce((s, e) => s + (e.actual_cost || e.estimated_cost || 0), 0);
    if (overallBudget > 0 && totalSpent / overallBudget > 0.8) tips.push(`You've used **${Math.round(totalSpent / overallBudget * 100)}%** of your budget. I can help review where to save.`);
    if (overallBudget > 0 && totalSpent / overallBudget < 0.2 && expenses.length < 3) tips.push(`Your budget tracking looks light — upload receipts or tell me about expenses to stay on top of things.`);
    const overdue = checklist.filter(t => !t.is_completed && t.due_date && new Date(t.due_date) < new Date()).length;
    if (overdue > 0) tips.push(`**${overdue} task${overdue > 1 ? 's are' : ' is'} past due** on your checklist. Let's review what to prioritize.`);
    if (guests.length === 0) tips.push(`Your guest list is empty! I can help you import guests from a spreadsheet.`);
    if (tips.length === 0) tips.push(`Everything's looking great! Let me know if you need help with anything.`);
    return tips.slice(0, 3);
  }, [guests, expenses, checklist, overallBudget]);

  if (weddingLoading || !wedding || !weddingId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center mx-auto animate-pulse">
            <ClementineLogo className="w-7 h-7" />
          </div>
          <p className="text-sm text-gray-500">Setting up your wedding...</p>
        </div>
      </div>
    );
  }

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

      {/* Clementine Insights */}
      <div
        className="rounded-xl border border-accent-200 bg-gradient-to-r from-accent-50 to-white p-4 flex items-start gap-4 cursor-pointer hover:border-accent-300 transition-colors"
        onClick={openChatForPage}
      >
        <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-500 flex items-center justify-center shrink-0">
          <ClementineLogo className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Clementine's Notes</h3>
          <ul className="space-y-1">
            {insights.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600" dangerouslySetInnerHTML={{
                __html: tip.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              }} />
            ))}
          </ul>
        </div>
      </div>

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
