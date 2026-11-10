'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';
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
const inputStyle = 'block w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-100';

async function readResponse<T>(result: Response): Promise<T> {
  const value = await result.json();
  if (!result.ok) throw new Error(value.error || 'Không thể tải đánh giá.');
  return value as T;
}

function EmployeeReviewDialog({ title, expanded, onClose, children }: {
  title: string; expanded: boolean; onClose: () => void; children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="employee-review-title"
      onCancel={event => { event.preventDefault(); onClose(); }}
      className={`admin-dialog fixed inset-0 m-auto text-slate-100 backdrop:bg-slate-950/80 ${expanded ? 'max-w-6xl' : 'max-w-xl'}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <h2 id="employee-review-title" className="text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} className="admin-button-secondary">Đóng</button>
      </header>
      {children}
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
    if (busy || (current && dirty && !window.confirm('Bỏ các thay đổi chưa lưu?'))) return;
    changeSelection();
    setEmployeeId('');
  }

  const monthPicker = (
    <label className="block text-sm">Kỳ đánh giá
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
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-700 p-4">
      <h2 className="font-semibold">{admin ? 'Bản làm việc của quản lý' : 'Tự đánh giá'}</h2>
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
          <div key={item.key} className={`rounded border border-slate-700 p-3 ${admin ? 'space-y-2' : 'grid gap-2 sm:grid-cols-[12rem_1fr]'}`}>
            <div>
              <label htmlFor={`review-score-${item.key}`} className="block text-sm font-medium">{item.title}</label>
              {admin && (
                <span id={`review-rubric-${item.key}`} className="my-2 block space-y-1 text-xs text-slate-300">
                  {item.descriptions.map((description, score) => (
                    <span key={description} className="block"><strong>{score} điểm</strong> · {description}</span>
                  ))}
                </span>
              )}
              <select id={`review-score-${item.key}`} aria-describedby={admin ? `review-rubric-${item.key}` : undefined} className={inputStyle} value={form.scores[index] ?? ''} onChange={event => {
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
        <button type="submit" disabled={!dirty} className="admin-button-secondary">{admin ? 'Lưu nháp' : 'Lưu tự đánh giá'}</button>
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
                <tr key={employee.id} className="hover:bg-slate-950/30">
                  <th scope="row" className="p-4 text-left font-bold text-slate-100">{employee.full_name}</th>
                  <td className="p-4 text-right">
                    <button type="button" disabled={!month || busy} className="admin-button-secondary"
                      aria-label={`Xem đánh giá của ${employee.full_name}`}
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
          <EmployeeReviewDialog title={recipient.full_name + ' · ' + month} expanded={editing} onClose={closeEmployee}>
            {feedback}
            {!current && !failure && <p role="status">Đang tải đánh giá…</p>}
            {current && (
              <div className={editing ? 'grid gap-4 lg:grid-cols-2' : 'space-y-4'}>
                <section className="min-w-0 space-y-3 rounded-xl border border-slate-700 p-4 lg:self-start">
                  <h3 className="font-semibold">Nhân viên tự đánh giá</h3>
                  {current.self ? <ReviewDetails content={current.self.content} /> : <p className="text-sm text-slate-400">Nhân viên chưa lưu tự đánh giá cho kỳ này.</p>}
                  <button type="button" className="admin-button-secondary" aria-expanded={editing} disabled={busy}
                    onClick={() => { setEditing(!editing); setPreview(false); }}>
                    {editing ? 'Thu gọn phần chấm' : saved ? 'Đánh giá tiếp' : 'Đánh giá'}
                  </button>
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
                    {saved && !sent && !dirty && !preview && (
                      <button type="button" disabled={busy} className="admin-button-secondary" onClick={() => setPreview(true)}>Xem trước kết quả</button>
                    )}
                    {preview && saved && !sent && !dirty && (
                      <section className="space-y-3 rounded-xl border border-blue-700 p-4">
                        <h2 className="font-semibold">Xem trước · gửi cho {recipient?.full_name} · {month}</h2>
                        <ReviewDetails content={saved.content} />
                        {existing && <label className="block text-sm">Lý do gửi bản hiệu chỉnh
                          <textarea className={inputStyle} maxLength={2000} value={correction} onChange={event => setCorrection(event.target.value)} />
                        </label>}
                        {saved.content.evidence.some(note => !note.trim()) && <p className="text-amber-300">Bổ sung bằng chứng hoặc lý do cho cả bốn tiêu chí trước khi gửi.</p>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={busy || (existing && correction.trim().length < 3) || saved.content.evidence.some(note => !note.trim())}
                            className="admin-button-secondary" onClick={() => void mutate('publish')}>Xác nhận gửi kết quả</button>
                          <button type="button" disabled={busy} className="admin-button-secondary" onClick={() => setPreview(false)}>Quay lại nháp</button>
                        </div>
                      </section>
                    )}
                  </div>
                )}
              </div>
            )}
          </EmployeeReviewDialog>
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-4 text-slate-100 sm:p-6">
      <h1 className="text-xl font-bold">Đánh giá năng lực</h1>
      <ReviewRubric />
      <div className="flex">{monthPicker}</div>
      {feedback}
      {!current && !failure && month && <p role="status">Đang tải đánh giá…</p>}
      {current && (
        <>
          {reviewForm}
          <h2 className="font-semibold">Kết quả đã gửi</h2>
          {history}
        </>
      )}
    </main>
  );
}
