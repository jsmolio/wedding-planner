import { supabase } from '@/config/supabase';
import type { SeatingTable } from '@/types/database';

export async function fetchSeatingTables(weddingId: string) {
  const { data, error } = await supabase
    .from('seating_tables')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at');
  if (error) throw error;
  return data as SeatingTable[];
}

export async function createSeatingTable(table: Partial<SeatingTable> & { wedding_id: string; name: string }) {
  const { data, error } = await supabase
    .from('seating_tables')
    .insert(table)
    .select()
    .single();
  if (error) throw error;
  return data as SeatingTable;
}

export async function updateSeatingTable(id: string, updates: Partial<SeatingTable>) {
  const { data, error } = await supabase
    .from('seating_tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as SeatingTable;
}

export async function deleteSeatingTable(id: string) {
  const { error } = await supabase.from('seating_tables').delete().eq('id', id);
  if (error) throw error;
}
