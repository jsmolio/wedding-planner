import { supabase } from '@/config/supabase';
import type { Guest } from '@/types/database';

export async function fetchGuests(weddingId: string) {
  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Guest[];
}

export async function createGuest(guest: Partial<Guest> & { wedding_id: string; full_name: string }) {
  const { data, error } = await supabase
    .from('guests')
    .insert(guest)
    .select()
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function updateGuest(id: string, updates: Partial<Guest>) {
  const { data, error } = await supabase
    .from('guests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Guest;
}

export async function deleteGuest(id: string) {
  const { error } = await supabase.from('guests').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteGuests(ids: string[]) {
  const { error } = await supabase.from('guests').delete().in('id', ids);
  if (error) throw error;
}
