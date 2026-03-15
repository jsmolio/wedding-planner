import { Card } from '@/components/ui/Card';
import { Users, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { Guest, BudgetExpense } from '@/types/database';

interface QuickStatsProps {
  guests: Guest[];
  expenses: BudgetExpense[];
  overallBudget: number;
}

export function QuickStats({ guests, expenses, overallBudget }: QuickStatsProps) {
  const totalGuests = guests.length;
  const accepted = guests.filter((g) => g.rsvp_status === 'accepted').length;
  const declined = guests.filter((g) => g.rsvp_status === 'declined').length;
  const pending = guests.filter((g) => g.rsvp_status === 'pending').length;
  const totalSpent = expenses.reduce((sum, e) => sum + (e.actual_cost ?? e.estimated_cost), 0);
  const remaining = overallBudget - totalSpent;

  const stats = [
    { label: 'Total Guests', value: totalGuests, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Accepted', value: accepted, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    { label: 'Declined', value: declined, icon: XCircle, color: 'bg-red-100 text-red-600' },
    { label: 'Pending', value: pending, icon: Clock, color: 'bg-yellow-100 text-yellow-600' },
    {
      label: 'Budget Remaining',
      value: formatCurrency(remaining),
      icon: DollarSign,
      color: remaining >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <Card key={label}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
