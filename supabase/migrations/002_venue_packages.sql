-- Add website_url and packages columns to venues table
alter table public.venues
  add column website_url text not null default '',
  add column packages jsonb not null default '[]'::jsonb;
