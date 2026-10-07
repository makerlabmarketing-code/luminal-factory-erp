-- REVIEW PACKAGE ONLY. Production owner approval required.
begin;
create table public.erp_activity_events (
 id bigint generated always as identity primary key,
 occurred_at timestamptz not null default clock_timestamp(),
 actor_employee_id bigint references public.employees(id) on delete set null,
 entity text not null check(entity in ('employee','ledger')),
 entity_id bigint not null,
 action text not null check(action in ('CREATE','UPDATE','DELETE')),
 screen text not null,
 summary text not null check(length(summary)<=300),
 changes_text text not null default '' check(octet_length(changes_text)<=8192)
);
create index erp_activity_entity_recent on public.erp_activity_events(entity,entity_id,id desc);
create index erp_activity_actor_recent on public.erp_activity_events(actor_employee_id,id desc);
alter table public.erp_activity_events enable row level security;
revoke all on public.erp_activity_events from public,anon,authenticated,service_role;
grant select,insert on public.erp_activity_events to service_role;
grant usage,select on sequence public.erp_activity_events_id_seq to service_role;

-- Append only, tightly scoped trigger. No public RPC exposure; captures direct
-- legacy writes too, with an honest system/unknown actor when no identity exists.
create function public.capture_erp_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 old_row jsonb := case when TG_OP='INSERT' then '{}'::jsonb else to_jsonb(OLD) end;
 new_row jsonb := case when TG_OP='DELETE' then '{}'::jsonb else to_jsonb(NEW) end;
 entity_name text := case when TG_TABLE_NAME='employees' then 'employee' else 'ledger' end;
 record_id bigint := coalesce((new_row->>'id')::bigint,(old_row->>'id')::bigint);
 actor_id bigint;
 field text;
 diff text := '';
 reason text := nullif(current_setting('app.activity_reason',true),'');
 allowed_fields text[];
 label text;
 begin
 if nullif(current_setting('app.activity_actor',true),'') is not null then
   actor_id := current_setting('app.activity_actor',true)::bigint;
 else
   select id into actor_id from public.employees where auth_user_id=auth.uid() limit 1;
 end if;
 allowed_fields := case when entity_name='employee' then array['full_name','email','title','phone','branch_code','status','bank_name','bank_account_number','hourly_rate','is_active','auth_user_id'] else array['type','sub_type','category','amount','requested_by','month_period','is_paid','description','transaction_date','project_id','beneficiary_employee_id','payer_employee_id','reimbursement_status','payment_status'] end;
 foreach field in array allowed_fields loop
   if old_row->field is distinct from new_row->field then
     label := case field when 'full_name' then 'Họ tên' when 'email' then 'Email' when 'title' then 'Chức danh' when 'phone' then 'Điện thoại' when 'branch_code' then 'Cơ sở' when 'status' then 'Trạng thái nhân sự' when 'bank_name' then 'Ngân hàng' when 'bank_account_number' then 'Số tài khoản' when 'hourly_rate' then 'Lương theo giờ' when 'is_active' then 'Hoạt động' when 'auth_user_id' then 'Kết nối tài khoản' when 'type' then 'Loại giao dịch' when 'sub_type' then 'Loại vốn' when 'category' then 'Khoản mục' when 'amount' then 'Số tiền' when 'requested_by' then 'Người thực hiện' when 'month_period' then 'Kỳ báo cáo' when 'is_paid' then 'Đã thanh toán' when 'description' then 'Mô tả' when 'transaction_date' then 'Ngày giao dịch' when 'project_id' then 'Dự án' when 'beneficiary_employee_id' then 'Người hưởng lợi' when 'payer_employee_id' then 'Người chi trả' when 'reimbursement_status' then 'Trạng thái hoàn ứng' else 'Trạng thái thanh toán' end;
     -- Employee private values and long notes are never duplicated into audit.
     if entity_name='employee' or field='description' then
       diff := diff || label || ': đã thay đổi' || E'\n';
     else
       diff := diff || label || ': ' || coalesce((old_row->field)::text,'null') || ' → ' || coalesce((new_row->field)::text,'null') || E'\n';
     end if;
   end if;
 end loop;
 if TG_OP='UPDATE' and diff='' then return NEW; end if;
 if reason is not null then diff := diff || 'Lý do: ' || reason; end if;
 insert into public.erp_activity_events(actor_employee_id,entity,entity_id,action,screen,summary,changes_text)
 values(actor_id,entity_name,record_id,case when TG_OP='INSERT' then 'CREATE' else TG_OP end,
 case when entity_name='employee' then 'Hồ sơ nhân sự' else 'Sổ thu chi' end,
 case TG_OP when 'INSERT' then 'Tạo' when 'DELETE' then 'Xóa' else 'Cập nhật' end || case when entity_name='employee' then ' hồ sơ nhân sự #' else ' giao dịch #' end || record_id,
 diff);
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end;
$$;
revoke all on function public.capture_erp_activity() from public,anon,authenticated;
create trigger employees_compact_activity after insert or update or delete on public.employees for each row execute function public.capture_erp_activity();
create trigger ledger_compact_activity after insert or update or delete on public.financial_ledger for each row execute function public.capture_erp_activity();

-- Authenticated identity is resolved by the ERP service. Browser roles cannot
-- call this function or forge its actor. Audit and record change commit together.
create function public.update_erp_record_with_history(p_entity text,p_id bigint,p_patch jsonb,p_actor_id bigint,p_reason text default null) returns jsonb
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
