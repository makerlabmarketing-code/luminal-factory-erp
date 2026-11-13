begin;
drop trigger if exists erp_task_board_status_changed on public.project_activity;
drop function if exists public.broadcast_erp_task_status();
drop policy if exists erp_task_board_receive on realtime.messages;
commit;
