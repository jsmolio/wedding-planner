import { Check, Calendar, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/formatters';
import type { ChecklistItem as ChecklistItemType } from '@/types/database';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: string, isCompleted: boolean) => void;
  onEdit: (item: ChecklistItemType) => void;
  onDelete: (id: string) => void;
}

const periodVariant: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  '12+ months before': 'info',
  '9-12 months before': 'info',
  '6-9 months before': 'default',
  '4-6 months before': 'default',
  '2-4 months before': 'warning',
  '1-2 months before': 'warning',
  '2-4 weeks before': 'danger',
  '1-2 weeks before': 'danger',
  'Week of': 'danger',
  'Day of': 'success',
  'After the wedding': 'success',
};

export function ChecklistItem({ item, onToggle, onEdit, onDelete }: ChecklistItemProps) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-lg border p-4 transition-colors ${
        item.is_completed
          ? 'border-gray-200 bg-gray-50'
          : 'border-gray-200 bg-white hover:border-primary-200'
      }`}
    >
      <button
        onClick={() => onToggle(item.id, !item.is_completed)}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          item.is_completed
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 hover:border-primary-500'
        }`}
        aria-label={item.is_completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {item.is_completed && <Check className="h-3 w-3" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={`text-sm font-medium ${
                item.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {item.title}
            </p>
            {item.description && (
              <p
                className={`mt-0.5 text-sm ${
                  item.is_completed ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {item.description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="sm" onClick={() => onEdit(item)} aria-label="Edit task">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {item.is_custom && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item.id)}
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={periodVariant[item.time_period] ?? 'default'}>
            {item.time_period}
          </Badge>
          {item.due_date && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Calendar className="h-3 w-3" />
              {formatDate(item.due_date)}
            </span>
          )}
          {item.is_custom && (
            <Badge variant="info">Custom</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
