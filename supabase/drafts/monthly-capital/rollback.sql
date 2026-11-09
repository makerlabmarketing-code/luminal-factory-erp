-- Keeps the configured rates and financial ledger intact.
select cron.unschedule(jobid)
from cron.job where jobname = 'erp-monthly-capital-contributions';
