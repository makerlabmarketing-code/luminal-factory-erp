import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readModelSource = readFileSync('services/server/projectMembershipReadModel.ts', 'utf8');
const routeSource = readFileSync('app/api/admin/projects/[projectId]/members/route.ts', 'utf8');

describe('project membership Slice 1 read model', () => {
  it('uses project_members and employee stable IDs as authority', () => {
    expect(readModelSource).toContain(".from('project_members')");
    expect(readModelSource).toContain('employee_id');
    expect(readModelSource).toContain(".from('projects')");
    expect(readModelSource).toContain('project_code');
  });

  it('preserves server-derived authorization capabilities', () => {
    expect(readModelSource).toContain('getProjectMembershipAuthorization(projectId)');
    expect(readModelSource).toContain("'MEMBER_LIST'");
    expect(readModelSource).toContain('capabilities: authorization.capabilities');
    expect(routeSource).toContain('capabilities: readModel.capabilities');
  });

  it('presents owners and managers explicitly without inventing a project owner field', () => {
    expect(readModelSource).toContain("PROJECT_OWNER: 0");
    expect(readModelSource).toContain("PROJECT_MANAGER: 1");
    expect(readModelSource).toContain("ownerCount: countRole('PROJECT_OWNER')");
    expect(readModelSource).toContain("managerCount: countRole('PROJECT_MANAGER')");
    expect(readModelSource).not.toContain('projects.owner');
  });

  it('keeps revoked history after active members in deterministic display order', () => {
    expect(readModelSource).toContain("left.status === 'ACTIVE' ? -1 : 1");
    expect(readModelSource).toContain("left.fullName.localeCompare(right.fullName, 'vi')");
    expect(readModelSource).toContain("const active = members.filter((member) => member.status === 'ACTIVE')");
  });

  it('keeps candidate loading separate from the canonical member read response', () => {
    expect(routeSource).toContain("searchParams.get('scope') === 'candidates'");
    expect(routeSource).toContain('listProjectMemberCandidates(params.projectId)');
    expect(routeSource).toContain('getProjectMembershipReadModel(params.projectId)');
  });
});
