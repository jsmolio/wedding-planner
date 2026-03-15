import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeSubscription(
  table: string,
  queryKey: readonly unknown[],
  filter?: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let channel: RealtimeChannel;

    const channelConfig: Record<string, string> = {
      event: '*',
      schema: 'public',
      table,
    };
    if (filter) channelConfig.filter = filter;

    channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as never,
        channelConfig,
        () => {
          queryClient.invalidateQueries({ queryKey: [...queryKey] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, queryClient, filter, ...queryKey]);
}
