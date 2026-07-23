import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('repository guidance workflow', () => {
  it('treats Supabase GitHub Integration as the canonical migration delivery path', () => {
    const agents = source('AGENTS.md');
    const supabaseContract = source('.agents/skills/luminal-erp/references/supabase-contract.md');
    const workflow = source('.agents/skills/luminal-erp/references/workflow.md');

    for (const guidance of [agents, supabaseContract]) {
      expect(guidance).toMatch(/Supabase GitHub Integration.*canonical production migration delivery workflow|configured Supabase GitHub Integration path as canonical delivery/s);
      expect(guidance).toMatch(/approved PR merges into protected `main`/);
      expect(guidance).toMatch(/Do not require a separate "Apply migration" task|Never require a follow-up "Apply migration" task/);
    }

    expect(workflow).toMatch(/let protected-main merge plus Supabase GitHub Integration perform production execution/);
    expect(workflow).toMatch(/do not create a separate "Apply migration" task/);
  });

  it('keeps preparation artifacts inside the feature slice and continues safe application work', () => {
    const agents = source('AGENTS.md');
    const workflow = source('.agents/skills/luminal-erp/references/workflow.md');

    expect(agents).toMatch(/Documentation-only tasks must not be split out/);
    expect(agents).toMatch(/continue additional application-only work whenever it does not require schema, RPC, RLS, storage, deployment, security approval, or live data mutation/);
    expect(workflow).toMatch(/Continue automatically from one safe phase or slice to the next/);
    expect(workflow).toMatch(/produced inside the same feature slice whenever possible/);
  });

  it('does not reopen already-remediated Code Review findings', () => {
    const agents = source('AGENTS.md');

    expect(agents).toMatch(/Before starting any new roadmap slice:[\s\S]*Inspect only newly opened review comments/);
    expect(agents).toMatch(/- FIXED/);
    expect(agents).toMatch(/- FALSE_POSITIVE_WITH_EVIDENCE/);
    expect(agents).toMatch(/- NOT_APPLICABLE_WITH_EVIDENCE/);
  });

  it('classifies Codex Cloud database TCP failures as an environment limitation without repeated retries', () => {
    const agents = source('AGENTS.md');
    const supabaseContract = source('.agents/skills/luminal-erp/references/supabase-contract.md');

    for (const guidance of [agents, supabaseContract]) {
      expect(guidance).toMatch(/DATABASE_TCP_UNAVAILABLE/);
      expect(guidance).toMatch(/stop retrying `psql`, `supabase db push`, `supabase db query`, and pooler probes|do not repeatedly retry `psql`, `supabase db push`, `supabase db query`, or pooler probes/);
      expect(guidance).toMatch(/Prefer Supabase GitHub Integration delivery, Management API checks, CLI metadata, and read-only validation|prefer the Supabase GitHub Integration, Management API, CLI metadata, and read-only validation/);
    }
  });
});
