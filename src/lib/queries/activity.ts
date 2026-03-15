import { supabase } from '@/config/supabase';
import type { ActivityLog } from '@/types/database';

export async function fetchActivityLog(weddingId: string, limit = 20) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as ActivityLog[];
}

export async function logActivity(entry: {
  wedding_id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: string;
}) {
  const { error } = await supabase.from('activity_log').insert(entry);
  if (error) throw error;
}
