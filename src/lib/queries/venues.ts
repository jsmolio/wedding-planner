import { supabase } from '@/config/supabase';
import type { Venue, VenuePackage } from '@/types/database';

export interface ScrapedVenueData {
  name?: string;
  address?: string;
  capacity?: number | null;
  cost?: number | null;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
  packages?: VenuePackage[];
  photo_urls?: string[];
}

export async function fetchVenues(weddingId: string) {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('wedding_id', weddingId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Venue[];
}

export async function createVenue(venue: Partial<Venue> & { wedding_id: string; name: string }) {
  const { data, error } = await supabase
    .from('venues')
    .insert(venue)
    .select()
    .single();
  if (error) throw error;
  return data as Venue;
}

export async function updateVenue(id: string, updates: Partial<Venue>) {
  const { data, error } = await supabase
    .from('venues')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Venue;
}

export async function deleteVenue(id: string) {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) throw error;
}

export async function selectVenue(weddingId: string, venueId: string) {
  // Deselect all venues first
  await supabase.from('venues').update({ is_selected: false }).eq('wedding_id', weddingId);
  // Select the chosen one
  const { data, error } = await supabase
    .from('venues')
    .update({ is_selected: true })
    .eq('id', venueId)
    .select()
    .single();
  if (error) throw error;
  return data as Venue;
}

export async function unselectVenue(venueId: string) {
  const { data, error } = await supabase
    .from('venues')
    .update({ is_selected: false })
    .eq('id', venueId)
    .select()
    .single();
  if (error) throw error;
  return data as Venue;
}

export async function scrapeVenueWebsite(url: string): Promise<ScrapedVenueData> {
  const { data, error } = await supabase.functions.invoke('scrape-venue', {
    body: { url },
  });
  if (error) throw error;
  return data as ScrapedVenueData;
}

export async function uploadVenuePhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('venue-photos').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('venue-photos').getPublicUrl(path);
  return data.publicUrl;
}
