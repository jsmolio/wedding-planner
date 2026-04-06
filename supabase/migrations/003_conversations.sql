-- Conversations table — groups chat messages per wedding
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_wedding on public.conversations(wedding_id);

-- Conversation messages
create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_steps jsonb,
  created_at timestamptz not null default now()
);

create index idx_conversation_messages_conversation on public.conversation_messages(conversation_id);

-- RLS
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Users can manage their wedding conversations"
  on public.conversations for all
  using (public.user_has_wedding_access(wedding_id));

create policy "Users can manage messages in their conversations"
  on public.conversation_messages for all
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
      and public.user_has_wedding_access(c.wedding_id)
    )
  );

-- Auto-update updated_at on conversations
create trigger update_conversations_updated_at
  before update on public.conversations
  for each row execute function update_updated_at();
