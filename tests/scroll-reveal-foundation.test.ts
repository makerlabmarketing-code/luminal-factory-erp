import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const revealSource = fs.readFileSync(path.join(root, 'component/ScrollReveal.tsx'), 'utf8');
const projectDetailSource = fs.readFileSync(path.join(root, 'app/admin/projects/[projectId]/page.tsx'), 'utf8');
const projectListSource = fs.readFileSync(path.join(root, 'app/admin/projects/page.tsx'), 'utf8');
const dashboardSource = fs.readFileSync(path.join(root, 'app/admin/dashboard/AdminDashboardCharts.tsx'), 'utf8');
const globalStyles = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

describe('Scroll reveal foundation', () => {
  it('uses a one-shot observer without subscribing to scroll events', () => {
    expect(revealSource).toMatch(/new IntersectionObserver/);
    expect(revealSource).toMatch(/observer\.disconnect\(\)/);
    expect(revealSource).toMatch(/requestAnimationFrame/);
    expect(revealSource).not.toMatch(/addEventListener\(['"]scroll/);
  });

  it('remains accessible when motion is reduced or JavaScript enhancement is unavailable', () => {
    expect(revealSource).toMatch(/prefers-reduced-motion: reduce/);
    expect(revealSource).toMatch(/RevealPhase = 'idle' \| 'hidden' \| 'visible'/);
    expect(revealSource).toMatch(/motion-reduce:opacity-100/);
    expect(revealSource).toMatch(/motion-reduce:transition-none/);
    expect(globalStyles).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });

  it('limits the project detail view to two meaningful reveal groups', () => {
    const revealCount = projectDetailSource.match(/<ScrollReveal/g)?.length ?? 0;

    expect(revealCount).toBe(2);
    expect(projectDetailSource).toMatch(/<ProjectMembershipSection/);
    expect(projectDetailSource).toMatch(/<ScrollReveal className="space-y-4" delayMs=\{40\}>/);
    expect(projectDetailSource).not.toMatch(/delayMs=\{(?:1[3-9]\d|[2-9]\d{2,})\}/);
  });

  it('reveals dashboard and project-list sections in restrained groups', () => {
    const dashboardRevealCount = dashboardSource.match(/<ScrollReveal/g)?.length ?? 0;
    const projectListRevealCount = projectListSource.match(/<ScrollReveal/g)?.length ?? 0;

    expect(dashboardRevealCount).toBe(2);
    expect(projectListRevealCount).toBe(2);
    expect(dashboardSource).toMatch(/<ScrollReveal className="grid grid-cols-1 gap-5 xl:grid-cols-\[minmax\(0,2fr\)_minmax\(320px,1fr\)\]" delayMs=\{40\}>/);
    expect(projectListSource).toMatch(/<ScrollReveal className="grid grid-cols-1 items-start gap-5 xl:grid-cols-5" delayMs=\{40\}>/);
    expect(`${dashboardSource}\n${projectListSource}`).not.toMatch(/delayMs=\{(?:1[3-9]\d|[2-9]\d{2,})\}/);
  });
});
