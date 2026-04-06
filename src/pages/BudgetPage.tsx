import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, LayoutGrid, List, PieChart, Loader2, Sparkles } from 'lucide-react';
import { useWedding } from '@/contexts/WeddingContext';
import { useChatAction } from '@/contexts/ChatContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchBudgetCategories, fetchBudgetExpenses } from '@/lib/queries/budget';
import { BudgetOverview } from '@/components/budget/BudgetOverview';
import { CategoryList } from '@/components/budget/CategoryList';
import { ExpenseTable } from '@/components/budget/ExpenseTable';
import { BudgetCharts } from '@/components/budget/BudgetCharts';
import { Button } from '@/components/ui/Button';

type Tab = 'overview' | 'categories' | 'expenses' | 'charts';

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'categories', label: 'Categories', icon: <List className="w-4 h-4" /> },
  { id: 'expenses', label: 'Expenses', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'charts', label: 'Charts', icon: <PieChart className="w-4 h-4" /> },
];

export default function BudgetPage() {
  const { wedding, weddingId } = useWedding();
  const { openChatForPage } = useChatAction();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const {
    data: categories = [],
    isLoading: loadingCategories,
  } = useQuery({
    queryKey: queryKeys.budgetCategories(weddingId!),
    queryFn: () => fetchBudgetCategories(weddingId!),
    enabled: !!weddingId,
  });

  const {
    data: expenses = [],
    isLoading: loadingExpenses,
  } = useQuery({
    queryKey: queryKeys.budgetExpenses(weddingId!),
    queryFn: () => fetchBudgetExpenses(weddingId!),
    enabled: !!weddingId,
  });

  if (!weddingId || !wedding) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">No wedding selected.</p>
      </div>
    );
  }

  const isLoading = loadingCategories || loadingExpenses;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage your wedding budget across categories.
          </p>
        </div>
        <Button variant="clementine" onClick={openChatForPage}>
          <Sparkles className="w-4 h-4" />
          Ask Clementine
        </Button>
      </div>

      <nav className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            className={`rounded-none border-b-2 px-4 py-2.5 ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </nav>

      <div>
        {activeTab === 'overview' && (
          <BudgetOverview
            overallBudget={wedding.overall_budget}
            categories={categories}
            expenses={expenses}
          />
        )}
        {activeTab === 'categories' && (
          <CategoryList categories={categories} weddingId={weddingId} />
        )}
        {activeTab === 'expenses' && (
          <ExpenseTable
            expenses={expenses}
            categories={categories}
            weddingId={weddingId}
          />
        )}
        {activeTab === 'charts' && (
          <BudgetCharts categories={categories} expenses={expenses} />
        )}
      </div>
    </div>
  );
}
