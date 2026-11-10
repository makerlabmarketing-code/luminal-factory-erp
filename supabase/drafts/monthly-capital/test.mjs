import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const sql = await readFile(new URL('../../migrations/20261109090000_monthly_capital_contributions.sql', import.meta.url), 'utf8');
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema cron;
    create function cron.schedule(text,text,text) returns bigint language sql as $$ select 1::bigint $$;
    create table employees(id bigint primary key, full_name text, status text, is_active boolean);
    create table financial_ledger(type text, sub_type text, category text, amount bigint, requested_by text,
      payer_employee_id bigint, month_period text, transaction_date date, is_paid boolean, payment_status text,
      source_type text, source_reference text, cancelled_at timestamptz, unique(source_type,source_reference));
    insert into employees values (1,'Duy','ACTIVE',true),(2,'Hà','ACTIVE',true),(3,'Inactive','ACTIVE',false);
  `);
  await db.exec(sql.replace('create extension if not exists pg_cron;', '')
    .replaceAll("(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date", "current_setting('test.capital_date')::date"));
  await db.exec(`
    insert into finance_monthly_capital_rates(employee_id,effective_month,amount) values
      (1,'2026-11-01',2000000),(2,'2026-11-01',2000000),(3,'2026-11-01',2000000);
    insert into financial_ledger(type, requested_by, month_period, amount, is_paid) values ('VON_GOP','Hà','11/2026',2000000,true);
    set test.capital_date = '2026-11-09';
  `);
  const get = async query => (await db.query(query)).rows[0];
  assert.equal((await get('select generate_monthly_capital_contributions() as count')).count, 0);
  await db.exec("set test.capital_date = '2026-11-10'");
  assert.equal((await get('select generate_monthly_capital_contributions() as count')).count, 1);
  assert.equal((await get('select generate_monthly_capital_contributions() as count')).count, 0);
  const rate = await get("select (list_monthly_capital_rates()->0)->>'updated_at' as stamp");
  const update = await db.query('select set_monthly_capital_rate(1,2500000,1,$1)::text as effective', [rate.stamp]);
  assert.equal(update.rows[0].effective, '2026-12-01');
  await assert.rejects(db.query('select set_monthly_capital_rate(1,2500000,1,$1)', [rate.stamp]), /monthly_capital_rate_changed/);
  await db.exec("set test.capital_date = '2027-01-10'");
  assert.equal((await get('select generate_monthly_capital_contributions() as count')).count, 4);
  const rows = (await db.query(`select month_period, amount, is_paid, payment_status, transaction_date::text
    from financial_ledger where payer_employee_id=1 order by transaction_date`)).rows;
  assert.deepEqual(rows.map(row => Number(row.amount)), [2000000,2500000,2500000]);
  assert.ok(rows.every(row => !row.is_paid && row.payment_status === 'UNPAID' && row.transaction_date.endsWith('-10')));
  await db.exec("update financial_ledger set cancelled_at=now() where source_reference='1:2027-01'");
  assert.equal((await get('select generate_monthly_capital_contributions() as count')).count, 0);
  assert.equal((await get("select has_function_privilege('authenticated','public.list_monthly_capital_rates()','execute') as allowed")).allowed, false);
  console.log('PASS due day, legacy match, repeat, rate changes, catch-up, inactive accounts and access');
} finally {
  await db.close();
}
