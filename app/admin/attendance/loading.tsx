import { AdminPage, AdminPageHeader } from '@/component/AdminUI';

export default function AttendanceLoading() {
  return (
    <AdminPage>
      <AdminPageHeader title="Chấm công" />
      <section className="admin-table-shell p-4" aria-busy="true" aria-label="Đang tải lịch chấm công">
        <div className="grid grid-cols-7 gap-2 motion-safe:animate-pulse" aria-hidden="true">
          {Array.from({ length: 28 }, (_, day) => <div key={day} className="h-16 rounded-lg border border-slate-800 bg-slate-800/40" />)}
        </div>
      </section>
    </AdminPage>
  );
}
