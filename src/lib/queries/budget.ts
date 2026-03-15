import { supabase } from '@/config/supabase';
import type { BudgetCategory, BudgetExpense } from '@/types/database';

export async function fetchBudgetCategories(weddingId: string) {
  const { data, error } = await supabase
    .from('budget_categories')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('sort_order');
  if (error) throw error;
  return data as BudgetCategory[];
}

export async function createBudgetCategory(category: { wedding_id: string; name: string; allocated_amount?: number }) {
  const { data, error } = await supabase
    .from('budget_categories')
    .insert(category)
    .select()
    .single();
  if (error) throw error;
  return data as BudgetCategory;
}

export async function updateBudgetCategory(id: string, updates: Partial<BudgetCategory>) {
  const { data, error } = await supabase
    .from('budget_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as BudgetCategory;
}

export async function deleteBudgetCategory(id: string) {
  const { error } = await supabase.from('budget_categories').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBudgetExpenses(weddingId: string) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as BudgetExpense[];
}

export async function createBudgetExpense(expense: Partial<BudgetExpense> & { wedding_id: string; category_id: string; description: string }) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .insert(expense)
    .select()
    .single();
  if (error) throw error;
  return data as BudgetExpense;
}

export async function updateBudgetExpense(id: string, updates: Partial<BudgetExpense>) {
  const { data, error } = await supabase
    .from('budget_expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as BudgetExpense;
}

export async function deleteBudgetExpense(id: string) {
  const { error } = await supabase.from('budget_expenses').delete().eq('id', id);
  if (error) throw error;
}
