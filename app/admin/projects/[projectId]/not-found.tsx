import Link from 'next/link';
import { ArrowLeft, FolderSearch } from 'lucide-react';

export default function ProjectNotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-950 p-6 text-slate-100">
      <section className="max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
        <FolderSearch className="mx-auto h-10 w-10 text-slate-500" aria-hidden="true" />
        <h1 className="mt-4 text-lg font-black">Không tìm thấy dự án</h1>
        <p className="mt-2 text-sm text-slate-400">Dự án không tồn tại hoặc đã không còn khả dụng.</p>
        <Link href="/admin/projects" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500">
          <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
        </Link>
      </section>
    </main>
  );
}
