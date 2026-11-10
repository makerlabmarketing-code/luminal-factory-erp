select count(*)=3 and bool_and(relrowsecurity) as review_rls
from pg_class where oid in ('public.competency_manager_drafts'::regclass,
  'public.competency_self_reviews'::regclass,'public.competency_publications'::regclass);

select not has_table_privilege('authenticated','public.competency_manager_drafts','select') as browser_draft_denied,
  not has_table_privilege('authenticated','public.competency_publications','select') as browser_publication_denied,
  not has_function_privilege('authenticated','public.publish_competency_review(bigint,date,bigint,integer,integer,text,jsonb)','execute') as browser_publish_denied,
  has_function_privilege('service_role','public.publish_competency_review(bigint,date,bigint,integer,integer,text,jsonb)','execute') as server_publish_allowed;
