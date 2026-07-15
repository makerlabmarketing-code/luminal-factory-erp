import Link from 'next/link';

export default function EmployeeDetailNotFound() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-base font-bold">Không tìm thấy hồ sơ nhân sự</h1>
        <p className="mt-2 text-xs text-slate-400">
          Hồ sơ này không tồn tại hoặc đã không còn khả dụng.
        </p>
        <Link
          href="/admin/employees"
          className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          Quay lại danh sách
        </Link>
      </section>
    </main>
  );
}
