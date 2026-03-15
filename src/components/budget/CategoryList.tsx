import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatCurrency } from '@/lib/formatters';
import { queryKeys } from '@/lib/queryKeys';
import {
  createBudgetCategory,
  updateBudgetCategory,
  deleteBudgetCategory,
} from '@/lib/queries/budget';
import type { BudgetCategory } from '@/types/database';

interface CategoryListProps {
  categories: BudgetCategory[];
  weddingId: string;
}

export function CategoryList({ categories, weddingId }: CategoryListProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.budgetCategories(weddingId) });
  };

  const createMutation = useMutation({
    mutationFn: (category: { wedding_id: string; name: string; allocated_amount?: number }) =>
      createBudgetCategory(category),
    onSuccess: () => {
      invalidate();
      setShowAddForm(false);
      setNewName('');
      setNewAmount('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BudgetCategory> }) =>
      updateBudgetCategory(id, updates),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBudgetCategory(id),
    onSuccess: invalidate,
  });

  function handleAdd() {
    if (!newName.trim()) return;
    createMutation.mutate({
      wedding_id: weddingId,
      name: newName.trim(),
      allocated_amount: newAmount ? parseFloat(newAmount) : 0,
    });
  }

  function startEditing(category: BudgetCategory) {
    setEditingId(category.id);
    setEditValue(String(category.allocated_amount));
  }

  function saveEdit(id: string) {
    const amount = parseFloat(editValue);
    if (isNaN(amount) || amount < 0) return;
    updateMutation.mutate({ id, updates: { allocated_amount: amount } });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditValue('');
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this category? All associated expenses will also be removed.')) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Budget Categories</h2>
        <Button size="sm" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="w-full sm:w-40">
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} loading={createMutation.isPending}>
                <Check className="w-4 h-4" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewName(''); setNewAmount(''); }}>
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {categories.map((category) => (
          <Card key={category.id} className="flex items-center justify-between">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{category.name}</p>
            </div>
            <div className="flex items-center gap-3">
              {editingId === category.id ? (
                <>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(category.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                    className="w-32"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => saveEdit(category.id)}
                    loading={updateMutation.isPending}
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit}>
                    <X className="w-4 h-4 text-gray-500" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-gray-700 min-w-[5rem] text-right">
                    {formatCurrency(category.allocated_amount)}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => startEditing(category)}>
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(category.id)}
                    loading={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
        {categories.length === 0 && !showAddForm && (
          <Card>
            <p className="text-sm text-gray-400 text-center py-4">
              No categories yet. Click "Add Category" to get started.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
