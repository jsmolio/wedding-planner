import { supabase } from '@/config/supabase';
import type { Conversation, ConversationMessage } from '@/types/database';

export async function fetchConversations(weddingId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data as Conversation[];
}

export async function createConversation(weddingId: string, title = 'New conversation') {
  const { data, error } = await supabase
    .from('conversations')
    .insert({ wedding_id: weddingId, title })
    .select()
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function updateConversationTitle(id: string, title: string) {
  const { error } = await supabase
    .from('conversations')
    .update({ title })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from('conversations').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMessages(conversationId: string) {
  const { data, error } = await supabase
    .from('conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as ConversationMessage[];
}

export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolSteps?: { label: string; timestamp: number }[],
) {
  const { error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      tool_steps: toolSteps ?? null,
    });
  if (error) throw error;
}
