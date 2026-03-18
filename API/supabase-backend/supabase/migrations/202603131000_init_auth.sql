do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('ADMIN', 'PROFESSOR', 'ALUNO');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique,
  role public.user_role not null default 'ALUNO',
  professor_id uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx
  on public.profiles(role);

create index if not exists profiles_professor_id_idx
  on public.profiles(professor_id);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  birth_date date,
  sex text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  owner_student_id uuid references public.profiles(id) on delete set null,
  owner_professor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists participants_owner_student_id_idx
  on public.participants(owner_student_id);

create index if not exists participants_owner_professor_id_idx
  on public.participants(owner_professor_id);

create index if not exists participants_created_by_idx
  on public.participants(created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_participants_updated_at on public.participants;
create trigger set_participants_updated_at
before update on public.participants
for each row
execute function public.set_updated_at();