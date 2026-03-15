import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import {
  createBudgetExpense,
  updateBudgetExpense,
  deleteBudgetExpense,
} from '@/lib/queries/budget';
import type { BudgetCategory, BudgetExpense } from '@/types/database';

interface ExpenseTableProps {
  expenses: BudgetExpense[];
  categories: BudgetCategory[];
  weddingId: string;
}

interface ExpenseFormData {
  category_id: string;
  description: string;
  vendor_name: string;
  estimated_cost: string;
  actual_cost: string;
  is_paid: boolean;
  due_date: string;
}

const emptyForm: ExpenseFormData = {
  category_id: '',
  description: '',
  vendor_name: '',
  estimated_cost: '',
  actual_cost: '',
  is_paid: false,
  due_date: '',
};

export function ExpenseTable({ expenses, categories, weddingId }: ExpenseTableProps) {
  const queryClient = useQueryClient();
  const [showAddRow, setShowAddRow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormData>(emptyForm);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.budgetExpenses(weddingId) });
  };

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createBudgetExpense>[0]) => createBudgetExpense(data),
    onSuccess: () => {
      invalidate();
      setShowAddRow(false);
      setForm(emptyForm);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BudgetExpense> }) =>
      updateBudgetExpense(id, updates),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudgetExpense(id),
    onSuccess: invalidate,
  });

  const grouped = useMemo(() => {
    const groups = new Map<string, BudgetExpense[]>();
    for (const expense of expenses) {
      const list = groups.get(expense.category_id) || [];
      list.push(expense);
      groups.set(expense.category_id, list);
    }
    return groups;
  }, [expenses]);

  const categoryOptions = [
    { value: '', label: 'Select category' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  function updateField(field: keyof ExpenseFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleAdd() {
    if (!form.description.trim() || !form.category_id) return;
    createMutation.mutate({
      wedding_id: weddingId,
      category_id: form.category_id,
      description: form.description.trim(),
      vendor_name: form.vendor_name.trim(),
      estimated_cost: parseFloat(form.estimated_cost) || 0,
      actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
      is_paid: form.is_paid,
      due_date: form.due_date || null,
    });
  }

  function startEditing(expense: BudgetExpense) {
    setEditingId(expense.id);
    setForm({
      category_id: expense.category_id,
      description: expense.description,
      vendor_name: expense.vendor_name,
      estimated_cost: String(expense.estimated_cost),
      actual_cost: expense.actual_cost != null ? String(expense.actual_cost) : '',
      is_paid: expense.is_paid,
      due_date: expense.due_date ?? '',
    });
  }

  function saveEdit(id: string) {
    if (!form.description.trim() || !form.category_id) return;
    updateMutation.mutate({
      id,
      updates: {
        category_id: form.category_id,
        description: form.description.trim(),
        vendor_name: form.vendor_name.trim(),
        estimated_cost: parseFloat(form.estimated_cost) || 0,
        actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
        is_paid: form.is_paid,
        due_date: form.due_date || null,
      },
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setShowAddRow(false);
    setForm(emptyForm);
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this expense?')) {
      deleteMutation.mutate(id);
    }
  }

  function renderFormRow(onSave: () => void, isPending: boolean) {
    return (
      <tr className="bg-gray-50">
        <td className="px-4 py-2">
          <Select
            options={categoryOptions}
            value={form.category_id}
            onChange={(e) => updateField('category_id', e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <Input
            placeholder="Vendor"
            value={form.vendor_name}
            onChange={(e) => updateField('vendor_name', e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.estimated_cost}
            onChange={(e) => updateField('estimated_cost', e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            value={form.actual_cost}
            onChange={(e) => updateField('actual_cost', e.target.value)}
          />
        </td>
        <td className="px-4 py-2 text-center">
          <input
            type="checkbox"
            checked={form.is_paid}
            onChange={(e) => updateField('is_paid', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        </td>
        <td className="px-4 py-2">
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => updateField('due_date', e.target.value)}
          />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onSave} loading={isPending}>
              <Check className="w-4 h-4 text-green-600" />
            </Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="w-4 h-4 text-gray-500" />
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Expenses</h2>
        <Button
          size="sm"
          onClick={() => {
            setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' });
            setShowAddRow(true);
          }}
          disabled={showAddRow || categories.length === 0}
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-400 text-center py-4">
            Create budget categories before adding expenses.
          </p>
        </Card>
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Estimated</th>
                  <th className="px-4 py-3 font-medium">Actual</th>
                  <th className="px-4 py-3 font-medium text-center">Paid</th>
                  <th className="px-4 py-3 font-medium">Due Date</th>
                  <th className="px-4 py-3 font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {showAddRow && renderFormRow(handleAdd, createMutation.isPending)}

                {categories.map((category) => {
                  const categoryExpenses = grouped.get(category.id);
                  if (!categoryExpenses || categoryExpenses.length === 0) return null;

                  return categoryExpenses.map((expense, idx) => {
                    if (editingId === expense.id) {
                      return renderFormRow(
                        () => saveEdit(expense.id),
                        updateMutation.isPending
                      );
                    }

                    return (
                      <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                        {idx === 0 ? (
                          <td
                            className="px-4 py-3 font-medium text-gray-700 align-top"
                            rowSpan={categoryExpenses.length}
                          >
                            {category.name}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-gray-900">{expense.description}</td>
                        <td className="px-4 py-3 text-gray-600">{expense.vendor_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatCurrency(expense.estimated_cost)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {expense.actual_cost != null ? formatCurrency(expense.actual_cost) : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={expense.is_paid ? 'success' : 'warning'}>
                            {expense.is_paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {expense.due_date ? formatDate(expense.due_date) : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditing(expense)}
                            >
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(expense.id)}
                              loading={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}

                {expenses.length === 0 && !showAddRow && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No expenses yet. Click "Add Expense" to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
