-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Weddings table
create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  partner1_name text not null default '',
  partner2_name text not null default '',
  wedding_date date,
  overall_budget numeric not null default 0,
  rsvp_deadline date,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Wedding members (links users to wedding)
create table public.wedding_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'partner')),
  created_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

-- Helper function for RLS
create or replace function public.user_has_wedding_access(w_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = w_id and user_id = auth.uid()
  );
$$ language sql security definer stable;

-- Seating Tables (before guests, since guests references this)
create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  name text not null,
  shape text not null default 'round' check (shape in ('round', 'rectangular')),
  capacity integer not null default 8,
  position_x numeric not null default 0,
  position_y numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Venues
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  name text not null,
  address text not null default '',
  capacity integer,
  cost numeric,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  notes text not null default '',
  photo_urls text[] not null default '{}',
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Guests
create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  full_name text not null,
  email text not null default '',
  phone text not null default '',
  address text not null default '',
  side text not null default 'mutual' check (side in ('partner1', 'partner2', 'mutual')),
  group_name text not null default '',
  has_plus_one boolean not null default false,
  plus_one_name text not null default '',
  dietary_restrictions text not null default '',
  meal_choice text not null default '',
  rsvp_status text not null default 'pending' check (rsvp_status in ('pending', 'accepted', 'declined')),
  rsvp_message text not null default '',
  table_id uuid references public.seating_tables on delete set null,
  seat_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RSVP Tokens
create table public.rsvp_tokens (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  guest_ids uuid[] not null default '{}',
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  is_used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Budget Categories
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  name text not null,
  allocated_amount numeric not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Budget Expenses
create table public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  category_id uuid not null references public.budget_categories on delete cascade,
  description text not null,
  estimated_cost numeric not null default 0,
  actual_cost numeric,
  is_paid boolean not null default false,
  due_date date,
  vendor_name text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Checklist Items
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  title text not null,
  description text not null default '',
  due_date date,
  is_completed boolean not null default false,
  time_period text not null default '',
  sort_order integer not null default 0,
  is_custom boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity Log
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings on delete cascade,
  user_id uuid references auth.users on delete set null,
  action text not null,
  entity_type text not null default '',
  entity_id uuid,
  details text not null default '',
  created_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============

alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.venues enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_tokens enable row level security;
alter table public.seating_tables enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_expenses enable row level security;
alter table public.checklist_items enable row level security;
alter table public.activity_log enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Weddings: access via wedding_members
create policy "Wedding access via membership" on public.weddings
  for all using (public.user_has_wedding_access(id));

-- Wedding Members: users can see their own memberships, insert for invite acceptance
create policy "View own memberships" on public.wedding_members
  for select using (user_id = auth.uid() or public.user_has_wedding_access(wedding_id));
create policy "Insert membership" on public.wedding_members
  for insert with check (user_id = auth.uid());
create policy "Delete membership" on public.wedding_members
  for delete using (public.user_has_wedding_access(wedding_id));

-- All wedding-scoped tables: access via wedding membership
create policy "Venue access" on public.venues for all using (public.user_has_wedding_access(wedding_id));
create policy "Guest access" on public.guests for all using (public.user_has_wedding_access(wedding_id));
create policy "RSVP token access" on public.rsvp_tokens for all using (public.user_has_wedding_access(wedding_id));
create policy "Seating table access" on public.seating_tables for all using (public.user_has_wedding_access(wedding_id));
create policy "Budget category access" on public.budget_categories for all using (public.user_has_wedding_access(wedding_id));
create policy "Budget expense access" on public.budget_expenses for all using (public.user_has_wedding_access(wedding_id));
create policy "Checklist access" on public.checklist_items for all using (public.user_has_wedding_access(wedding_id));
create policy "Activity log access" on public.activity_log for all using (public.user_has_wedding_access(wedding_id));

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ UPDATED_AT TRIGGER ============
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.profiles for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.weddings for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.venues for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.guests for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.seating_tables for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.budget_expenses for each row execute function public.update_updated_at();
create trigger set_updated_at before update on public.checklist_items for each row execute function public.update_updated_at();

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) values ('venue-photos', 'venue-photos', true);

create policy "Authenticated users can upload venue photos"
  on storage.objects for insert
  with check (bucket_id = 'venue-photos' and auth.role() = 'authenticated');

create policy "Anyone can view venue photos"
  on storage.objects for select
  using (bucket_id = 'venue-photos');

create policy "Authenticated users can delete venue photos"
  on storage.objects for delete
  using (bucket_id = 'venue-photos' and auth.role() = 'authenticated');

-- ============ REALTIME ============
alter publication supabase_realtime add table public.guests;
alter publication supabase_realtime add table public.venues;
alter publication supabase_realtime add table public.budget_categories;
alter publication supabase_realtime add table public.budget_expenses;
alter publication supabase_realtime add table public.checklist_items;
alter publication supabase_realtime add table public.seating_tables;
alter publication supabase_realtime add table public.activity_log;
