-- Track which guests have been sent save-the-dates and invitations
alter table public.guests
  add column save_the_date_sent boolean not null default false,
  add column invitation_sent boolean not null default false;
