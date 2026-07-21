import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

describe('project phase template metadata persistence', () => {
  it('passes application-layer template metadata from project create into phase persistence', () => {
    const pageSource = source('app/admin/projects/page.tsx');
    const serviceSource = source('services/workflowService.ts');
    const repositorySource = source('services/repositories/workflowRepository.ts');

    expect(pageSource).toMatch(/stage_type: stage\.type/);
    expect(pageSource).toMatch(/colorway_name: colorwayName\.trim\(\)/);
    expect(serviceSource).toMatch(/colorwayName: phase\.colorway_name/);
    expect(serviceSource).toMatch(/plannedEndDate: phase\.planned_end_date/);
    expect(repositorySource).toMatch(/colorwayName: params\.colorwayName/);
    expect(repositorySource).toMatch(/requiredReview: params\.requiredReview/);
  });

  it('keeps phase list DTO fields required for project detail instead of falling back to blank metadata', () => {
    const serverSource = source('services/server/phaseMutations.ts');
    const repositorySource = source('services/repositories/workflowRepository.ts');

    expect(serverSource).toMatch(/CREATE_PHASE_KEYS = new Set/);
    expect(serverSource).toMatch(/'stageType'/);
    expect(serverSource).toMatch(/stage_type: optionalTextField\(body, 'stageType'\)/);
    expect(serverSource).toMatch(/planned_end_date: optionalDateField\(body, 'plannedEndDate'\)/);
    expect(serverSource).toMatch(/select\('id, project_id, name, order_index, created_at, status, colorway_name/);
    expect(repositorySource).toMatch(/stage_type: pickFirstText\(row, \['stage_type'\]\) \|\| null/);
    expect(repositorySource).toMatch(/planned_end_date: pickFirstText\(row, \['planned_end_date'\]\) \|\| null/);
  });
});
