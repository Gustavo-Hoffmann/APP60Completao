alter table public.profiles
  add column if not exists cpf text,
  add column if not exists phone text,
  add column if not exists institution text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists birth_date date;

create unique index if not exists profiles_cpf_unique_idx
  on public.profiles (cpf)
  where cpf is not null;

create index if not exists profiles_birth_date_idx
  on public.profiles (birth_date);

create index if not exists profiles_state_idx
  on public.profiles (state);