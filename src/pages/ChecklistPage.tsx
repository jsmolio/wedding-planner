import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ListChecks, Sparkles } from 'lucide-react';
import { useWedding } from '@/contexts/WeddingContext';
import { useChatAction } from '@/contexts/ChatContext';
import { queryKeys } from '@/lib/queryKeys';
import { fetchChecklist, toggleChecklistItem, deleteChecklistItem } from '@/lib/queries/checklist';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Select } from '@/components/ui/Select';
import { ChecklistTimeline } from '@/components/checklist/ChecklistTimeline';
import { ChecklistForm } from '@/components/checklist/ChecklistForm';
import type { ChecklistItem } from '@/types/database';

type FilterMode = 'all' | 'pending' | 'completed';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Tasks' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

export default function ChecklistPage() {
  const { weddingId } = useWedding();
  const { openChatForPage } = useChatAction();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterMode>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: queryKeys.checklist(weddingId!),
    queryFn: () => fetchChecklist(weddingId!),
    enabled: Boolean(weddingId),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      toggleChecklistItem(id, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist(weddingId!) });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteChecklistItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklist(weddingId!) });
    },
  });

  const filteredItems = useMemo(() => {
    switch (filter) {
      case 'pending':
        return items.filter((item) => !item.is_completed);
      case 'completed':
        return items.filter((item) => item.is_completed);
      default:
        return items;
    }
  }, [items, filter]);

  const completedCount = items.filter((item) => item.is_completed).length;
  const totalCount = items.length;

  const handleToggle = (id: string, isCompleted: boolean) => {
    toggleMutation.mutate({ id, isCompleted });
  };

  const handleEdit = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingItem(null);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormOpen(true);
  };

  if (!weddingId) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">No wedding selected.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListChecks className="h-7 w-7 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Wedding Checklist</h1>
        </div>
        <Button variant="clementine" onClick={openChatForPage}>
          <Sparkles className="w-4 h-4" />
          Ask Clementine
        </Button>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </div>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Overall Progress</h2>
            <span className="text-sm text-gray-500">
              {completedCount} of {totalCount} tasks completed
            </span>
          </div>
          <ProgressBar
            value={completedCount}
            max={totalCount || 1}
            color={totalCount > 0 && completedCount === totalCount ? 'green' : 'primary'}
          />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {filteredItems.length} of {totalCount} tasks
        </p>
        <div className="w-40">
          <Select
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterMode)}
          />
        </div>
      </div>

      <ChecklistTimeline
        items={filteredItems}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ChecklistForm
        open={formOpen}
        onClose={handleCloseForm}
        item={editingItem}
        weddingId={weddingId}
      />
    </div>
  );
}
