begin transaction read only;
do $validate$
declare test_case record; actual boolean; checked integer:=0;
begin
 for test_case in
  select e.id,e.auth_user_id,p.code,
   (e.status='ACTIVE' and coalesce(e.is_active,true)
    and exists(select 1 from public.employee_permissions x where x.employee_id=e.id and x.permission_code=p.code and x.effect='ALLOW' and x.status='ACTIVE' and x.revoked_at is null)
    and not exists(select 1 from public.employee_permissions x where x.employee_id=e.id and x.permission_code=p.code and x.effect='DENY' and x.status='ACTIVE' and x.revoked_at is null)) allowed
  from public.employees e cross join public.permissions p where e.auth_user_id is not null
 loop
  perform set_config('request.jwt.claim.sub',test_case.auth_user_id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',test_case.auth_user_id,'role','authenticated')::text,true);
  actual:=public.has_permission(test_case.code);
  if actual is distinct from test_case.allowed then
   raise exception 'Permission mismatch employee %, code %, expected %, actual %',test_case.id,test_case.code,test_case.allowed,actual;
  end if;
  checked:=checked+1;
 end loop;
 if checked=0 then raise exception 'No permission cases checked'; end if;
 raise notice 'Permission helper validated across % employee/catalog pairs',checked;
end $validate$;
select 'PASS: all linked employee/catalog pairs match intended permission rules' result;
rollback;
