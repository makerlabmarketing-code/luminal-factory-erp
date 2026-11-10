import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const manager = { scores: [2, 1, 2, 2], evidence: ['A', 'B', 'C', 'D'] };
const self = { scores: [0, 0, null, 1], evidence: ['', '', 'Chưa giao', ''] };
const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
const save = (employee, actor, selfReview, revision, value) => one(
  "select save_competency_review($1,'2026-11-01',$2,$3,$4,$5) as revision",
  [employee, actor, selfReview, revision, JSON.stringify(value)]
);
const publish = (revision, selfRevision, correction = '', actor = 1) => one(
  "select publish_competency_review(2,'2026-11-01',$1,$2,$3,$4,'[]') as id", [actor, revision, selfRevision, correction]
);

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create table employees(id bigint primary key, full_name text, role text, status text, is_active boolean);
    insert into employees values (1,'Owner','OWNER','ACTIVE',true),(2,'Staff A','STAFF','ACTIVE',true),
      (3,'Staff B','STAFF','ACTIVE',true),(4,'Inactive','STAFF','ACTIVE',false),(5,'Admin','ADMIN','ACTIVE',true);
  `);
  await db.exec(await readFile(new URL('forward.sql', import.meta.url), 'utf8'));
  await assert.rejects(save(2, 3, true, 0, self), /review_forbidden/);
  await assert.rejects(save(4, 4, true, 0, self), /review_forbidden/);
  await assert.rejects(save(2, 5, false, 0, manager), /review_forbidden/);
  await assert.rejects(save(2, 1, false, 0, {...manager, scores:[3,0,0,0]}), /invalid_review/);
  assert.equal((await save(2, 2, true, 0, self)).revision, 1);
  assert.equal((await save(2, 1, false, 0, manager)).revision, 1);
  assert.equal((await one('select count(*)::int as count from competency_publications')).count, 0);
  await assert.rejects(publish(1, 0), /review_revision_changed/);
  await assert.rejects(publish(1, 1, '', 5), /review_forbidden/);
  const { id } = await publish(1, 1);
  assert.equal((await publish(1, 1)).id, id);
  assert.equal((await one('select mark_competency_review_viewed(3,$1) as viewed',[id])).viewed, false);
  assert.equal((await one('select mark_competency_review_viewed(2,$1) as viewed',[id])).viewed, true);
  await assert.rejects(save(2, 1, false, 0, manager), /review_revision_changed/);
  assert.equal((await save(2, 1, false, 1, {...manager, scores:[0,0,0,0]})).revision, 2);
  await assert.rejects(publish(2, 1), /review_correction_required/);
  const amended = await publish(2, 1, 'Bổ sung bằng chứng');
  assert.notEqual(amended.id, id);
  const original = await one('select manager,self_review,viewed_at from competency_publications where id=$1',[id]);
  assert.deepEqual(original.manager, manager);
  assert.deepEqual(original.self_review, self);
  assert.ok(original.viewed_at);
  assert.equal((await save(2, 1, false, 2, {...manager,evidence:['', 'B', 'C', 'D']})).revision, 3);
  await assert.rejects(publish(3, 1, 'Bổ sung bằng chứng'), /review_evidence_required/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from competency_manager_drafts'), /permission denied/);
  await assert.rejects(db.query('select * from competency_publications'), /permission denied/);
  await assert.rejects(publish(3,1,'Bổ sung bằng chứng'), /permission denied/);
  await db.exec('reset role');
  assert.equal((await one('select count(*)::int as count from competency_publications')).count, 2);
  await assert.rejects(db.exec(await readFile(new URL('rollback.sql', import.meta.url), 'utf8')), /review_data_exists_keep_schema/);
  console.log('PASS private drafts, role and employee isolation, stale writes, evidence, duplicate send, review history, read receipt, rollback');
} finally {
  await db.close();
}
