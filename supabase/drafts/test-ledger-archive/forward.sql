-- Review only: reversible archive of administrator-identified disposable reimbursements.
begin;
create function public.set_test_ledger_archived(p_id bigint,p_archived boolean,p_actor_id bigint,p_reason text)
returns void language plpgsql security invoker set search_path='' set lock_timeout='2s' as $$
declare l public.financial_ledger%rowtype;
begin
 if p_actor_id is null or not exists(select 1 from public.employees where id=p_actor_id and upper(btrim(role))='OWNER' and is_active and status='ACTIVE') then raise exception 'test_ledger_owner_required' using errcode='42501'; end if;
 if p_archived is null or p_reason is null or length(btrim(p_reason)) not between 10 and 500 then raise exception 'invalid test archive reason' using errcode='22023'; end if;
 select * into l from public.financial_ledger where id=p_id for update;
 if not found then raise exception 'ledger missing' using errcode='P0002'; end if;
 if l.type is distinct from 'HOAN_UNG' or l.source_type is not null or l.source_reference is not null or exists(select 1 from public.salary_payment_emails where ledger_id=p_id) or exists(select 1 from public.financial_ledger where id<>p_id and (source_reference=p_id::text or (category='[Đối ứng] Vốn hiện vật: '||l.category and requested_by is not distinct from l.requested_by))) then raise exception 'integrated_ledger_protected' using errcode='22023'; end if;
 -- A duplicate request is idempotent; restoring only a record archived by this workflow.
 if p_archived=(l.cancelled_at is not null) then return; end if;
 if not p_archived and not exists(select 1 from public.erp_activity_events where entity='ledger' and entity_id=p_id and summary='Xóa mềm bản ghi thử #'||p_id) then raise exception 'not_test_archive' using errcode='22023'; end if;
 perform set_config('app.activity_actor',p_actor_id::text,true);
 perform set_config('app.activity_reason',btrim(p_reason),true);
 update public.financial_ledger set cancelled_at=case when p_archived then clock_timestamp() else null end,updated_at=clock_timestamp() where id=p_id;
 insert into public.erp_activity_events(actor_employee_id,entity,entity_id,action,screen,summary,changes_text)
 values(p_actor_id,'ledger',p_id,'UPDATE','Sổ thu chi',case when p_archived then 'Xóa mềm bản ghi thử #' else 'Khôi phục bản ghi thử #' end||p_id,'Lý do: '||btrim(p_reason));
end $$;
revoke all on function public.set_test_ledger_archived(bigint,boolean,bigint,text) from public,anon,authenticated;
grant execute on function public.set_test_ledger_archived(bigint,boolean,bigint,text) to service_role;
create or replace function public.update_erp_record_with_history(p_entity text,p_id bigint,p_patch jsonb,p_actor_id bigint,p_reason text default null) returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='5s' set lock_timeout='2s' as $$
declare
 e public.employees%rowtype;
 e_next public.employees%rowtype;
 l public.financial_ledger%rowtype;
 l_next public.financial_ledger%rowtype;
 key text;
begin
 if p_actor_id is null or not exists(select 1 from public.employees where id=p_actor_id) then raise exception 'invalid actor' using errcode='22023'; end if;
 if p_id is null or p_id<=0 or p_patch is null or jsonb_typeof(p_patch)<>'object' then raise exception 'invalid patch' using errcode='22023'; end if;
 perform set_config('app.activity_actor',p_actor_id::text,true);
 perform set_config('app.activity_reason',coalesce(p_reason,''),true);
 if p_entity='employee' then
   for key in select jsonb_object_keys(p_patch) loop
     if key<>all(array['full_name','email','title','phone','branch_code','status','bank_name','bank_account_number','hourly_rate']) then raise exception 'protected employee field' using errcode='22023'; end if;
   end loop;
   select * into e from public.employees where id=p_id for update;
   if not found then raise exception 'employee missing' using errcode='P0002'; end if;
   e_next := jsonb_populate_record(e,p_patch);
   update public.employees set full_name=e_next.full_name,email=e_next.email,title=e_next.title,phone=e_next.phone,branch_code=e_next.branch_code,status=e_next.status,bank_name=e_next.bank_name,bank_account_number=e_next.bank_account_number,hourly_rate=e_next.hourly_rate where id=p_id;
 elsif p_entity='ledger' then
   for key in select jsonb_object_keys(p_patch) loop
     if key<>all(array['type','sub_type','category','amount','requested_by','month_period','is_paid','transaction_date','description','project_id','beneficiary_employee_id','beneficiary_external_name','payer_employee_id','should_have_link','update_extended']) then raise exception 'protected ledger field' using errcode='22023'; end if;
   end loop;
   select * into l from public.financial_ledger where id=p_id for update;
   if not found then raise exception 'ledger missing' using errcode='P0002'; end if;
   if l.cancelled_at is not null then raise exception 'archived_ledger_protected' using errcode='22023'; end if;
   l_next := jsonb_populate_record(l,p_patch - 'should_have_link' - 'update_extended');
   if l.is_paid then
     if length(btrim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'correction reason required' using errcode='22023'; end if;
     if l_next.is_paid is distinct from l.is_paid or l_next.type is distinct from l.type then raise exception 'paid lifecycle protected' using errcode='22023'; end if;
   end if;
   if l.type='HOAN_UNG' then
     if not coalesce(l.is_paid,false) or l.reimbursement_status is distinct from 'PAID' then raise exception 'reimbursement workflow protected' using errcode='22023'; end if;
     -- Correct paid evidence only. Workflow actors, recipient and payment state stay intact.
     if l_next.requested_by is distinct from l.requested_by or l_next.beneficiary_employee_id is distinct from l.beneficiary_employee_id or l_next.payer_employee_id is distinct from l.payer_employee_id or l_next.beneficiary_external_name is distinct from l.beneficiary_external_name then raise exception 'paid reimbursement people protected' using errcode='22023'; end if;
     if l_next.amount is null or l_next.amount<=0 or l_next.category is null or length(btrim(l_next.category))=0 or l_next.month_period is null or l_next.month_period !~ '^(0[1-9]|1[0-2])/[0-9]{4}$' then raise exception 'invalid correction' using errcode='22023'; end if;
     update public.financial_ledger set category=l_next.category,amount=l_next.amount,month_period=l_next.month_period,transaction_date=l_next.transaction_date,description=l_next.description,project_id=l_next.project_id,updated_at=clock_timestamp() where id=p_id;
   else
     perform public.update_linked_financial_ledger_entry(p_id,l_next.type,l_next.sub_type,l_next.category,l_next.amount,l_next.requested_by,l_next.month_period,l_next.is_paid,coalesce((p_patch->>'should_have_link')::boolean,false),coalesce((p_patch->>'update_extended')::boolean,false),l_next.transaction_date,l_next.description,l_next.project_id,l_next.beneficiary_employee_id,l_next.beneficiary_external_name,l_next.payer_employee_id,case when l_next.is_paid then 'PAID' else 'UNPAID' end);
   end if;
 else raise exception 'invalid entity' using errcode='22023';
 end if;
 return jsonb_build_object('id',p_id);
end;
$$;
revoke all on function public.update_erp_record_with_history(text,bigint,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.update_erp_record_with_history(text,bigint,jsonb,bigint,text) to service_role;
commit;
