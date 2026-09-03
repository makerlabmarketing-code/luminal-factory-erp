'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Factory, Loader2, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPage, AdminPageHeader, AdminPanel, AdminPanelHeader } from '@/component/AdminUI';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { PRODUCTION_PRIORITY_LABELS } from '@/lib/production-order-workflow';
import type {
  ProductionOrderCreateContextResponse,
  ProductionOrderCreateMemberOption,
} from '@/lib/types/production-order-read';

interface ApiError {
  success?: false;
  message?: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewProductionOrderPage() {
  const router = useRouter();
  const submitLock = useRef(false);
  const [context, setContext] = useState<ProductionOrderCreateContextResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [creativeLeadId, setCreativeLeadId] = useState('');

  const loadContext = useCallback(async () => {
    setLoadError(null);
    setContext(null);
    try {
      const response = await fetch('/api/admin/production-orders/create-context', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as ProductionOrderCreateContextResponse | ApiError | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload && 'message' in payload && payload.message ? payload.message : 'Không thể tải dữ liệu tạo lệnh sản xuất.');
      }
      setContext(payload);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không thể tải dữ liệu tạo lệnh sản xuất.');
    }
  }, []);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  const selectedProject = useMemo(
    () => context?.projects.find((project) => String(project.projectId) === projectId) || null,
    [context, projectId],
  );
  const managers = selectedProject?.members.filter((member) => member.roleCode === 'PROJECT_MANAGER') || [];
  const creativeLeads = selectedProject?.members.filter((member) => member.roleCode === 'CREATIVE_LEAD') || [];

  function selectProject(value: string) {
    setProjectId(value);
    const project = context?.projects.find((candidate) => String(candidate.projectId) === value);
    setManagerId(String(project?.members.find((member) => member.roleCode === 'PROJECT_MANAGER')?.employeeId || ''));
    setCreativeLeadId(String(project?.members.find((member) => member.roleCode === 'CREATIVE_LEAD')?.employeeId || ''));
    setSubmitError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/admin/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productionCode: form.get('productionCode'),
          displayName: form.get('displayName'),
          projectId: Number(projectId),
          productOrCollection: form.get('productOrCollection'),
          colorway: form.get('colorway'),
          plannedQuantity: Number(form.get('plannedQuantity')),
          targetCompletionDate: form.get('targetCompletionDate'),
          priority: form.get('priority'),
          projectManagerEmployeeId: Number(managerId),
          creativeLeadEmployeeId: Number(creativeLeadId),
        }),
      });
      const payload = await response.json().catch(() => null) as ({ success: true; productionOrderId: string } | ApiError) | null;
      if (!response.ok || payload?.success !== true || !payload.productionOrderId) {
        throw new Error(payload && 'message' in payload && payload.message ? payload.message : 'Không thể tạo lệnh sản xuất.');
      }
      router.push(`/admin/production-orders/${payload.productionOrderId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Không thể tạo lệnh sản xuất.');
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (!context && !loadError) return <CenteredPageLoading message="Đang tải lệnh sản xuất..." />;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Tạo lệnh sản xuất"
        description="Khởi tạo lệnh từ quy trình chuẩn và đội ngũ đang hoạt động của dự án."
        icon={Factory}
        actions={<Link href="/admin/production-orders" className="admin-button-secondary"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Quay lại</Link>}
      />

      {loadError ? (
        <div className="admin-card flex items-start gap-3 border-amber-800/70 p-5" role="alert">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
          <div className="flex-1"><p className="font-bold text-amber-200">Chưa thể mở biểu mẫu</p><p className="mt-1 text-sm text-slate-400">{loadError}</p></div>
          <button type="button" className="admin-button-secondary" onClick={() => void loadContext()}>Thử lại</button>
        </div>
      ) : null}

      {context ? (
        <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <AdminPanel>
            <AdminPanelHeader title="Thông tin lệnh" description="Các trạng thái, tiến độ, giai đoạn và công việc được hệ thống thiết lập tự động." />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Field label="Mã sản xuất" required><input className="admin-field font-mono uppercase" name="productionCode" required maxLength={40} placeholder="LF-2026-001" autoComplete="off" /></Field>
              <Field label="Tên hiển thị"><input className="admin-field" name="displayName" maxLength={160} placeholder="Tên nội bộ dễ nhận biết" /></Field>
              <Field label="Dự án" required className="sm:col-span-2">
                <select className="admin-field" value={projectId} onChange={(event) => selectProject(event.target.value)} required>
                  <option value="">Chọn dự án đang hoạt động</option>
                  {context.projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.projectCode} — {project.projectName}</option>)}
                </select>
              </Field>
              <Field label="Sản phẩm hoặc bộ sưu tập" required><input className="admin-field" name="productOrCollection" required maxLength={160} /></Field>
              <Field label="Mẫu màu" required><input className="admin-field" name="colorway" required maxLength={120} /></Field>
              <Field label="Số lượng kế hoạch" required><input className="admin-field" name="plannedQuantity" type="number" required min={1} max={1000000} step={1} /></Field>
              <Field label="Hạn hoàn thành" required><input className="admin-field" name="targetCompletionDate" type="date" required min={todayIso()} /></Field>
              <Field label="Mức ưu tiên" required>
                <select className="admin-field" name="priority" defaultValue="NORMAL">{Object.entries(PRODUCTION_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </Field>
              <Field label="Quản lý dự án" required>
                <MemberSelect value={managerId} onChange={setManagerId} members={managers} placeholder={projectId ? 'Chọn quản lý dự án' : 'Chọn dự án trước'} />
              </Field>
              <Field label="Creative lead" required>
                <MemberSelect value={creativeLeadId} onChange={setCreativeLeadId} members={creativeLeads} placeholder={projectId ? 'Chọn creative lead' : 'Chọn dự án trước'} />
              </Field>
            </div>
          </AdminPanel>

          <div className="space-y-5">
            <AdminPanel>
              <AdminPanelHeader title="Quy trình sẽ tạo" description={`${context.workflow.name} · ${context.workflow.stageCount} giai đoạn tuần tự`} />
              <div className="space-y-3 p-5 text-sm text-slate-400">
                <p>Giai đoạn đầu ở trạng thái “Sẵn sàng”; các giai đoạn sau được khóa.</p>
                <p>Sản lượng hoàn thành và tiến độ bắt đầu từ 0. Không thay đổi tồn kho hoặc vật tư.</p>
                {context.projects.length === 0 ? <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-amber-200">Chưa có dự án đang hoạt động phù hợp để tạo lệnh.</p> : null}
                {selectedProject && (managers.length === 0 || creativeLeads.length === 0) ? <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3 text-amber-200">Dự án cần có quản lý dự án và creative lead đang hoạt động trước khi tạo lệnh.</p> : null}
              </div>
            </AdminPanel>
            {submitError ? <div className="rounded-xl border border-red-900/70 bg-red-950/30 p-4 text-sm text-red-200" role="alert">{submitError}</div> : null}
            <button type="submit" className="admin-button-primary w-full justify-center" disabled={submitting || !projectId || !managerId || !creativeLeadId}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Factory className="h-4 w-4" aria-hidden="true" />}
              {submitting ? 'Đang tạo lệnh...' : 'Tạo lệnh sản xuất'}
            </button>
          </div>
        </form>
      ) : null}
    </AdminPage>
  );
}

function Field({ label, required, className = '', children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}{required ? <span className="text-red-300"> *</span> : null}</span>{children}</label>;
}

function MemberSelect({ value, onChange, members, placeholder }: { value: string; onChange: (value: string) => void; members: ProductionOrderCreateMemberOption[]; placeholder: string }) {
  return (
    <select className="admin-field" value={value} onChange={(event) => onChange(event.target.value)} required disabled={members.length === 0}>
      <option value="">{placeholder}</option>
      {members.map((member) => <option key={member.employeeId} value={member.employeeId}>{member.fullName}{member.title ? ` — ${member.title}` : ''}</option>)}
    </select>
  );
}
