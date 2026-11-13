begin;
drop trigger if exists erp_task_board_status_changed on public.tasks;
drop function if exists erp_task_board_private.broadcast_task_status();
drop schema if exists erp_task_board_private;
drop policy if exists erp_task_board_receive on realtime.messages;
commit;
