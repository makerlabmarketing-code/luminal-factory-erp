begin;
-- Application gate must remain false until this exact package is approved and verified.
create table public.salary_payment_emails (
 id uuid primary key default gen_random_uuid(),
 ledger_id bigint not null unique references public.financial_ledger(id) on delete restrict,
 employee_id bigint not null references public.employees(id) on delete restrict,
 recipient text, employee_name text not null, amount numeric not null check(amount > 0),
 salary_month date not null check(salary_month = date_trunc('month',salary_month)::date),
 paid_at timestamptz not null, actor_employee_id bigint not null references public.employees(id),
 status text not null default 'PENDING' check(status in ('PENDING','BLOCKED','SENDING','ACCEPTED','UNKNOWN')),
 attempted_at timestamptz, message_id text, failure_code text, history_recorded boolean,
 created_at timestamptz not null default now()
);
alter table public.salary_payment_emails enable row level security;
revoke all on public.salary_payment_emails from public,anon,authenticated;
grant select,insert,update on public.salary_payment_emails to service_role;

create function public.guard_salary_email_snapshot() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (to_jsonb(new)-array['recipient','status','attempted_at','message_id','failure_code','history_recorded']) is distinct from (to_jsonb(old)-array['recipient','status','attempted_at','message_id','failure_code','history_recorded']) then raise exception 'salary snapshot is immutable'; end if;
 if old.attempted_at is not null and new.recipient is distinct from old.recipient then raise exception 'attempted recipient is immutable'; end if;
 if old.status in ('ACCEPTED','UNKNOWN') or (old.status='SENDING' and new.status not in ('ACCEPTED','UNKNOWN')) then raise exception 'attempt cannot be retried'; end if;
 return new;
end $$;
revoke all on function public.guard_salary_email_snapshot() from public,anon,authenticated;
create trigger salary_email_snapshot_immutable before update on public.salary_payment_emails for each row execute function public.guard_salary_email_snapshot();

create function public.confirm_salary_ledger_payment(p_ledger_id bigint,p_salary_month date,p_actor_id bigint)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare ledger public.financial_ledger%rowtype; employee public.employees%rowtype; queued public.salary_payment_emails%rowtype; result uuid; stamp timestamptz:=clock_timestamp();
begin
 if p_salary_month is null or p_salary_month <> date_trunc('month',p_salary_month)::date then raise exception 'invalid salary month' using errcode='22023'; end if;
 if p_actor_id is null or not exists(select 1 from public.employees where id=p_actor_id) then raise exception 'invalid actor' using errcode='22023'; end if;
 select * into ledger from public.financial_ledger where id=p_ledger_id for update;
 if not found then raise exception 'ledger not found' using errcode='22023'; end if;
 if ledger.type not in ('CHI_TIEU','CHI_PHI') or not(coalesce(ledger.source_type,'') in ('SALARY','PAYROLL') or coalesce(ledger.category,'') ~* '^Lương([[:space:]]|$)') then raise exception 'not a salary ledger' using errcode='22023'; end if;
 select * into queued from public.salary_payment_emails where ledger_id=p_ledger_id;
 if found then
   if queued.salary_month<>p_salary_month or not coalesce(ledger.is_paid,false) then raise exception 'notification conflict' using errcode='22023'; end if;
   return queued.id;
 end if;
 if coalesce(ledger.is_paid,false) or ledger.payment_status='PAID' then raise exception 'no retroactive notification' using errcode='22023'; end if;
 if ledger.amount is null or ledger.amount<=0 or ledger.cancelled_at is not null then raise exception 'invalid salary amount or cancelled ledger' using errcode='22023'; end if;
 select * into employee from public.employees where id=ledger.beneficiary_employee_id;
 if not found then raise exception 'employee beneficiary required' using errcode='22023'; end if;
 perform set_config('app.activity_actor',p_actor_id::text,true);
 update public.financial_ledger set is_paid=true,payment_status='PAID',paid_at=stamp,payment_confirmer_employee_id=p_actor_id,updated_at=stamp where id=p_ledger_id;
 insert into public.salary_payment_emails(ledger_id,employee_id,recipient,employee_name,amount,salary_month,paid_at,actor_employee_id)
 values(ledger.id,employee.id,employee.email,employee.full_name,ledger.amount,p_salary_month,stamp,p_actor_id) returning id into result;
 return result;
end $$;
revoke all on function public.confirm_salary_ledger_payment(bigint,date,bigint) from public,anon,authenticated;
grant execute on function public.confirm_salary_ledger_payment(bigint,date,bigint) to service_role;

insert into public.email_templates(group_type,template_name,subject,html_content,body,is_active)
select 'SALARY_PAYMENT_CONFIRMED','Lương — Đã xác nhận thanh toán',
 'Luminal Factory · Đã thanh toán lương {{salary_month}}',
 '<p>Chào {{employee_name}},</p><p>Luminal Factory đã xác nhận thanh toán lương tháng <strong>{{salary_month}}</strong>.</p><p>Số tiền: <strong>{{amount}} đồng</strong><br>Ngày xác nhận: {{payment_date}}<br>Mã khoản chi: {{ledger_id}}</p><p>Bạn vui lòng kiểm tra tài khoản nhận tiền và liên hệ người quản lý nếu có sai lệch.</p><p>Luminal Factory</p>',
 'Chào {{employee_name}}, Luminal Factory đã xác nhận thanh toán lương tháng {{salary_month}}, số tiền {{amount}} đồng, ngày {{payment_date}}, khoản chi {{ledger_id}}. Vui lòng kiểm tra tài khoản và liên hệ người quản lý nếu có sai lệch.',true
where not exists(select 1 from public.email_templates where group_type='SALARY_PAYMENT_CONFIRMED');
commit;
