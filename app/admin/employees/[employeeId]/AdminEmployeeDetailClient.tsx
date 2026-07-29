'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Shield } from 'lucide-react';
import { ButtonLoadingState } from '@/component/GlobalLoading';
import { useNotification } from '@/component/NotificationContext';
import type { EmployeeDetailDto } from '@/services/server/adminEmployeeData';
import { accountConnectionLabels } from '@/lib/accountConnection';
import { getPermissionPresentation, PERMISSION_MANAGEMENT_PATH } from '@/lib/account-permissions';
import { AdminPage } from '@/component/AdminUI';

type DetailTab = 'overview' | 'job' | 'account' | 'projects' | 'attendance' | 'finance' | 'history';
type EditableTab = 'overview' | 'job';
type Draft = { fullName: string; email: string; phone: string; title: string; department: string; employmentStatus: string };
type ApiResponse = { success?: boolean; message?: string; correlationId?: string };

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Tổng quan' }, { id: 'job', label: 'Thông tin công việc' },
  { id: 'account', label: 'Tài khoản & phân quyền' }, { id: 'projects', label: 'Dự án & công việc' },
  { id: 'attendance', label: 'Lịch làm & chấm công' }, { id: 'finance', label: 'Tài chính cá nhân' },
  { id: 'history', label: 'Lịch sử thay đổi' },
];
const tabFields: Record<EditableTab, Array<keyof Draft>> = {
  overview: ['fullName', 'email', 'phone'], job: ['title', 'department', 'employmentStatus'],
};
const apiNames: Record<keyof Draft, string> = {
  fullName: 'fullName', email: 'email', phone: 'phone', title: 'title', department: 'department', employmentStatus: 'employmentStatus',
};

function draftFrom(data: EmployeeDetailDto): Draft {
  return { fullName: data.fullName, email: data.email || '', phone: data.phone || '', title: data.title || '', department: data.facilityCode || '', employmentStatus: data.employmentStatus || 'ACTIVE' };
}
function Field({ label, value }: { label: string; value: string | number | null }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4"><p className="text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-sm font-semibold text-slate-100">{value || 'Chưa có'}</p></div>;
}
function ComingSoon({ title }: { title: string }) {
  return <section className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center"><BriefcaseBusiness className="mx-auto h-6 w-6 text-slate-500"/><h2 className="mt-3 text-sm font-bold">{title}</h2><p className="mt-2 text-xs text-slate-500">Chưa có dữ liệu trong khu vực này.</p></section>;
}
function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block space-y-1"><span className="text-[10px] font-bold uppercase text-slate-500">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm outline-none focus:border-blue-500" /></label>;
}

export default function AdminEmployeeDetailClient({ initialData }: { initialData: EmployeeDetailDto }) {
  const router = useRouter();
  const { showToast } = useNotification();
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState(() => draftFrom(initialData));
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => { setData(initialData); setDraft(draftFrom(initialData)); }, [initialData]);
  const baseline = useMemo(() => draftFrom(data), [data]);
  const dirtyFields = activeTab === 'overview' || activeTab === 'job' ? tabFields[activeTab].filter((field) => draft[field] !== baseline[field]) : [];
  const dirty = dirtyFields.length > 0;

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const changeTab = (next: DetailTab) => {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Bạn có muốn bỏ các thay đổi này?')) return;
    if (dirty) setDraft(baseline);
    setError(null); setActiveTab(next);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!dirty || saving) return;
    const payload = Object.fromEntries(dirtyFields.map((field) => [apiNames[field], draft[field]]));
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/api/admin/employees/${data.employeeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, credentials: 'include', cache: 'no-store', body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({})) as ApiResponse;
      if (!response.ok || result.success === false) {
        const reference = result.correlationId ? ` Mã tra cứu: ${result.correlationId}.` : '';
        throw new Error(`${result.message || 'Không thể cập nhật thông tin. Vui lòng thử lại.'}${reference}`);
      }
      setData((current) => ({ ...current, fullName: draft.fullName, email: draft.email || null, phone: draft.phone || null, title: draft.title || null, facilityCode: draft.department || null, facility: current.facilities.find((f) => f.code === draft.department)?.name || null, employmentStatus: draft.employmentStatus }));
      showToast('Đã cập nhật', 'Đã cập nhật thông tin nhân sự.', 'success');
      startTransition(() => router.refresh());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Không thể cập nhật thông tin. Vui lòng thử lại.';
      setError(message); showToast('Không thể cập nhật', 'Không thể cập nhật thông tin. Vui lòng thử lại.', 'error');
    } finally { setSaving(false); }
  };

  const editorActions = dirty && <div className="flex justify-end gap-2 border-t border-slate-800 pt-4"><button type="button" disabled={saving} onClick={() => { setDraft(baseline); setError(null); }} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold">Hủy thay đổi</button><button type="submit" disabled={saving || isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"><ButtonLoadingState loading={saving} loadingText="Đang lưu..." idleText="Lưu thay đổi" /></button></div>;

  return <main><AdminPage><header className="rounded-lg border border-slate-800 bg-slate-900 p-5"><Link href="/admin/employees" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400"><ArrowLeft className="h-4 w-4"/>Quay lại danh sách</Link><h1 className="mt-4 text-2xl font-bold">{data.fullName}</h1><p className="mt-1 text-sm text-slate-400">{data.title || 'Chưa gán chức vụ'} · {data.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}</p></header>
  {data.warnings.length > 0 && <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"><p>Một số phần bổ sung chưa tải được: {data.warnings.map((warning) => warning === 'employee_facility_enrichment_failed' ? 'cơ sở làm việc' : warning === 'account_lookup_failed' ? 'trạng thái tài khoản' : 'quyền truy cập').join(', ')}. Hồ sơ chính vẫn dùng được.</p><button type="button" onClick={() => startTransition(() => router.refresh())} className="mt-2 font-bold underline">Thử tải lại</button></div>}
  <nav className="mt-4 overflow-x-auto border-b border-slate-800"><div className="flex min-w-max gap-1">{tabs.map((tab) => <button key={tab.id} type="button" onClick={() => changeTab(tab.id)} className={`px-3 py-3 text-xs font-bold ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-300' : 'text-slate-400'}`}>{tab.label}</button>)}</div></nav>
  <div className="mt-5">
  {activeTab === 'overview' && (data.capabilities.canEditEmployee ? <form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Input label="Họ tên" value={draft.fullName} onChange={(fullName) => setDraft({ ...draft, fullName })}/><Input label="Email" type="email" value={draft.email} onChange={(email) => setDraft({ ...draft, email })}/><Input label="Điện thoại" value={draft.phone} onChange={(phone) => setDraft({ ...draft, phone })}/><Field label="Ngày tạo" value={data.createdAt ? new Date(data.createdAt).toLocaleDateString('vi-VN') : null}/></div>{error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}{editorActions}</form> : <section className="grid gap-4 md:grid-cols-2"><Field label="Họ tên" value={data.fullName}/><Field label="Email" value={data.email}/><Field label="Điện thoại" value={data.phone}/><Field label="Ngày tạo" value={data.createdAt}/></section>)}
  {activeTab === 'job' && (data.capabilities.canEditEmployee ? <form onSubmit={save} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Input label="Chức vụ" value={draft.title} onChange={(title) => setDraft({ ...draft, title })}/><label className="space-y-1"><span className="text-[10px] font-bold uppercase text-slate-500">Cơ sở làm việc</span><select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"><option value="">Chưa gán cơ sở</option>{data.facilities.filter((f) => f.isActive || f.code === draft.department).map((f) => <option key={f.id} value={f.code}>{f.name}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase text-slate-500">Trạng thái làm việc</span><select value={draft.employmentStatus} onChange={(e) => setDraft({ ...draft, employmentStatus: e.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"><option value="ACTIVE">Đang làm</option><option value="INACTIVE">Ngừng hoạt động</option></select></label><Field label="Mức lương theo giờ" value={data.hourlyRate}/></div>{error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}{editorActions}</form> : <section className="grid gap-4 md:grid-cols-2"><Field label="Chức vụ" value={data.title}/><Field label="Cơ sở làm việc" value={data.facility}/><Field label="Trạng thái" value={data.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}/></section>)}
  {activeTab === 'account' && <section className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><Field label="Trạng thái kết nối" value={accountConnectionLabels[data.accountConnectionStatus]}/><Field label="Staff Workspace" value={data.hasStaffWorkspace ? 'Đã cấp' : 'Chưa cấp'}/><Field label="Admin Workspace" value={data.hasAdminWorkspace ? 'Đã cấp' : 'Chưa cấp'}/></div><div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><h2 className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-blue-300"/>Quyền hiệu lực</h2>{data.permissions.length === 0 ? <p className="mt-3 text-xs text-slate-500">Chưa có quyền riêng.</p> : <div className="mt-3 grid gap-3 md:grid-cols-2">{data.permissions.map((item) => { const presentation = getPermissionPresentation(item.permissionCode); return <div key={`${item.permissionCode}:${item.effect}`} className="rounded border border-slate-700 bg-slate-950 p-3"><p className="text-xs font-bold text-slate-200">{presentation.label}</p><p className="mt-1 text-[10px] text-slate-500">{presentation.group} · <span className="font-mono">{presentation.code}</span> · {item.effect === 'ALLOW' ? 'Cho phép' : 'Từ chối'}</p></div>; })}</div>}{data.capabilities.canManageAccount && <Link href={`${PERMISSION_MANAGEMENT_PATH}?employeeId=${data.employeeId}`} className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Mở trình quản lý tài khoản và quyền</Link>}</div></section>}
  {activeTab === 'projects' && <ComingSoon title="Dự án & công việc"/>}{activeTab === 'attendance' && <ComingSoon title="Lịch làm & chấm công"/>}{activeTab === 'finance' && <ComingSoon title="Tài chính cá nhân"/>}{activeTab === 'history' && <ComingSoon title="Lịch sử thay đổi"/>}
  </div></AdminPage></main>;
}
