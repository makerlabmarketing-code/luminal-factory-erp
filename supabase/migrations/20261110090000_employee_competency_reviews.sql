begin;

create table public.competency_manager_drafts (
  employee_id bigint not null references public.employees(id),
  month date not null check (extract(day from month) = 1),
  revision integer not null check (revision > 0),
  content jsonb not null,
  primary key(employee_id, month)
);

create table public.competency_self_reviews (
  employee_id bigint not null references public.employees(id),
  month date not null check (extract(day from month) = 1),
  revision integer not null check (revision > 0),
  content jsonb not null,
  primary key(employee_id, month)
);

create table public.competency_publications (
  id uuid primary key default gen_random_uuid(),
  employee_id bigint not null references public.employees(id),
  month date not null,
  revision integer not null,
  publisher_id bigint not null references public.employees(id),
  publisher_name text not null,
  published_at timestamptz not null default clock_timestamp(),
  viewed_at timestamptz,
  manager jsonb not null,
  self_review jsonb,
  rubric jsonb not null,
  correction text not null,
  unique(employee_id, month, revision),
  foreign key(employee_id, month) references public.competency_manager_drafts(employee_id, month)
);
create index competency_publications_employee_time on public.competency_publications(employee_id,published_at desc,id desc);

alter table public.competency_manager_drafts enable row level security;
alter table public.competency_self_reviews enable row level security;
alter table public.competency_publications enable row level security;
revoke all on public.competency_manager_drafts, public.competency_self_reviews, public.competency_publications
  from public, anon, authenticated, service_role;
grant select on public.competency_manager_drafts, public.competency_self_reviews, public.competency_publications to service_role;

create function public.save_competency_review(p_employee bigint, p_month date, p_actor bigint,
  p_is_self boolean, p_expected integer, p_content jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  table_name text;
  current_revision integer;
begin
  if p_employee is null or p_month is null or extract(day from p_month) <> 1 or p_expected is null or p_expected < 0
    or p_content is null or octet_length(p_content::text) > 60000 or p_is_self is null then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  if coalesce(jsonb_typeof(p_content->'scores'),'') <> 'array'
    or coalesce(jsonb_typeof(p_content->'evidence'),'') <> 'array' then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  if jsonb_array_length(p_content->'scores')<>4 or jsonb_array_length(p_content->'evidence')<>4
    or exists (select 1 from jsonb_array_elements(p_content->'scores') as scores(score)
      where score not in ('null'::jsonb,'0'::jsonb,'1'::jsonb,'2'::jsonb))
    or exists (select 1 from jsonb_array_elements(p_content->'evidence') as notes(note) where jsonb_typeof(note)<>'string') then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  if not exists (select 1 from public.employees where id=p_actor and status='ACTIVE' and is_active
    and ((p_is_self and id=p_employee) or (not p_is_self and upper(btrim(role))='OWNER'))) then
    raise exception 'review_forbidden' using errcode='42501';
  end if;
  table_name := case when p_is_self then 'competency_self_reviews' else 'competency_manager_drafts' end;
  perform pg_advisory_xact_lock(hashtextextended('competency:' || p_employee || ':' || p_month, 0));
  execute format('select revision from public.%I where employee_id=$1 and month=$2', table_name)
    into current_revision using p_employee, p_month;
  if coalesce(current_revision,0) <> p_expected then
    raise exception 'review_revision_changed' using errcode='40001';
  end if;
  execute format('insert into public.%I(employee_id,month,revision,content) values($1,$2,$3,$4)
    on conflict(employee_id,month) do update set revision=excluded.revision,content=excluded.content', table_name)
    using p_employee,p_month,p_expected+1,p_content;
  return p_expected+1;
end $$;

create function public.publish_competency_review(p_employee bigint,p_month date,p_actor bigint,
  p_expected integer,p_expected_self integer,p_correction text,p_rubric jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_draft public.competency_manager_drafts%rowtype;
  self_draft public.competency_self_reviews%rowtype;
  actor_name text;
  publication_id uuid;
begin
  select full_name into actor_name from public.employees where id=p_actor and status='ACTIVE'
    and is_active and upper(btrim(role))='OWNER';
  if not found then raise exception 'review_forbidden' using errcode='42501'; end if;
  if p_employee is null or p_month is null or p_expected is null or p_expected_self is null
    or p_correction is null or length(p_correction)>2000 or p_rubric is null then
    raise exception 'invalid_review' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('competency:' || p_employee || ':' || p_month, 0));
  select id into publication_id from public.competency_publications
    where employee_id=p_employee and month=p_month and revision=p_expected;
  if found then return publication_id; end if;

  select * into current_draft from public.competency_manager_drafts where employee_id=p_employee and month=p_month;
  select * into self_draft from public.competency_self_reviews where employee_id=p_employee and month=p_month;
  if current_draft.revision is distinct from p_expected or coalesce(self_draft.revision,0) <> p_expected_self then
    raise exception 'review_revision_changed' using errcode='40001';
  end if;
  if not exists (select 1 from public.employees where id=p_employee and status='ACTIVE' and is_active) then
    raise exception 'review_recipient_inactive' using errcode='22023';
  end if;
  if exists (select 1 from public.competency_publications where employee_id=p_employee and month=p_month)
    and length(btrim(p_correction))<3 then
    raise exception 'review_correction_required' using errcode='22023';
  end if;
  if coalesce(jsonb_typeof(current_draft.content->'evidence'),'') <> 'array'
    or jsonb_array_length(current_draft.content->'evidence') <> 4
    or exists (select 1 from jsonb_array_elements_text(current_draft.content->'evidence') as notes(note)
      where nullif(btrim(note),'') is null) then
    raise exception 'review_evidence_required' using errcode='22023';
  end if;
  insert into public.competency_publications(employee_id,month,revision,publisher_id,publisher_name,
    manager,self_review,rubric,correction)
  values (p_employee,p_month,p_expected,p_actor,actor_name,current_draft.content,self_draft.content,p_rubric,btrim(p_correction))
  returning id into publication_id;
  return publication_id;
end $$;

create function public.mark_competency_review_viewed(p_employee bigint,p_publication uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.competency_publications set viewed_at=coalesce(viewed_at,clock_timestamp())
  where employee_id=p_employee and id=p_publication
    and exists (select 1 from public.employees where id=p_employee and is_active and status='ACTIVE');
  return found;
end $$;

revoke all on function public.save_competency_review(bigint,date,bigint,boolean,integer,jsonb),
  public.publish_competency_review(bigint,date,bigint,integer,integer,text,jsonb),
  public.mark_competency_review_viewed(bigint,uuid) from public, anon, authenticated, service_role;
grant execute on function public.save_competency_review(bigint,date,bigint,boolean,integer,jsonb),
  public.publish_competency_review(bigint,date,bigint,integer,integer,text,jsonb),
  public.mark_competency_review_viewed(bigint,uuid) to service_role;

commit;
