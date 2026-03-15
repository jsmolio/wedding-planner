import { supabase } from '@/config/supabase';
import type { ChecklistItem } from '@/types/database';

export async function fetchChecklist(weddingId: string) {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('sort_order');
  if (error) throw error;
  return data as ChecklistItem[];
}

export async function createChecklistItem(item: Partial<ChecklistItem> & { wedding_id: string; title: string }) {
  const { data, error } = await supabase
    .from('checklist_items')
    .insert({ ...item, is_custom: true })
    .select()
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

export async function updateChecklistItem(id: string, updates: Partial<ChecklistItem>) {
  const { data, error } = await supabase
    .from('checklist_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

export async function toggleChecklistItem(id: string, isCompleted: boolean) {
  return updateChecklistItem(id, { is_completed: isCompleted });
}

export async function deleteChecklistItem(id: string) {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id);
  if (error) throw error;
}
