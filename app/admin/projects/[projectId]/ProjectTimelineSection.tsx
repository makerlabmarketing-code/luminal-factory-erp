'use client';

import { useCallback, useEffect, useState } from 'react';
import { Layers, MessageSquare } from 'lucide-react';
import type { ProjectTimelineDTO } from '@/lib/types/project-activity';
import { useNotification } from '@/component/NotificationContext';

const WAITING_COPY = 'Bình luận và lịch sử hoạt động đang chờ kích hoạt.';

type PhaseSetupEligibility = { canSetup: boolean; phaseCount: number | null };

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function ProjectTimelineSection({ projectId, cancelled }: { projectId: number; cancelled: boolean }) {
  const { showToast, showConfirm } = useNotification();
  const [timeline, setTimeline] = useState<ProjectTimelineDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phaseSetup, setPhaseSetup] = useState<PhaseSetupEligibility | null>(null);
  const [phaseSetupLoading, setPhaseSetupLoading] = useState(false);

  const loadPhaseSetup = useCallback(async () => {
    if (cancelled) {
      setPhaseSetup(null);
      return;
    }
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/phases/setup`, { cache: 'no-store' });
      if (!response.ok) {
        setPhaseSetup(null);
        return;
      }
      const payload = await response.json() as { canSetup?: boolean; phaseCount?: number | null };
      setPhaseSetup({ canSetup: payload.canSetup === true, phaseCount: typeof payload.phaseCount === 'number' ? payload.phaseCount : null });
    } catch {
      setPhaseSetup(null);
    }
  }, [cancelled, projectId]);

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
  useEffect(() => { void loadPhaseSetup(); }, [loadPhaseSetup]);

  const setupDefaultPhases = () => {
    if (!phaseSetup?.canSetup || phaseSetupLoading || cancelled) return;
    showConfirm(
      'Thiết lập 3 giai đoạn mặc định?',
      'Hệ thống sẽ tạo Giai đoạn 1 ở trạng thái Đang thực hiện, sau đó Giai đoạn 2 và Giai đoạn 3 ở trạng thái Đang khóa. Thao tác chỉ chạy khi dự án chưa có giai đoạn.',
      async () => {
        setPhaseSetupLoading(true);
        try {
          const response = await fetch(`/api/admin/projects/${projectId}/phases/setup`, { method: 'POST' });
          const payload = await response.json().catch(() => null) as { message?: string } | null;
          if (!response.ok) throw new Error(payload?.message || 'Không thể thiết lập giai đoạn.');
          showToast('Đã thiết lập giai đoạn.', 'Dự án đã có 3 giai đoạn mặc định.', 'success');
          window.location.reload();
        } catch (error) {
          showToast('Không thể thiết lập giai đoạn.', error instanceof Error ? error.message : 'Vui lòng thử lại.', 'error');
          await loadPhaseSetup();
        } finally {
          setPhaseSetupLoading(false);
        }
      },
      { cancelLabel: 'Để sau', confirmLabel: 'Tạo 3 giai đoạn' }
    );
  };

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
    <>
      {phaseSetup?.canSetup && (
        <section className="rounded-lg border border-cyan-900 bg-cyan-950/20">
          <div className="border-b border-cyan-900/70 px-4 py-3">
            <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-cyan-300" /><h2 className="text-sm font-black text-slate-100">Thiết lập giai đoạn</h2></div>
            <p className="mt-1 text-[11px] text-slate-400">Dự án chưa có workflow. Tạo nhanh bộ 3 giai đoạn mặc định để bắt đầu vận hành.</p>
          </div>
          <div className="p-4 text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded border border-cyan-800 bg-cyan-950/30 p-2"><strong className="text-cyan-200">1</strong><p className="mt-1 text-slate-300">Đang thực hiện</p></div>
              <div className="rounded border border-slate-800 bg-slate-950/70 p-2"><strong className="text-slate-300">2</strong><p className="mt-1 text-slate-500">Đang khóa</p></div>
              <div className="rounded border border-slate-800 bg-slate-950/70 p-2"><strong className="text-slate-300">3</strong><p className="mt-1 text-slate-500">Đang khóa</p></div>
            </div>
            <button type="button" onClick={setupDefaultPhases} disabled={phaseSetupLoading || cancelled} className="mt-3 w-full rounded bg-cyan-600 px-3 py-2 font-bold text-white hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500">
              {phaseSetupLoading ? 'Đang thiết lập…' : 'Tạo 3 giai đoạn mặc định'}
            </button>
          </div>
        </section>
      )}

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
    </>
  );
}