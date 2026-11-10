'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClipboardCheck, X } from 'lucide-react';
import { AdminPageHeader } from '@/component/AdminUI';
import { PeopleListToolbar, PeopleSearch, peopleFilterClassName } from '@/component/admin/PeopleListToolbar';
import { CommonTable } from '@/component/data-table/CommonTable';
import type { AdminListErrorCode } from '@/hooks/useAdminListData';
import { businessMonthFromInstant, formatBusinessMonthInput } from '@/lib/business-date';
import { COMPETENCY_RUBRIC, COMPETENCY_WORK_GROUPS, emptyCompetencyScores, type CompetencyScores, type PublishedCompetencyReview } from '@/lib/competency-reviews';
import { ReviewDetails, ReviewRubric } from './ReviewDetails';

type Employee = { id: string; full_name: string };
const emptyEmployees: Employee[] = [];
type SavedReview = { content: CompetencyScores; revision: number };
type ReviewData = { draft?: SavedReview | null; self: SavedReview | null; published: PublishedCompetencyReview[] };
const managerFormId = 'employee-manager-review';
const inputStyle = 'block w-full min-w-0 rounded border border-slate-700 bg-slate-950 p-2 text-slate-100';

async function readResponse<T>(result: Response): Promise<T> {
  const value = await result.json();
  if (!result.ok) throw new Error(value.error || 'Không thể tải đánh giá.');
  return value as T;
}

function EmployeeReviewPanel({ employeeName, month, expanded, onClose, children, feedback, actions }: {
  employeeName: string;
  month: string;
  expanded: boolean;
  onClose: () => void;
  children: ReactNode;
  feedback: ReactNode;
  actions: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    closeButton.current?.focus();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="employee-review-title"
      aria-describedby="employee-review-period"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className={`employee-review-panel fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-slate-700 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-slate-950/60 sm:border-l ${expanded ? 'sm:max-w-5xl' : 'sm:max-w-xl'}`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-blue-300">Đánh giá năng lực</p>
            <h2 id="employee-review-title" className="mt-1 break-words text-lg font-bold">{employeeName}</h2>
            <p id="employee-review-period" className="mt-1 text-xs text-slate-400">Kỳ đánh giá {month}</p>
          </div>
          <button ref={closeButton} type="button" aria-label="Đóng panel" onClick={onClose} className="admin-icon-button shrink-0">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
        <footer className="shrink-0 space-y-2 border-t border-slate-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          {feedback}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="admin-button-secondary">Đóng</button>
            {actions}
          </div>
        </footer>
      </div>
    </dialog>
  );
}

export default function CompetencyWorkspace({
  admin, initialEmployeeId = '', reviewEmployees, rosterError, onRetryRoster,
}: {
  admin: boolean;
  initialEmployeeId?: string;
  reviewEmployees?: Employee[];
  rosterError?: AdminListErrorCode | null;
  onRetryRoster?: () => Promise<void>;
}) {
  const endpoint = `/api/${admin ? 'admin' : 'staff'}/competency-reviews`;
  const employees = reviewEmployees ?? emptyEmployees;
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [month, setMonth] = useState(() => formatBusinessMonthInput(businessMonthFromInstant(new Date())));
  const [data, setData] = useState<{ key: string; review: ReviewData }>();
  const [form, setForm] = useState(emptyCompetencyScores);
  const [correction, setCorrection] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const [reload, setReload] = useState(0);
  const editorTitle = useRef<HTMLHeadingElement>(null);
  const key = `${employeeId}/${month}`;
  const current = data?.key === key ? data.review : undefined;
  const saved = admin ? current?.draft : current?.self;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved?.content ?? emptyCompetencyScores());
  const publicationsInMonth = current?.published.filter(item => item.month === month + '-01') ?? [];
  const existing = publicationsInMonth.length > 0;
  const sent = admin && publicationsInMonth.some(item => item.revision === saved?.revision);
  const recipient = employees.find(item => item.id === employeeId);
  const hasRecipient = Boolean(recipient);
  const searchKey = search.trim().toLocaleLowerCase('vi-VN');
  const filteredEmployees = employees.filter(employee => employee.full_name.toLocaleLowerCase('vi-VN').includes(searchKey));

  useEffect(() => {
    if ((admin && !hasRecipient) || !month) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ month });
    if (admin) params.set('employee', employeeId);
    fetch(endpoint + '?' + params, { signal: controller.signal, cache: 'no-store' })
      .then(readResponse<ReviewData>)
      .then(review => {
        if (controller.signal.aborted) return;
        setData({ key, review });
        setForm((admin ? review.draft : review.self)?.content ?? emptyCompetencyScores());
        setFailure('');
      })
      .catch(error => { if (!controller.signal.aborted) setFailure(error.message); });
    return () => controller.abort();
  }, [admin, employeeId, endpoint, hasRecipient, key, month, reload]);

  useEffect(() => {
    if (admin && editing) editorTitle.current?.focus();
  }, [admin, editing, preview]);

  async function mutate(action: 'save' | 'publish' | 'view', id?: string) {
    if (!current || busy) return;
    setBusy(true);
    setFailure('');
    setNotice('');
    try {
      await readResponse(await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id, month, employeeId: Number(employeeId), revision: saved?.revision ?? 0,
          selfRevision: current.self?.revision ?? 0, correction, content: form }),
      }));
      setNotice(action === 'save' ? (admin ? 'Đã lưu nháp.' : 'Đã lưu tự đánh giá.') : action === 'publish' ? 'Đã gửi kết quả.' : 'Đã đánh dấu đã xem.');
      if (action === 'view') {
        setData({ key, review: { ...current, published: current.published.map(item => item.id === id
          ? { ...item, viewed_at: new Date().toISOString() } : item) } });
        return;
      }
      setPreview(false);
      setCorrection('');
      setData(undefined);
      setReload(value => value + 1);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Không thể lưu kết quả.');
    } finally {
      setBusy(false);
    }
  }

  function changeSelection() {
    setData(undefined);
    setEditing(false);
    setPreview(false);
    setCorrection('');
    setFailure('');
    setNotice('');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void mutate('save');
  }

  function closeEmployee() {
    if (busy || (current && (dirty || (preview && correction.trim())) && !window.confirm('Bỏ các thay đổi chưa lưu?'))) return;
    changeSelection();
    setEmployeeId('');
  }

  const monthPicker = (
    <label className="block max-w-full text-sm">Kỳ tự đánh giá
      <input className={inputStyle} type="month" min="2000-01" max="2099-12" value={month} disabled={busy}
        onChange={event => { changeSelection(); setMonth(event.target.value); }} />
    </label>
  );
  const feedback = (
    <>
      {notice && <p role="status" className="text-emerald-300">{notice}</p>}
      {failure && (
        <p role="alert" className="text-red-300">{failure}{' '}
          <button type="button" className="underline" disabled={busy} onClick={() => { changeSelection(); setReload(value => value + 1); }}>Tải lại</button>
        </p>
      )}
    </>
  );
  const reviewForm = (
    <form id={admin ? managerFormId : undefined} onSubmit={submit} className={admin ? 'space-y-3 rounded-xl border border-slate-700 p-4' : 'space-y-3'}>
      {admin && <h3 ref={editorTitle} tabIndex={-1} className="font-semibold">Bản làm việc của quản lý</h3>}
      <fieldset disabled={busy || preview} className="space-y-3">
        <legend className="text-sm">Nhóm việc đã thực hiện</legend>
        <div className="flex flex-wrap gap-3 text-sm">
          {COMPETENCY_WORK_GROUPS.map(group => (
            <label key={group} className="flex items-center gap-1">
              <input type="checkbox" checked={form.workGroups.includes(group)} onChange={event => {
                const checked = event.target.checked;
                setForm(value => ({ ...value, workGroups: checked ? [...value.workGroups, group] : value.workGroups.filter(item => item !== group) }));
              }} />
              {group}
            </label>
          ))}
        </div>
        {COMPETENCY_RUBRIC.map((item, index) => (
          <div key={item.key} className="space-y-2 rounded-lg border border-slate-700 p-3">
            <div>
              <label htmlFor={`review-score-${item.key}`} className="block text-sm font-medium">{item.title}</label>
              <span id={`review-rubric-${item.key}`} className="my-2 block space-y-1 text-xs text-slate-300">
                {item.descriptions.map((description, score) => (
                  <span key={description} className="block"><strong>{score} điểm</strong> · {description}</span>
                ))}
              </span>
              <select id={`review-score-${item.key}`} aria-describedby={`review-rubric-${item.key}`} className={inputStyle} value={form.scores[index] ?? ''} onChange={event => {
                const score = event.target.value === '' ? null : Number(event.target.value) as 0 | 1 | 2;
                setForm(value => ({ ...value, scores: value.scores.map((old, i) => i === index ? score : old) }));
              }}>
                <option value="">Chưa đánh giá</option>
                <option value="0">0 điểm</option><option value="1">1 điểm</option><option value="2">2 điểm</option>
              </select>
            </div>
            <label className="block text-sm">Bằng chứng hoặc lý do chưa đánh giá · {item.title}
              <textarea className={inputStyle} maxLength={2000} value={form.evidence[index]} onChange={event => {
                const note = event.target.value;
                setForm(value => ({ ...value, evidence: value.evidence.map((old, i) => i === index ? note : old) }));
              }} />
            </label>
          </div>
        ))}
        {([
          ['strengths', 'Điểm mạnh'], ['improvements', 'Cần cải thiện'], ['goals', 'Mục tiêu'],
        ] as const).map(([field, label]) => (
          <label key={field} className="block text-sm">{label}
            <textarea className={inputStyle} maxLength={2000} value={form[field]} onChange={event => {
              const value = event.target.value;
              setForm(previous => ({ ...previous, [field]: value }));
            }} />
          </label>
        ))}
        {!admin && <button type="submit" disabled={!dirty} className="admin-button-secondary">Lưu tự đánh giá</button>}
      </fieldset>
    </form>
  );
  const history = current && (
    <section className="space-y-3">
      {current.published.length === 0 && <p className="text-slate-400">Chưa có kết quả đánh giá được gửi.</p>}
      {current.published.map(result => (
        <details key={result.id} className="space-y-3 rounded-xl border border-slate-700 p-4">
          <summary className="cursor-pointer">
            {result.month.slice(0, 7)} · {result.publisher_name} · {new Date(result.published_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {result.viewed_at ? 'Đã xem' : 'Chưa xem'}
          </summary>
          <ReviewRubric rubric={result.rubric} />
          <h3 className="font-semibold">Điểm quản lý</h3>
          <ReviewDetails content={result.manager} rubric={result.rubric} />
          {result.self_review && <><h3 className="font-semibold">Điểm tự đánh giá</h3><ReviewDetails content={result.self_review} rubric={result.rubric} /></>}
          {result.correction && <p className="break-words text-sm">Lý do hiệu chỉnh · {result.correction}</p>}
          {!admin && !result.viewed_at && <button type="button" disabled={busy} className="admin-button-secondary" onClick={() => void mutate('view', result.id)}>Đánh dấu đã xem</button>}
        </details>
      ))}
    </section>
  );

  if (admin) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Đánh giá năng lực"
          description="Xem bản tự đánh giá, chấm điểm và gửi kết quả cho nhân viên."
          icon={ClipboardCheck}
        />
        <section className="admin-table-shell">
          <PeopleListToolbar title="Danh sách nhân viên" count={reviewEmployees ? filteredEmployees.length : undefined}>
            <input className={peopleFilterClassName} type="month" aria-label="Kỳ đánh giá" title="Kỳ đánh giá"
              min="2000-01" max="2099-12" value={month} disabled={busy}
              onChange={event => { changeSelection(); setMonth(event.target.value); }} />
            <PeopleSearch placeholder="Tìm tên nhân viên..." value={search} onChange={setSearch} />
          </PeopleListToolbar>
          {reviewEmployees && employeeId && !recipient && (
            <p role="status" className="border-b border-slate-800 px-5 py-3 text-xs text-slate-400">Tài khoản này không có trong danh sách đánh giá.</p>
          )}
          <CommonTable className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase text-slate-400">
              <tr>
                <th scope="col" className="p-4">Nhân sự</th>
                <th scope="col" className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmployees.map(employee => (
                <tr key={employee.id} className={employee.id === employeeId ? 'bg-slate-800/50' : 'hover:bg-slate-950/30'}>
                  <th scope="row" className="p-4 text-left font-bold text-slate-100">{employee.full_name}</th>
                  <td className="p-4 text-right">
                    <button type="button" disabled={!month || busy} className="admin-button-secondary"
                      aria-label={`Xem đánh giá của ${employee.full_name}`} aria-haspopup="dialog"
                      onClick={() => { changeSelection(); setEmployeeId(employee.id); }}>
                      Xem đánh giá
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredEmployees.length && (
                <tr>
                  <td colSpan={2} className="p-6 text-center text-slate-400">
                    {rosterError ? (
                      <div role="alert">
                        <p>{rosterError === 'forbidden' ? 'Bạn không có quyền xem danh sách nhân sự.' : 'Không thể tải danh sách nhân viên.'}</p>
                        {rosterError !== 'forbidden' && onRetryRoster && (
                          <button type="button" onClick={() => void onRetryRoster()} className="admin-button-secondary mt-3">Thử lại</button>
                        )}
                      </div>
                    ) : reviewEmployees ? (
                      searchKey ? 'Không tìm thấy nhân viên phù hợp.' : 'Chưa có nhân viên đủ điều kiện đánh giá.'
                    ) : (
                      <span role="status">Đang tải danh sách nhân viên…</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </CommonTable>
        </section>
        {recipient && (
          <EmployeeReviewPanel
            employeeName={recipient.full_name}
            month={month}
            expanded={editing}
            onClose={closeEmployee}
            feedback={feedback}
            actions={current && (
              <>
                {preview ? (
                  <>
                    <button type="button" disabled={busy} className="admin-button-secondary" onClick={() => setPreview(false)}>Quay lại nháp</button>
                    {saved && !sent && !dirty && (
                      <button type="button" disabled={busy || (existing && correction.trim().length < 3) || saved.content.evidence.some(note => !note.trim())}
                        className="admin-button-primary" onClick={() => void mutate('publish')}>Xác nhận gửi kết quả</button>
                    )}
                  </>
                ) : editing ? (
                  <>
                    <button type="submit" form={managerFormId} disabled={busy || !dirty} className="admin-button-primary">Lưu nháp</button>
                    {saved && !sent && !dirty && (
                      <button type="button" disabled={busy} className="admin-button-secondary" onClick={() => setPreview(true)}>Xem trước kết quả</button>
                    )}
                  </>
                ) : (
                  <button type="button" disabled={busy} className="admin-button-primary" onClick={() => setEditing(true)}>
                    {saved ? 'Đánh giá tiếp' : 'Đánh giá'}
                  </button>
                )}
              </>
            )}
          >
            {!current && !failure && <p role="status">Đang tải đánh giá…</p>}
            {current && (
              <div className={editing ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
                <section className="min-w-0 space-y-3 rounded-xl border border-slate-700 p-4 lg:self-start">
                  <h3 className="font-semibold">Nhân viên tự đánh giá</h3>
                  {current.self ? <ReviewDetails content={current.self.content} /> : <p className="text-sm text-slate-400">Nhân viên chưa lưu tự đánh giá cho kỳ này.</p>}
                  {editing && !preview && (
                    <button type="button" className="admin-button-secondary" disabled={busy} onClick={() => setEditing(false)}>
                      Thu gọn phần chấm
                    </button>
                  )}
                  {current.published.length > 0 && (
                    <details className="space-y-3 border-t border-slate-800 pt-3">
                      <summary className="cursor-pointer text-sm font-semibold">Lịch sử kết quả đã gửi</summary>
                      {history}
                    </details>
                  )}
                </section>
                {editing && (
                  <div className="min-w-0 space-y-3">
                    {!preview && reviewForm}
                    {sent && !dirty && <p className="text-sm text-emerald-300">Phiên bản này đã gửi.</p>}
                    {preview && saved && !sent && !dirty && (
                      <section className="space-y-3 rounded-xl border border-blue-700 p-4">
                        <h3 ref={editorTitle} tabIndex={-1} className="font-semibold">Xem trước kết quả gửi cho {recipient.full_name}</h3>
                        <ReviewDetails content={saved.content} />
                        {existing && <label className="block text-sm">Lý do gửi bản hiệu chỉnh
                          <textarea className={inputStyle} maxLength={2000} value={correction} onChange={event => setCorrection(event.target.value)} />
                        </label>}
                        {saved.content.evidence.some(note => !note.trim()) && <p className="text-amber-300">Bổ sung bằng chứng hoặc lý do cho cả bốn tiêu chí trước khi gửi.</p>}
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}
          </EmployeeReviewPanel>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 text-sm text-slate-100">
      {feedback}
      {!current && !failure && month && <p role="status" className="text-slate-400">Đang tải đánh giá…</p>}
      <section aria-labelledby="staff-competency-results" className="space-y-2">
        <h4 id="staff-competency-results" className="font-semibold">Kết quả quản lý đã gửi</h4>
        {history}
      </section>
      <details className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4">
        <summary className="cursor-pointer font-semibold">Tự đánh giá</summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-400">Chọn kỳ cần tự đánh giá. Tổng điểm tối đa là 8.</p>
          <div className="flex">{monthPicker}</div>
          {current && reviewForm}
        </div>
      </details>
    </div>
  );
}
