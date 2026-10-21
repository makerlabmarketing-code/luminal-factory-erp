import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table employees(id bigint,auth_user_id uuid,role text,status text,is_active boolean);
insert into employees values(1,'11111111-1111-4111-8111-111111111111','OWNER','ACTIVE',true),(2,'22222222-2222-4222-8222-222222222222','ADMIN','ACTIVE',true),(3,'33333333-3333-4333-8333-333333333333','OWNER','ACTIVE',false),(4,'44444444-4444-4444-8444-444444444444','STAFF','ACTIVE',true);
create table financial_ledger(id bigint,cancelled_at timestamptz);insert into financial_ledger values(115,now()),(116,null);
alter table financial_ledger enable row level security;grant select on financial_ledger to authenticated;
create function is_app_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.employees where auth_user_id=(select auth.uid()) and status='ACTIVE' and role in ('ADMIN','OWNER'))$$;
create policy original_admin_select on financial_ledger for select to authenticated using(is_app_admin());`);
await db.exec(`alter table employees add full_name text;
alter table financial_ledger add type text,add category text,add amount numeric,add bill_url text,add transaction_date date,add description text,add project_id bigint,add beneficiary_employee_id bigint default 4,add beneficiary_external_name text,add month_period text,add payer_employee_id bigint,add reimbursement_status text,add rejection_reason text,add created_at timestamptz,add reimbursement_requester_employee_id bigint default 4;
create function current_employee_id() returns bigint language sql stable security definer as $$select id from public.employees where auth_user_id=(select auth.uid())$$;
create function has_workspace_access(text) returns boolean language sql as $$select true$$;`);
await db.exec(await readFile(new URL('../../migrations/20261021041420_ledger_deleted_owner_visibility.sql',import.meta.url),'utf8'));
for(const [uid,expected] of [['11111111-1111-4111-8111-111111111111',[115,116]],['22222222-2222-4222-8222-222222222222',[116]],['33333333-3333-4333-8333-333333333333',[116]],['44444444-4444-4444-8444-444444444444',[]],['',[]]]){
 await db.query("select set_config('test.uid',$1,false)",[uid]);await db.exec('set role authenticated');const result=await db.query('select id::int from financial_ledger order by id');assert.deepEqual(result.rows.map(r=>r.id),expected);await db.exec('reset role');
}
await db.exec("set test.uid='44444444-4444-4444-8444-444444444444';set role authenticated");
assert.deepEqual((await db.query('select id::int from list_my_reimbursements()')).rows.map(row=>row.id),[116]);await db.exec('reset role');
assert.equal((await db.query("select has_function_privilege('anon','erp_ledger_access.is_owner()','EXECUTE') allowed")).rows[0].allowed,false);
assert.equal((await db.query('select count(*)::int n from financial_ledger')).rows[0].n,2);
await db.exec(await readFile(new URL('rollback.sql',import.meta.url),'utf8'));
console.log('PASS restrictive RLS: owner sees deleted; admin sees active; inactive owner cannot see deleted; staff/no identity denied; grants and non-destructive rollback');await db.close();
