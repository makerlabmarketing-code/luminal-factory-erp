import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { dropStatus, TASK_BOARD_COLUMNS } from '../lib/task-board';

it('maps a drop to a permitted transition and keeps a move within the same column a no-op', () => {
  const todo = TASK_BOARD_COLUMNS[0].statuses;
  expect(dropStatus('BACKLOG', todo, ['READY'])).toBeUndefined();
  expect(dropStatus('IN_PROGRESS', ['APPROVED'], ['PENDING_REVIEW', 'BLOCKED'])).toBeUndefined();
  expect(dropStatus('ON_HOLD', todo, ['READY'])).toBe('READY');
});

it('sends a private empty signal only for committed status history and scopes subscriptions to project access', async () => {
  const db = new PGlite();
  const sql = (name: string) => readFileSync(`supabase/drafts/task-board-realtime/${name}.sql`, 'utf8');
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema realtime;
      create table realtime.messages (payload jsonb, event text, topic text, private boolean, extension text);
      alter table realtime.messages enable row level security;
      grant usage on schema realtime to authenticated;
      grant select, insert on realtime.messages to authenticated;
      create function realtime.topic() returns text language sql as $$select current_setting('test.topic', true)$$;
      create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$
        insert into realtime.messages values ($1,$2,$3,$4,'broadcast')
      $$;
        create function public.has_workspace_access(text) returns boolean language sql as $$select $1 = 'STAFF_WORKSPACE'$$;
      create function public.has_permission(text) returns boolean language sql as $$select false$$;
      create function public.is_project_member(bigint) returns boolean language sql as $$select $1 = 7$$;
      create table public.project_activity (project_id bigint, activity_type text, task_id bigint);
    `);
    await db.exec(sql('forward'));
    await db.exec("insert into public.project_activity values (7,'COMMENT_ADDED',21),(7,'STATUS_CHANGED',21),(8,'STATUS_CHANGED',22),(7,'STATUS_CHANGED',null)");
    await db.exec("begin; insert into public.project_activity values (7,'STATUS_CHANGED',21); rollback;");
    await db.exec("set role authenticated; set test.topic = 'erp:task-board:7';");
    expect((await db.query('select payload, event, private from realtime.messages where topic = realtime.topic()')).rows)
      .toEqual([{ payload: {}, event: 'tasks-changed', private: true }]);
    await expect(db.exec("insert into realtime.messages values ('{}','tasks-changed','erp:task-board:7',true,'broadcast')")).rejects.toThrow(/row-level security/);
    await db.exec("set test.topic = 'erp:task-board:8';");
    expect((await db.query('select * from realtime.messages where topic = realtime.topic()')).rows).toEqual([]);
    await db.exec("set test.topic = 'erp:task-board:invalid';");
    expect((await db.query('select * from realtime.messages')).rows).toEqual([]);
    await db.exec('reset role;');
    await db.exec(sql('rollback'));
    expect((await db.query("select 1 from pg_trigger where tgname = 'erp_task_board_status_changed'")).rows).toEqual([]);
  } finally {
    await db.close();
  }
}, 15_000);
