-- Minimal disposable data model for the local Supabase WebSocket acceptance test.
create table public.tasks (
  id bigint primary key,
  project_id bigint,
  status text
);

create table public.task_board_test_access (
  user_id uuid primary key,
  workspace text not null,
  project_id bigint,
  permission text
);
revoke all on public.task_board_test_access from public, anon, authenticated;

create function public.has_workspace_access(text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.task_board_test_access where user_id = auth.uid() and workspace = $1
  );
$$;

create function public.has_permission(text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.task_board_test_access where user_id = auth.uid() and permission = $1
  );
$$;

create function public.is_project_member(bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.task_board_test_access where user_id = auth.uid() and project_id = $1
  );
$$;

insert into public.tasks values (21, 7, 'IN_PROGRESS'), (22, 8, 'IN_PROGRESS');
