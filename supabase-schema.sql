-- Run this once in Supabase Dashboard > SQL Editor.
-- The browser uses the publishable key, so these policies are intentionally limited
-- to the two app tables and do not expose any other project data.

create table if not exists public.interview_slots (
  id text primary key,
  date text not null,
  time text not null,
  duration integer not null default 30,
  interviewers jsonb not null default '[]'::jsonb,
  bookings jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_members (
  name text primary key,
  created_at timestamptz not null default now()
);

alter table public.interview_slots enable row level security;
alter table public.interview_members enable row level security;

drop policy if exists "Public can read interview slots" on public.interview_slots;
drop policy if exists "Public can create interview slots" on public.interview_slots;
drop policy if exists "Public can update interview slots" on public.interview_slots;
drop policy if exists "Public can delete interview slots" on public.interview_slots;
create policy "Public can read interview slots" on public.interview_slots for select to anon, authenticated using (true);
create policy "Public can create interview slots" on public.interview_slots for insert to anon, authenticated with check (true);
create policy "Public can update interview slots" on public.interview_slots for update to anon, authenticated using (true) with check (true);
create policy "Public can delete interview slots" on public.interview_slots for delete to anon, authenticated using (true);

drop policy if exists "Public can read interview members" on public.interview_members;
drop policy if exists "Public can create interview members" on public.interview_members;
drop policy if exists "Public can update interview members" on public.interview_members;
drop policy if exists "Public can delete interview members" on public.interview_members;
create policy "Public can read interview members" on public.interview_members for select to anon, authenticated using (true);
create policy "Public can create interview members" on public.interview_members for insert to anon, authenticated with check (true);
create policy "Public can update interview members" on public.interview_members for update to anon, authenticated using (true) with check (true);
create policy "Public can delete interview members" on public.interview_members for delete to anon, authenticated using (true);

-- Enable realtime broadcasts for cross-device updates.
alter publication supabase_realtime add table public.interview_slots;
alter publication supabase_realtime add table public.interview_members;
