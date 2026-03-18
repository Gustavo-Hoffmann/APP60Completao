alter table public.participants
  add column if not exists cpf text,
  add column if not exists cep text,
  add column if not exists street text,
  add column if not exists number text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists complement text;

create unique index if not exists participants_cpf_unique_idx
  on public.participants (cpf)
  where cpf is not null;

create index if not exists participants_birth_date_idx
  on public.participants (birth_date);

create index if not exists participants_city_idx
  on public.participants (city);

create index if not exists participants_state_idx
  on public.participants (state);