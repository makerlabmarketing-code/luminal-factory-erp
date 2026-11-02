-- Disposable database only. Runner applies exact package forward between fixture phases.
create role authenticated;
create role anon;
create role service_role;
create table public.employees(id bigint primary key,status text,is_active boolean);
insert into public.employees values(1,'ACTIVE',true),(2,'ACTIVE',true),(3,'ACTIVE',true),(4,'INACTIVE',true),(5,'ACTIVE',false);
create table public.permissions(code text primary key);
insert into public.permissions values('VIEW'),('MANAGE'),('ABSENT'),('EXTRA');
create table public.employee_permissions(employee_id bigint,permission_code text,effect text,status text,revoked_at timestamptz);
insert into public.employee_permissions values
 (1,'VIEW','ALLOW','ACTIVE',null),(1,'MANAGE','DENY','ACTIVE',null),
 (2,'VIEW','ALLOW','ACTIVE',null),
 (4,'VIEW','ALLOW','ACTIVE',null),(5,'VIEW','ALLOW','ACTIVE',null),
 (1,'EXTRA','ALLOW','REVOKED',null),(1,'EXTRA','ALLOW','ACTIVE',now()),
 (2,'VIEW','DENY','INACTIVE',null),(2,'VIEW','DENY','ACTIVE',now());
create function public.current_employee_id() returns bigint language sql stable security definer set search_path=public,pg_temp as $$
 select id from public.employees where id=nullif(current_setting('test.employee',true),'')::bigint and status='ACTIVE' and coalesce(is_active,true);
$$;
alter table public.employees enable row level security;
create policy own_row on public.employees for select to authenticated using(id=public.current_employee_id());

