import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const stack = process.env.TASK_BOARD_STACK;
const stackId = process.env.TASK_BOARD_STACK_ID;
assert.ok(stack && stackId === 'erp-realtime-ci', 'A disposable stack is required');
const config = readFileSync(join(stack, 'supabase/config.toml'), 'utf8');
assert.match(config, /^project_id = "erp-realtime-ci"$/m);
const { API_URL: apiUrl, ANON_KEY: anonKey, SERVICE_ROLE_KEY: serviceRoleKey } =
  JSON.parse(execFileSync('supabase', ['status', '--workdir', stack, '-o', 'json'], {
    encoding: 'utf8',
  }));
assert.equal(new URL(apiUrl).hostname, '127.0.0.1', 'Acceptance must use local Supabase');
const dbContainer = `supabase_db_${stackId}`;
const sql = (statement) => execFileSync('docker', [
  'exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq',
], { input: statement, encoding: 'utf8' }).trim();
const sqlFile = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const admin = createClient(apiUrl, serviceRoleKey, clientOptions);
const clients = [];

async function signInFixture(name, workspace, projectId, permission) {
  const email = `${name}@example.com`;
  const password = 'Local-task-board-test-123!';
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  assert.ifError(createError);
  const client = createClient(apiUrl, anonKey, clientOptions);
  clients.push(client);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  await client.realtime.setAuth(data.session.access_token);
  assert.match(created.user.id, /^[a-f\d-]{36}$/);
  sql(`insert into public.task_board_test_access values
    ('${created.user.id}', '${workspace}', ${projectId ?? 'null'}, ${permission ? `'${permission}'` : 'null'});`);
  return client;
}

function subscribe(client, projectId, received) {
  return new Promise((resolve) => {
    client.channel(`erp:task-board:${projectId}`, { config: { private: true } })
      .on('broadcast', { event: 'tasks-changed' }, (message) => received.push(message.payload))
      .subscribe((status, error) => resolve({ status, error }), 8000);
  });
}

async function waitForCount(received, count) {
  const deadline = Date.now() + 12000;
  while (received.length < count && Date.now() < deadline) await delay(100);
  assert.equal(received.length, count);
}

try {
  sql(sqlFile('fixture.sql'));
  sql(sqlFile('forward.sql'));
  const staff = await signInFixture('staff', 'STAFF_WORKSPACE', 7, null);
  const manager = await signInFixture('manager', 'ADMIN_WORKSPACE', null, 'PROJECT_MANAGE');
  const outsider = await signInFixture('outsider', 'STAFF_WORKSPACE', 8, null);
  const staffEvents = [];
  const managerEvents = [];
  const outsiderEvents = [];
  const [staffJoin, managerJoin, outsiderJoin] = await Promise.all([
    subscribe(staff, 7, staffEvents),
    subscribe(manager, 7, managerEvents),
    subscribe(outsider, 7, outsiderEvents),
  ]);
  assert.equal(staffJoin.status, 'SUBSCRIBED', staffJoin.error?.message);
  assert.equal(managerJoin.status, 'SUBSCRIBED', managerJoin.error?.message);
  assert.equal(outsiderJoin.status, 'CHANNEL_ERROR');
  assert.match(outsiderJoin.error?.message || '', /permission|unauthorized/i);
  console.log('PASS: staff and manager joined the private channel; outsider denied');

  sql(`begin; update public.tasks set status = 'BLOCKED' where id = 21; rollback;
    update public.tasks set status = 'IN_PROGRESS' where id = 21;
    update public.tasks set status = 'PENDING_REVIEW' where id = 22;
    update public.tasks set status = 'PENDING_REVIEW' where id = 21;`);
  await Promise.all([waitForCount(staffEvents, 1), waitForCount(managerEvents, 1)]);
  sql("update public.tasks set status = 'APPROVED' where id = 21");
  await Promise.all([waitForCount(staffEvents, 2), waitForCount(managerEvents, 2)]);
  assert.deepEqual(outsiderEvents, []);
  for (const payload of [...staffEvents, ...managerEvents]) {
    assert.deepEqual(Object.keys(payload).filter((key) => key !== 'id'), []);
  }
  console.log('PASS: both sessions received each committed change, with no task data');

  sql(sqlFile('rollback.sql'));
  assert.equal(sql(`select count(*) from pg_trigger
    where tgrelid = 'public.tasks'::regclass and tgname = 'erp_task_board_status_changed';`), '0');
  assert.equal(sql(`select count(*) from pg_policies where schemaname = 'realtime'
    and tablename = 'messages' and policyname = 'erp_task_board_receive';`), '0');
  console.log('PASS: rollback removed the policy and trigger');
} finally {
  await Promise.all(clients.map(async (client) => {
    await client.removeAllChannels();
    client.realtime.disconnect();
  }));
}
