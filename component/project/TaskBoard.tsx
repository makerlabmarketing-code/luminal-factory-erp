'use client';

import { useRef, useState } from 'react';
import AdminSidePanel from '@/component/AdminSidePanel';
import { STAFF_TASK_LABELS } from '@/lib/staff-task-actions';
import { dropStatus, TASK_BOARD_COLUMNS } from '@/lib/task-board';
import type { TaskAssignmentStatus } from '@/lib/types/task-assignment';

export interface TaskBoardCard {
  id: number;
  title: string;
  status: TaskAssignmentStatus;
  assignee?: string | null;
  phase?: string | null;
  deadline?: string | null;
  description?: string | null;
}

export default function TaskBoard({ cards, getTransitions, onMove, onRefresh, connected }: {
  cards: TaskBoardCard[];
  getTransitions: (card: TaskBoardCard) => readonly TaskAssignmentStatus[];
  onMove: (card: TaskBoardCard, next: TaskAssignmentStatus, comment: string) => Promise<string | void>;
  onRefresh: () => Promise<unknown>;
  connected: boolean;
}) {
  const [dragging, setDragging] = useState<TaskBoardCard | null>(null);
  const [highlightedColumn, setHighlightedColumn] = useState<string>();
  const [selection, setSelection] = useState<{ card: TaskBoardCard; next?: TaskAssignmentStatus }>();
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingLock = useRef(false);
  const selected = selection && cards.find(card => card.id === selection.card.id);
  const stale = Boolean(selection && selected?.status !== selection.card.status);
  const requiresComment = selection?.next === 'REVISION_REQUIRED' || selection?.next === 'BLOCKED';

  function select(card: TaskBoardCard, next?: TaskAssignmentStatus) {
    setSelection({ card, next });
    setComment('');
    setError('');
  }

  async function move(card: TaskBoardCard, next: TaskAssignmentStatus, note: string) {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError('');
    try {
      const message = await onMove(card, next, note.trim());
      if (message) {
        setSelection({ card, next });
        setError(message);
        await onRefresh().catch(() => {});
      } else {
        setSelection(undefined);
      }
    } catch (failure) {
      setSelection({ card, next });
      setError(failure instanceof Error ? failure.message : 'Không thể chuyển công việc.');
      await onRefresh().catch(() => {});
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span role="status">{connected ? 'Đồng bộ trực tiếp' : 'Đồng bộ thủ công'}</span>
        <button type="button" onClick={() => void onRefresh()} disabled={saving} className="admin-button-secondary">Làm mới bảng</button>
      </div>
      <div className="flex min-w-0 items-start gap-3 overflow-x-auto pb-3" aria-label="Bảng công việc">
        {TASK_BOARD_COLUMNS.map(column => {
          const columnCards = cards.filter(card => column.statuses.includes(card.status));
          const target = dragging && dropStatus(dragging.status, column.statuses, getTransitions(dragging));
          if ((column.id === 'cancelled' || column.id === 'blocked') && !columnCards.length && !target) return null;
          return (
            <section key={column.id} aria-label={column.title}
              onDragOver={event => { if (target && !saving) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setHighlightedColumn(column.id); } }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHighlightedColumn(undefined); }}
              onDrop={event => {
                event.preventDefault();
                setHighlightedColumn(undefined);
                setDragging(null);
                if (!dragging || !target || saving) return;
                if (target === 'REVISION_REQUIRED' || target === 'BLOCKED' || target === 'CANCELLED') select(dragging, target);
                else void move(dragging, target, '');
              }}
              className={`w-56 shrink-0 rounded-xl border bg-slate-950/70 p-2.5 ${highlightedColumn === column.id && target ? 'border-blue-400' : 'border-slate-800'}`}>
              <h3 className="mb-2 flex items-center justify-between gap-2 px-1 text-xs font-semibold text-slate-200">{column.title}<span className="text-slate-400">{columnCards.length}</span></h3>
              <ul className="min-h-20 space-y-2">
                {columnCards.map(card => (
                  <li key={card.id}>
                    <button type="button" draggable={!saving && getTransitions(card).length > 0}
                      onDragStart={event => { event.dataTransfer.setData('text/plain', String(card.id)); event.dataTransfer.effectAllowed = 'move'; setDragging(card); }}
                      onDragEnd={() => { setDragging(null); setHighlightedColumn(undefined); }}
                      onClick={() => select(card)} disabled={saving}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-3 text-left text-xs hover:border-slate-500 disabled:opacity-60">
                      <span className="block break-words font-semibold text-slate-100">{card.title}</span>
                      <span className="mt-1 block break-words text-slate-400">{card.assignee || 'Chưa phân công'}{card.phase ? ` · ${card.phase}` : ''}</span>
                      {card.deadline && <span className="mt-1 block text-slate-400">Hạn {card.deadline.slice(0, 10).split('-').reverse().join('/')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {selection && (
        <AdminSidePanel title={selection.card.title} description={selected ? STAFF_TASK_LABELS[selected.status] : undefined}
          onClose={() => setSelection(undefined)} busy={saving}
          actions={selection.next && <button type="button" className="admin-button-primary"
            disabled={saving || stale || !selected || !getTransitions(selected).includes(selection.next) || (requiresComment && !comment.trim())}
            onClick={() => { if (selection.next) void move(selection.card, selection.next, comment); }}>
            {saving ? 'Đang lưu…' : 'Lưu trạng thái'}
          </button>}>
          {selected?.description && <p className="mb-4 whitespace-pre-wrap break-words text-sm text-slate-200">{selected.description}</p>}
          {selected?.phase && <p className="mb-2 text-sm text-slate-400">{selected.phase}</p>}
          {selected?.assignee && <p className="mb-4 text-sm text-slate-400">{selected.assignee}</p>}
          {error && <p role="alert" className="mb-3 text-sm text-rose-300">{error}</p>}
          {stale && <div className="space-y-2 text-sm text-amber-200">
            <p>Công việc vừa được cập nhật.</p>
            {selected && <button type="button" className="admin-button-secondary" onClick={() => { setSelection({ card: selected }); setError(''); }}>Xem trạng thái mới</button>}
          </div>}
          {selected && !stale && getTransitions(selected).length > 0 && <>
            <label className="admin-label">Chuyển trạng thái
              <select className="admin-field mt-1" value={selection.next || ''} disabled={saving}
                onChange={event => setSelection({ ...selection, next: (event.target.value || undefined) as TaskAssignmentStatus | undefined })}>
                <option value="">Chọn trạng thái</option>
                {getTransitions(selected).map(status => <option key={status} value={status}>{STAFF_TASK_LABELS[status]}</option>)}
              </select>
            </label>
            {selection.next && <label className="admin-label mt-4">
              {requiresComment ? 'Lý do (bắt buộc)' : 'Bình luận'}
              <textarea className="admin-field mt-1" maxLength={2000} rows={4} value={comment} disabled={saving} onChange={event => setComment(event.target.value)} />
            </label>}
          </>}
        </AdminSidePanel>
      )}
    </div>
  );
}
