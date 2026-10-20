begin;
revoke update, truncate, references, trigger on public.project_phase_members from service_role;
revoke update, delete, truncate, references, trigger on public.project_phase_member_audit from service_role;
revoke update on sequence public.project_phase_member_audit_id_seq from service_role;
commit;
