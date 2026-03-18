create type public.test_kind as enum ('TUG', 'MARCHA', 'LOS', 'SL30S', 'UTT');

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  test_type public.test_kind not null,
  session_number integer not null,
  session_label text generated always as ('S' || session_number) stored,
  raw_file_path text not null,
  platform text not null,
  sampling_hz integer not null default 60,
  performed_at timestamptz,
  uploaded_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (participant_id, test_type, session_number)
);

create index if not exists test_sessions_participant_idx
  on public.test_sessions (participant_id);

create index if not exists test_sessions_type_idx
  on public.test_sessions (test_type);

create index if not exists test_sessions_uploaded_at_idx
  on public.test_sessions (uploaded_at desc);

alter table public.test_sessions enable row level security;

create policy "read test sessions authenticated"
on public.test_sessions
for select
to authenticated
using (true);

create policy "insert test sessions authenticated"
on public.test_sessions
for insert
to authenticated
with check (true);

create policy "update test sessions authenticated"
on public.test_sessions
for update
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('test-data', 'test-data', false)
on conflict (id) do nothing;

create policy "test-data read authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'test-data');

create policy "test-data insert authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'test-data');

create policy "test-data update authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'test-data')
with check (bucket_id = 'test-data');