begin;

create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.my_professor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.professor_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ADMIN'
      and p.is_active = true
  )
$$;

create or replace function public.is_professor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'PROFESSOR'
      and p.is_active = true
  )
$$;

create or replace function public.is_aluno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'ALUNO'
      and p.is_active = true
  )
$$;

revoke all on function public.my_role() from public;
revoke all on function public.my_professor_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_professor() from public;
revoke all on function public.is_aluno() from public;

grant execute on function public.my_role() to authenticated;
grant execute on function public.my_professor_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_professor() to authenticated;
grant execute on function public.is_aluno() to authenticated;

commit;