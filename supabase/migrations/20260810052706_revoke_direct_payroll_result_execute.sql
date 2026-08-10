revoke execute on function public.payroll_result(date, bigint) from public, anon, authenticated;

grant execute on function public.payroll_result(date, bigint) to service_role;
