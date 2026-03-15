import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchActivityLog } from '@/lib/queries/activity';
import { Card } from '@/components/ui/Card';
import { formatRelative } from '@/lib/formatters';
import { Activity } from 'lucide-react';

interface ActivityFeedProps {
  weddingId: string;
}

export function ActivityFeed({ weddingId }: ActivityFeedProps) {
  const { data: activities = [] } = useQuery({
    queryKey: queryKeys.activityLog(weddingId),
    queryFn: () => fetchActivityLog(weddingId),
  });

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-gray-500" />
        <h3 className="font-semibold">Recent Activity</h3>
      </div>
      {activities.length === 0 ? (
        <p className="text-sm text-gray-400">No recent activity</p>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 10).map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary-400 mt-2 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700">{activity.action}</p>
                {activity.details && (
                  <p className="text-xs text-gray-400 truncate">{activity.details}</p>
                )}
                <p className="text-xs text-gray-400">{formatRelative(activity.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
