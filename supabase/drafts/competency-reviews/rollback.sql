-- Turn off COMPETENCY_REVIEWS_ENABLED first. Keep schema after any reviews exist.
begin;
lock table public.competency_manager_drafts, public.competency_self_reviews, public.competency_publications in access exclusive mode;
do $$ begin
  if exists (select 1 from public.competency_publications)
    or exists (select 1 from public.competency_manager_drafts)
    or exists (select 1 from public.competency_self_reviews) then
    raise exception 'review_data_exists_keep_schema';
  end if;
end $$;
drop function public.mark_competency_review_viewed(bigint,uuid);
drop function public.publish_competency_review(bigint,date,bigint,integer,integer,text,jsonb);
drop function public.save_competency_review(bigint,date,bigint,boolean,integer,jsonb);
drop table public.competency_publications, public.competency_manager_drafts, public.competency_self_reviews;
commit;
