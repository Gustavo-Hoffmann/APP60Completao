create or replace function public.my_role()
returns public.user_role
language sql
stable
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.my_professor_id()
returns uuid
language sql
stable
as $$
  select professor_id
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ADMIN'
      and is_active = true
  )
$$;

create or replace function public.is_professor()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'PROFESSOR'
      and is_active = true
  )
$$;

create or replace function public.is_aluno()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'ALUNO'
      and is_active = true
  )
$$;

alter table public.profiles enable row level security;
alter table public.participants enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "profiles_select_professor_students" on public.profiles;
create policy "profiles_select_professor_students"
on public.profiles
for select
to authenticated
using (
  (select public.is_professor())
  and role = 'ALUNO'
  and professor_id = (select auth.uid())
);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "participants_select_admin" on public.participants;
create policy "participants_select_admin"
on public.participants
for select
to authenticated
using ((select public.is_admin()));

drop policy if exists "participants_select_professor" on public.participants;
create policy "participants_select_professor"
on public.participants
for select
to authenticated
using (
  (select public.is_professor())
  and owner_professor_id = (select auth.uid())
);

drop policy if exists "participants_select_aluno" on public.participants;
create policy "participants_select_aluno"
on public.participants
for select
to authenticated
using (
  (select public.is_aluno())
  and owner_student_id = (select auth.uid())
);

drop policy if exists "participants_insert_admin" on public.participants;
create policy "participants_insert_admin"
on public.participants
for insert
to authenticated
with check ((select public.is_admin()));

drop policy if exists "participants_insert_professor" on public.participants;
create policy "participants_insert_professor"
on public.participants
for insert
to authenticated
with check (
  (select public.is_professor())
  and owner_professor_id = (select auth.uid())
  and (
    owner_student_id is null
    or owner_student_id in (
      select id from public.profiles
      where role = 'ALUNO'
        and professor_id = (select auth.uid())
    )
  )
  and created_by = (select auth.uid())
);

drop policy if exists "participants_insert_aluno" on public.participants;
create policy "participants_insert_aluno"
on public.participants
for insert
to authenticated
with check (
  (select public.is_aluno())
  and owner_student_id = (select auth.uid())
  and owner_professor_id = (select public.my_professor_id())
  and created_by = (select auth.uid())
);

drop policy if exists "participants_update_admin" on public.participants;
create policy "participants_update_admin"
on public.participants
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists "participants_update_professor" on public.participants;
create policy "participants_update_professor"
on public.participants
for update
to authenticated
using (
  (select public.is_professor())
  and owner_professor_id = (select auth.uid())
)
with check (
  (select public.is_professor())
  and owner_professor_id = (select auth.uid())
);

drop policy if exists "participants_update_aluno" on public.participants;
create policy "participants_update_aluno"
on public.participants
for update
to authenticated
using (
  (select public.is_aluno())
  and owner_student_id = (select auth.uid())
)
with check (
  (select public.is_aluno())
  and owner_student_id = (select auth.uid())
);

drop policy if exists "participants_delete_admin" on public.participants;
create policy "participants_delete_admin"
on public.participants
for delete
to authenticated
using ((select public.is_admin()));

drop policy if exists "participants_delete_professor" on public.participants;
create policy "participants_delete_professor"
on public.participants
for delete
to authenticated
using (
  (select public.is_professor())
  and owner_professor_id = (select auth.uid())
);

drop policy if exists "participants_delete_aluno" on public.participants;
create policy "participants_delete_aluno"
on public.participants
for delete
to authenticated
using (
  (select public.is_aluno())
  and owner_student_id = (select auth.uid())
);