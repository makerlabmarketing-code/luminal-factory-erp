import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db=new PGlite();
const read=name=>readFile(new URL(name,import.meta.url),'utf8');
let cases=0;
async function check(subject,code,expected){
 await db.query("select set_config('test.employee',$1,false)",[String(subject)]);
 const {rows}=await db.query('select public.has_permission($1) allowed',[code]);
 assert.equal(rows[0].allowed,expected,`${subject} ${code}`);cases++;
}
try{
 await db.exec(await read('fixtures.sql'));
 const old=(await read('rollback.sql')).replace(/^--[^\n]*\n/,'');
 await db.exec(old);
 await check(1,'VIEW',false); // Old unrelated DENY blocks VIEW.
 await check(2,'ABSENT',true); // Old unrelated ALLOW overgrants ABSENT.
 await db.exec(await read('forward.sql'));
 for(const c of [[1,'VIEW',true],[1,'MANAGE',false],[1,'ABSENT',false],[1,'EXTRA',false],[2,'VIEW',true],[2,'ABSENT',false],[2,'MANAGE',false],[2,'UNKNOWN',false],[2,null,false],[3,'VIEW',false],[4,'VIEW',false],[5,'VIEW',false],[999,'VIEW',false]])await check(...c);
 await db.exec("insert into public.employee_permissions values(1,'VIEW','DENY','ACTIVE',null)");
 await check(1,'VIEW',false);
 await db.exec("delete from public.employee_permissions where employee_id=1 and permission_code='VIEW' and effect='DENY'");
 await db.exec("grant select on public.employees to authenticated; create policy admin_view on public.employees for select to authenticated using(public.has_permission('VIEW')); set role authenticated;");
 for(const [subject,count] of [[1,5],[2,5],[3,1],[4,0],[999,0]]){
  await db.query("select set_config('test.employee',$1,false)",[String(subject)]);
  assert.equal((await db.query('select count(*)::int count from public.employees')).rows[0].count,count);cases++;
 }
 await db.exec('reset role');
 await db.exec(await read('rollback.sql'));await check(1,'VIEW',false);
 await db.exec(await read('forward.sql'));await check(1,'VIEW',true);
 console.log(`PASS ${cases} PostgreSQL fixtures (including old-bug reproduction, RLS isolation and rollback/reapply)`);
}finally{await db.close();}
