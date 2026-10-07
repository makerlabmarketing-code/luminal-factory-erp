import { afterEach,describe,it,expect,vi } from 'vitest';
import { activityHref,validateCorrectionReason } from '../lib/activity-history';
import { activityHistoryEnabled } from '../services/server/activityGate';
afterEach(()=>vi.unstubAllEnvs());
describe('Compact record history contract',()=>{
 it('defaults off until database rollout',()=>{vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED','');expect(activityHistoryEnabled()).toBe(false);vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED','true');expect(activityHistoryEnabled()).toBe(true);});
 it('requires a bounded meaningful reason before paid corrections',()=>{for(const v of [null,'','short'.slice(0,4),'a'.repeat(501)])expect(()=>validateCorrectionReason(v)).toThrow();expect(validateCorrectionReason('  Updated receipt  ')).toBe('Updated receipt');});
 it('builds only internal record links',()=>{expect(activityHref('employee','12')).toBe('/admin/employees/12');expect(activityHref('ledger','12')).toBe('/admin/capital?ledgerId=12');});
});
