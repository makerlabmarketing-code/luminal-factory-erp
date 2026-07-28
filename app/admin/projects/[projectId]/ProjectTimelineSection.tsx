'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ProjectTimelineDTO } from '@/lib/types/project-activity';
import { useNotification } from '@/component/NotificationContext';

const WAITING_COPY = 'Bình luận và lịch sử hoạt động đang chờ kích hoạt.';

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function ProjectTimelineSection({ projectId, cancelled }: { projectId: number; cancelled: boolean }) {
  const { showToast } = useNotification();
  const [timeline, setTimeline] = useState<ProjectTimelineDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/timeline?limit=30`, { cache: 'no-store' });
      if (!response.ok) throw new Error('timeline_load_failed');
      const payload = await response.json() as { timeline: ProjectTimelineDTO };
      setTimeline(payload.timeline);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (submitting || cancelled || !timeline?.canComment || !comment.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/timeline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: comment }) });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Không thể lưu bình luận.');
      setComment('');
      showToast('Đã thêm bình luận.', 'Bình luận của dự án đã được cập nhật.', 'success');
      await load();
    } catch (error) { showToast('Không thể thêm bình luận.', error instanceof Error ? error.message : 'Vui lòng thử lại.', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-black text-slate-100">Bình luận và hoạt động</h2></div>
        <p className="mt-1 text-[11px] text-slate-500">Lịch sử bất biến, tải tối đa 30 mục mỗi loại.</p>
      </div>
      <div className="space-y-4 p-4 text-xs">
        {loading && <p className="text-slate-400">Đang tải bình luận và hoạt động…</p>}
        {failed && <div className="flex items-center justify-between gap-3 rounded border border-amber-900 bg-amber-950/25 p-3 text-amber-100"><span>Không thể tải mục này. Nội dung dự án khác vẫn hiển thị.</span><button type="button" onClick={() => void load()} className="rounded border border-amber-700 px-2 py-1 font-bold">Thử lại</button></div>}
        {!loading && !failed && timeline && !timeline.capabilityEnabled && <p className="rounded border border-amber-900 bg-amber-950/25 p-3 text-amber-100">{WAITING_COPY}</p>}
        {timeline?.capabilityEnabled && (
          <>
            <div>
              <label htmlFor="project-comment" className="mb-1 block font-bold text-slate-300">Bình luận mới</label>
              <textarea id="project-comment" rows={3} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} disabled={submitting || cancelled || !timeline.canComment} placeholder={cancelled ? 'Dự án đã hủy, chỉ được xem.' : 'Nhập bình luận'} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 disabled:opacity-50" />
              <button type="button" onClick={() => void submit()} disabled={submitting || cancelled || !timeline.canComment || !comment.trim()} className="mt-2 rounded bg-cyan-600 px-3 py-2 font-bold text-white disabled:bg-slate-800 disabled:text-slate-500">{submitting ? 'Đang gửi…' : 'Gửi bình luận'}</button>
            </div>
            <div className="space-y-2">
              {timeline.comments.map((item) => <article key={`comment-${item.id}`} className="rounded border border-slate-800 bg-slate-950 p-3"><div className="flex justify-between gap-2 text-slate-500"><strong className="text-slate-200">{item.actorName}</strong><time>{formatTime(item.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-slate-300">{item.body}</p></article>)}
              {timeline.activity.map((item) => <article key={`activity-${item.id}`} className="rounded border border-slate-800 bg-slate-950 p-3"><div className="flex justify-between gap-2 text-slate-500"><strong className="text-slate-200">{item.actorName}</strong><time>{formatTime(item.createdAt)}</time></div><p className="mt-1 text-slate-300">{item.activityType}</p></article>)}
              {timeline.comments.length === 0 && timeline.activity.length === 0 && <p className="text-slate-500">Chưa có bình luận hoặc hoạt động.</p>}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
