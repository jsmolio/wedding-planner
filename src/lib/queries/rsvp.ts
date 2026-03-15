import { supabase } from '@/config/supabase';
import type { RsvpToken, Guest } from '@/types/database';

export async function fetchRsvpTokens(weddingId: string) {
  const { data, error } = await supabase
    .from('rsvp_tokens')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as RsvpToken[];
}

export async function createRsvpToken(weddingId: string, guestIds: string[]) {
  const { data, error } = await supabase
    .from('rsvp_tokens')
    .insert({ wedding_id: weddingId, guest_ids: guestIds })
    .select()
    .single();
  if (error) throw error;
  return data as RsvpToken;
}

export async function fetchRsvpByToken(token: string) {
  const { data: tokenData, error: tokenError } = await supabase
    .from('rsvp_tokens')
    .select('*')
    .eq('token', token)
    .single();
  if (tokenError) throw tokenError;

  const rsvpToken = tokenData as RsvpToken;

  // Fetch guests associated with this token
  const { data: guests, error: guestsError } = await supabase
    .from('guests')
    .select('*')
    .in('id', rsvpToken.guest_ids);
  if (guestsError) throw guestsError;

  // Fetch wedding info
  const { data: wedding, error: weddingError } = await supabase
    .from('weddings')
    .select('partner1_name, partner2_name, wedding_date, rsvp_deadline')
    .eq('id', rsvpToken.wedding_id)
    .single();
  if (weddingError) throw weddingError;

  return { token: rsvpToken, guests: guests as Guest[], wedding };
}

export async function submitRsvp(
  token: string,
  responses: Array<{
    guest_id: string;
    rsvp_status: 'accepted' | 'declined';
    dietary_restrictions?: string;
    meal_choice?: string;
    plus_one_name?: string;
    rsvp_message?: string;
  }>
) {
  // Use Edge Function for public RSVP submission
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/submit-rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, responses }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit RSVP');
  }
  return res.json();
}
