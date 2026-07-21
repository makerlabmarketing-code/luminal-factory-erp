import { describe, expect, it } from 'vitest';
import {
  allowedNextTaskStatuses,
  calculatePhaseProgress,
  calculateProjectProgress,
  canTransitionTaskStatus,
  phaseGateState,
  nextProjectPhaseStatus,
  taskProgressPercent,
} from '../lib/workflow-project-phase';

describe('project phase workflow state machine', () => {
  it('allows only approved task transitions without override', () => {
    expect(canTransitionTaskStatus('BACKLOG', 'READY')).toBe(true);
    expect(canTransitionTaskStatus('IN_PROGRESS', 'PENDING_REVIEW')).toBe(true);
    expect(canTransitionTaskStatus('PENDING_REVIEW', 'APPROVED')).toBe(true);
    expect(canTransitionTaskStatus('APPROVED', 'COMPLETED')).toBe(true);
    expect(canTransitionTaskStatus('BACKLOG', 'COMPLETED')).toBe(false);
    expect(canTransitionTaskStatus('READY', 'APPROVED')).toBe(false);
    expect(canTransitionTaskStatus('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });

  it('keeps the current status selectable while exposing allowed next statuses', () => {
    expect(allowedNextTaskStatuses('REVISION_REQUIRED')).toEqual(['REVISION_REQUIRED', 'IN_PROGRESS', 'CANCELLED']);
  });

  it('calculates phase and project progress from task progress instead of completed phase count only', () => {
    expect(taskProgressPercent('PENDING_REVIEW')).toBe(80);
    expect(calculatePhaseProgress([0, 50, 100], false)).toBe(50);
    expect(calculatePhaseProgress([0, 50], true)).toBe(100);
    expect(calculateProjectProgress([0, 50, 100])).toBe(50);
  });

  it('gates locked, readonly, cancelled and completion-ready phases', () => {
    expect(phaseGateState({ status: 'LOCKED', taskCount: 2, completedTaskCount: 2, orderIndex: 2 }, true)).toMatchObject({ canEditPhase: false, canEditTasks: false, canCompletePhase: false });
    expect(phaseGateState({ status: 'ACTIVE', taskCount: 2, completedTaskCount: 2, orderIndex: 1 }, true)).toMatchObject({ canEditPhase: true, canEditTasks: true, canCompletePhase: true });
    expect(phaseGateState({ status: 'ACTIVE', taskCount: 2, completedTaskCount: 1, orderIndex: 1 }, true)).toMatchObject({ canCompletePhase: false });
    expect(phaseGateState({ status: 'CANCELLED', taskCount: 2, completedTaskCount: 2, orderIndex: 1 }, true)).toMatchObject({ canEditPhase: false, canEditTasks: false });
    expect(phaseGateState({ status: 'ACTIVE', taskCount: 2, completedTaskCount: 2, orderIndex: 1 }, false)).toMatchObject({ canEditPhase: false, canEditTasks: false });
  });

  it('validates approved phase status/dependency transitions at the shared boundary', () => {
    expect(nextProjectPhaseStatus({
      currentStatus: 'ACTIVE',
      action: 'COMPLETE',
      previousPhaseStatus: null,
      nextPhaseStatus: 'LOCKED',
      taskCount: 2,
      completedTaskCount: 2,
      override: false,
    })).toBe('COMPLETED');
    expect(nextProjectPhaseStatus({
      currentStatus: 'LOCKED',
      action: 'UNLOCK',
      previousPhaseStatus: 'ACTIVE',
      nextPhaseStatus: null,
      taskCount: 0,
      completedTaskCount: 0,
      override: false,
    })).toBeNull();
    expect(nextProjectPhaseStatus({
      currentStatus: 'COMPLETED',
      action: 'REOPEN',
      previousPhaseStatus: 'COMPLETED',
      nextPhaseStatus: 'COMPLETED',
      taskCount: 1,
      completedTaskCount: 1,
      override: false,
    })).toBeNull();
    expect(nextProjectPhaseStatus({
      currentStatus: 'CANCELLED',
      action: 'REOPEN',
      previousPhaseStatus: 'COMPLETED',
      nextPhaseStatus: null,
      taskCount: 1,
      completedTaskCount: 1,
      override: true,
    })).toBeNull();
  });
});
