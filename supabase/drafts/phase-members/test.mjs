import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create table projects(id bigint primary key, status text);
create table phases(id bigint primary key,project_id bigint references projects(id),status text);
create table employees(id bigint primary key,role text,status text default 'ACTIVE',is_active boolean default true);
create table project_members(id bigint primary key,project_id bigint references projects(id),employee_id bigint references employees(id),status text,role_code text);
create table employee_workspace_access(employee_id bigint,workspace text,status text,revoked_at timestamptz);
create table employee_permissions(employee_id bigint,permission_code text,effect text,status text,revoked_at timestamptz);
grant all on all tables in schema public to service_role;
insert into projects values(12,'PROCESSING'),(13,'PROCESSING'),(14,'CANCELLED');
insert into phases values(21,12,'ACTIVE'),(22,12,'LOCKED'),(23,13,'ACTIVE'),(24,12,'COMPLETED'),(25,14,'ACTIVE');
insert into employees(id,role) values(1,'ADMIN'),(2,'STAFF'),(3,'STAFF'),(4,'STAFF'),(5,'STAFF'),(6,'STAFF'),(7,'STAFF'),(8,'STAFF'),(9,'STAFF');
update employees set is_active=false where id=5;
insert into project_members values(1,12,2,'ACTIVE','PROJECT_MANAGER'),(2,12,3,'ACTIVE','CONTRIBUTOR'),(3,12,4,'REVOKED','CONTRIBUTOR'),(4,12,5,'ACTIVE','CONTRIBUTOR'),(5,13,6,'ACTIVE','PROJECT_MANAGER');
insert into employee_workspace_access values(7,'ADMIN_WORKSPACE','ACTIVE',null),(8,'ADMIN_WORKSPACE','ACTIVE',null);
insert into employee_permissions values(7,'PROJECT_MANAGE','ALLOW','ACTIVE',null),(8,'PROJECT_MANAGE','ALLOW','ACTIVE',null),(8,'PROJECT_MANAGE','DENY','ACTIVE',null);
`);
const forward = await readFile(new URL('forward.sql',import.meta.url),'utf8');
await db.exec(forward);
await db.exec('set role service_role');
const set = async (ids, expected, actor=2, phase=21, project=12) => (await db.query('select set_project_phase_members_atomic($1,$2,$3::bigint[],$4::bigint[],$5) result',[project,phase,ids,expected,actor])).rows[0].result.employeeIds;
const count = async table => Number((await db.query(`select count(*) n from ${table}`)).rows[0].n);
assert.deepEqual(await set([3,2,3],[]),[2,3]);
assert.equal(await count('project_phase_member_audit'),1);
assert.deepEqual(await set([2,3],[]),[2,3]); // response-loss retry, no audit duplicate
assert.equal(await count('project_phase_member_audit'),1);
await assert.rejects(set([2],[3]),/phase_members_stale/);
for (const ids of [[4],[5],[6],[999]]) await assert.rejects(set(ids,[2,3]),/phase_members_not_project_member/);
for (const actor of [3,6,8,9]) await assert.rejects(set([2],[2,3],actor),/phase_members_forbidden/);
await assert.rejects(set([2],[],2,23,12),/phase_members_phase_mismatch/);
await assert.rejects(set([2],[],1,25,14),/phase_members_project_closed/);
await assert.rejects(set([2],[],2,24,12),/phase_members_phase_closed/);
assert.deepEqual(await set([2,3],[],2,22),[2,3]); // preassign a locked phase without unlocking it
assert.deepEqual(await set([3],[2,3],7),[3]); // global PROJECT_MANAGE allow
assert.deepEqual(await set([2,3],[3],1),[2,3]); // admin
assert.deepEqual(await set([], [2,3]),[]); // removal is audited
assert.deepEqual(await set([2],[]),[2]);
await db.exec('reset role');
await assert.rejects(db.exec("update project_phase_member_audit set actor_employee_id=1 where id=1"),/phase_member_audit_immutable/);
await assert.rejects(db.exec("delete from project_phase_member_audit where id=1"),/phase_member_audit_immutable/);
await db.exec(`create function fail_phase_member_audit_fixture() returns trigger language plpgsql as $$begin raise exception 'fixture_audit_failure'; end$$;
create trigger fixture_fail before insert on project_phase_member_audit for each row execute function fail_phase_member_audit_fixture(); set role service_role;`);
await assert.rejects(set([3],[2]),/fixture_audit_failure/);
assert.deepEqual((await db.query('select employee_id from project_phase_members where phase_id=21 order by employee_id')).rows.map(x=>Number(x.employee_id)),[2]);
await db.exec('reset role; drop trigger fixture_fail on project_phase_member_audit;');
for(const role of ['anon','authenticated']) {
  assert.equal((await db.query(`select has_function_privilege('${role}','public.set_project_phase_members_atomic(bigint,bigint,bigint[],bigint[],bigint)','EXECUTE') allowed`)).rows[0].allowed,false);
  await db.exec(`set role ${role}`);
  await assert.rejects(db.exec('select * from project_phase_members'),/permission denied/);
  await db.exec('reset role');
}
assert.equal((await db.query("select count(*)::int n from pg_class where relname in ('project_phase_members','project_phase_member_audit') and relrowsecurity")).rows[0].n,2);
assert.equal((await db.query("select prosecdef from pg_proc where proname='set_project_phase_members_atomic'")).rows[0].prosecdef,false);
// Rollback refuses to discard assignments/history.
const rollback = await readFile(new URL('rollback.sql',import.meta.url),'utf8');
await assert.rejects(db.exec(rollback),/phase_members_export_required/);
await db.exec('rollback');
// Fresh, unused package can be rolled back cleanly.
await db.exec('begin; drop trigger project_phase_member_audit_immutable on project_phase_member_audit; truncate project_phase_members,project_phase_member_audit; commit;');
await db.exec(rollback);
assert.equal((await db.query("select to_regclass('public.project_phase_members') t")).rows[0].t,null);
console.log('PASS phase members SQL: multi-select, retries, stale writes, outsiders, inactive/revoked, denied roles, cross-project, closed/locked phases, removal, atomic audit failure, RLS/grants, immutable history, guarded rollback');
await db.close();
