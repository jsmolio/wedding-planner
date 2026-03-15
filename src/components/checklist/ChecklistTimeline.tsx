import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChecklistItem } from '@/components/checklist/ChecklistItem';
import type { ChecklistItem as ChecklistItemType } from '@/types/database';

interface ChecklistTimelineProps {
  items: ChecklistItemType[];
  onToggle: (id: string, isCompleted: boolean) => void;
  onEdit: (item: ChecklistItemType) => void;
  onDelete: (id: string) => void;
}

const TIME_PERIOD_ORDER = [
  '12+ months before',
  '9-12 months before',
  '6-9 months before',
  '4-6 months before',
  '2-4 months before',
  '1-2 months before',
  '2-4 weeks before',
  '1-2 weeks before',
  'Week of',
  'Day of',
  'After the wedding',
];

interface PeriodGroup {
  period: string;
  items: ChecklistItemType[];
  completedCount: number;
  totalCount: number;
}

function groupByTimePeriod(items: ChecklistItemType[]): PeriodGroup[] {
  const groupMap = new Map<string, ChecklistItemType[]>();

  for (const item of items) {
    const existing = groupMap.get(item.time_period);
    if (existing) {
      existing.push(item);
    } else {
      groupMap.set(item.time_period, [item]);
    }
  }

  const sortedPeriods = Array.from(groupMap.keys()).sort((a, b) => {
    const indexA = TIME_PERIOD_ORDER.indexOf(a);
    const indexB = TIME_PERIOD_ORDER.indexOf(b);
    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
  });

  return sortedPeriods.map((period) => {
    const periodItems = groupMap.get(period)!;
    return {
      period,
      items: periodItems,
      completedCount: periodItems.filter((i) => i.is_completed).length,
      totalCount: periodItems.length,
    };
  });
}

function getProgressColor(completed: number, total: number): 'primary' | 'green' | 'yellow' | 'red' {
  if (total === 0) return 'primary';
  const ratio = completed / total;
  if (ratio === 1) return 'green';
  if (ratio >= 0.5) return 'primary';
  if (ratio > 0) return 'yellow';
  return 'red';
}

export function ChecklistTimeline({ items, onToggle, onEdit, onDelete }: ChecklistTimelineProps) {
  const groups = groupByTimePeriod(items);
  const [collapsedPeriods, setCollapsedPeriods] = useState<Set<string>>(new Set());

  const toggleCollapse = (period: string) => {
    setCollapsedPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) {
        next.delete(period);
      } else {
        next.add(period);
      }
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-gray-500">
        <p className="text-sm">No checklist items to display.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const isCollapsed = collapsedPeriods.has(group.period);
        const progressColor = getProgressColor(group.completedCount, group.totalCount);

        return (
          <div key={group.period} className="rounded-xl border border-gray-200 bg-white">
            <button
              onClick={() => toggleCollapse(group.period)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-gray-50"
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-gray-400" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-sm font-semibold text-gray-900">{group.period}</h3>
                  <span className="shrink-0 text-xs text-gray-500">
                    {group.completedCount}/{group.totalCount} completed
                  </span>
                </div>
                <div className="mt-2">
                  <ProgressBar
                    value={group.completedCount}
                    max={group.totalCount}
                    color={progressColor}
                    showLabel={false}
                  />
                </div>
              </div>
            </button>

            {!isCollapsed && (
              <div className="space-y-2 border-t border-gray-100 p-4">
                {group.items.map((item) => (
                  <ChecklistItem
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
