// app/admin/email-editor/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useNotification } from '@/component/NotificationContext';
import { Mail, Plus, Trash2, Edit2, X, Save, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, RefreshCcw, Send, Sparkles } from 'lucide-react';

interface EmailTemplate {
  id: number;
  group_type?: string | null;
  template_name?: string | null;
  subject?: string | null;
  html_content?: string | null;
  body?: string | null;
}

interface EmailGroup { code: string; label: string }

const emptyForm = { groupType: 'WELCOME', scriptName: '', subject: '', body: '' };

export default function AdminEmailTemplates() {
  const { showToast, showConfirm } = useNotification();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [emailGroups, setEmailGroups] = useState<EmailGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const [selectedPreview, setSelectedPreview] = useState<EmailTemplate | null>(null);

  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // States Modal Popup Form
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 🔥 KHÔNG DÙNG WINDOW.PROMPT: Tạo Popup nhập email test cao cấp nội bộ
  const [showTestMailPopup, setShowTestMailPopup] = useState(false);
  const [testMailAddress, setTestMailAddress] = useState('admin@gmail.com');
  const [activeTestTemplate, setActiveTestTemplate] = useState<EmailTemplate | null>(null);
  const [sendingTestMail, setSendingTestMail] = useState(false);
  const testSendInFlight = useRef(false);
  const [testDeliveryResult, setTestDeliveryResult] = useState<string | null>(null);

  // Form Fields
  const [groupType, setGroupType] = useState('WELCOME');
  const [scriptName, setScriptName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [initialForm, setInitialForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const currentForm = { groupType, scriptName, subject, body };
  const isDirty = JSON.stringify(currentForm) !== JSON.stringify(initialForm);

  const loadData = async (isInitial = true) => {
    if (isInitial) setLoading(true);
    setDbError(null);
    try {
      const { data: metaGroup } = await supabase.from('system_metadata').select('data').eq('name', 'Danh mục Nhóm Email').maybeSingle();
      const dynamicGroups = (metaGroup?.data || [
        { "code": "WELCOME", "label": "📧 Thư Chào Mừng Thành Viên" },
        { "code": "ORDER_CONFIRM", "label": "📦 Xác Nhận Đơn Hàng Mới" },
        { "code": "SHIPPING", "label": "🚚 Thông Báo Giao Hàng Xuất Kho" },
        { "code": "ALERT_SYSTEM", "label": "⚠️ Cảnh Báo Nghẽn Dây Chuyền" }
      ]) as EmailGroup[];
      setEmailGroups(dynamicGroups);

      const { data, error } = await supabase.from('email_templates').select('*').order('id', { ascending: false });
      if (error) {
        setDbError(error.message);
      } else {
        setTemplates(data || []);
        if (data && data.length > 0 && !selectedPreview) {
          setSelectedPreview(data[0]);
        }
      }
    } catch {
      setDbError('Không thể tải danh sách mẫu email.');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => { loadData(true); }, []);

  const handleOpenAdd = () => {
    const next = { ...emptyForm, groupType: emailGroups[0]?.code || 'WELCOME' };
    setIsEditing(false); setEditingId(null); setScriptName(next.scriptName); setSubject(next.subject); setBody(next.body); setGroupType(next.groupType); setInitialForm(next);
    setShowModal(true);
  };

  const handleOpenEdit = (t: EmailTemplate) => {
    const next = { groupType: t.group_type || 'WELCOME', scriptName: t.template_name || '', subject: t.subject || '', body: t.html_content || t.body || '' };
    setIsEditing(true); setEditingId(t.id); setGroupType(next.groupType); setScriptName(next.scriptName); setSubject(next.subject); setBody(next.body); setInitialForm(next);
    setShowModal(true);
  };

  const handleGenerateSampleBody = () => {
    let sample = '';
    if (groupType === 'WELCOME') {
      sample = '<p style="color: #a855f7; font-weight: bold;">Chào sếp [customer_name],</p><p>Chào mừng sếp đã gia nhập hệ thống điều hành xưởng của chúng tôi! Tài khoản quản trị của sếp đã sẵn sàng.</p>';
    } else if (groupType === 'ORDER_CONFIRM') {
      sample = '<p style="color: #10b981; font-weight: bold;">✓ HẠCH TOÁN THÀNH CÔNG</p><p>Đơn hàng <strong>#[order_id]</strong> của sếp đã được phê duyệt đưa vào sản xuất với tổng giá trị <strong>[amount] đ</strong>.</p>';
    } else if (groupType === 'SHIPPING') {
      sample = '<p>Chào sếp [customer_name], đơn sản phẩm #[order_id] đã bốc xếp xuất kho thành công và đang trên đường vận chuyển hỏa tốc.</p>';
    } else {
      sample = '<p>Nội dung phôi mẫu kịch bản hệ thống cho phân hệ: ' + groupType + '</p>';
    }
    setBody(sample);
  };

  const handleTriggerTestMailModal = (t: EmailTemplate) => {
    setActiveTestTemplate(t);
    setSelectedPreview(t);
    setTestDeliveryResult(null);
    setShowTestMailPopup(true);
  };

  const executeSendTestEmail = async () => {
    if (testSendInFlight.current) return;
    if (!testMailAddress.trim()) return showToast('Thiếu địa chỉ', 'Vui lòng nhập email nhận thử nghiệm!', 'error');
    if (!activeTestTemplate?.id) return showToast('Thiếu template', 'Không xác định được template cần gửi thử.', 'error');

    testSendInFlight.current = true;
    setSendingTestMail(true);
    setTestDeliveryResult(null);

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          templateId: activeTestTemplate.id,
          recipient: testMailAddress.trim(),
        }),
      });

      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : null;

      if (!response.ok) {
        throw new Error(payload?.message || 'Không thể gửi email thử nghiệm.');
      }

      setTestDeliveryResult(`Đã gửi thành công. Mã tra cứu: ${payload?.correlationId || 'không có'}`);
      showToast(
        'Đã gửi email thử nghiệm',
        `Đã gửi mẫu [${activeTestTemplate?.template_name || ''}] tới ${testMailAddress.trim()}.`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi email test.';
      setTestDeliveryResult(message);
      showToast('Không thể gửi email thử nghiệm', message, 'error');
    } finally {
      testSendInFlight.current = false;
      setSendingTestMail(false);
    }
  };

  const handleSave = async () => {
    if (saving || !isDirty) return;
    setSaving(true);
    try {
      if (!scriptName.trim() || !subject.trim()) return showToast('Thiếu số liệu', 'Vui lòng điền đủ Tên kịch bản và Tiêu đề thư!', 'error');

      const payload = { group_type: groupType, template_name: scriptName.trim(), subject: subject.trim(), html_content: body.trim() };

      if (isEditing && editingId) {
        const { error } = await supabase.from('email_templates').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert([payload]);
        if (error) throw error;
      }

      setShowModal(false); setEditingId(null); await loadData(false);
      showToast('Đã lưu', 'Mẫu email đã được cập nhật.', 'success');
    } catch { showToast('Không thể lưu', 'Dữ liệu đã nhập vẫn được giữ lại. Vui lòng thử lại.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: number) => {
    // 🔥 ĐÃ VÁ: Sử dụng hộp thoại Confirm Modal bo góc cao cấp đồng bộ
    showConfirm('Xác nhận xóa kịch bản', 'Sếp có chắc chắn muốn xóa vĩnh viễn mẫu Email Template này ra khỏi hệ thống điều hành không?', async () => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) return showToast('Không thể xóa', 'Vui lòng thử lại.', 'error');
      if (selectedPreview?.id === id) setSelectedPreview(null);
      loadData(false);
      showToast('Đã xóa', 'Kịch bản đã được giải phóng khỏi danh mục tổng.', 'info');
    });
  };

  const filteredTemplates = templates.filter(t => {
    const matchGroup = selectedGroupFilter === 'ALL' || (t.group_type || '').toUpperCase().trim() === selectedGroupFilter.toUpperCase().trim();
    const matchText = !searchTerm.trim() ||
      (t.template_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.subject || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.html_content || t.body || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchGroup && matchText;
  });

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage) || 1;
  const currentData = filteredTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">

      {/* TIÊU ĐỀ TRANG */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-base font-bold">Mẫu email hệ thống</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Gửi thử chỉ hoạt động khi quản trị viên đã bật dịch vụ email.</p>
          </div>
        </div>
        <button onClick={handleOpenAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"><Plus className="w-4 h-4" /> Thêm Kịch Bản</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* KHỐI BÊN TRÁI: TABLE FLAT LIST */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <select className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-purple-300 font-black focus:outline-none w-full sm:w-56 cursor-pointer" value={selectedGroupFilter} onChange={(e) => { setSelectedGroupFilter(e.target.value); setCurrentPage(1); }}>
              <option value="ALL">🌐 Tất cả kịch bản ({templates.length})</option>
              {emailGroups.map(g => <option key={g.code} value={g.code}>{g.label}</option>)}
            </select>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="text" placeholder="Tìm tên kịch bản, tiêu đề..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr><th className="p-4 w-1/4">Thuộc Phân Hệ</th><th className="p-4 w-1/3">Tên Gọi Kịch Bản</th><th className="p-4 text-center w-32">Thao tác</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-[11px] font-medium">
                {loading && <tr><td colSpan={3} className="p-8 text-center text-slate-400">Đang tải mẫu email...</td></tr>}
                {!loading && dbError && <tr><td colSpan={3} className="p-8 text-center"><p className="text-red-300">{dbError}</p><button onClick={() => loadData(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-slate-200"><RefreshCcw className="h-4 w-4" />Thử lại</button></td></tr>}
                {!loading && !dbError && currentData.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-slate-400">Không tìm thấy mẫu email phù hợp.</td></tr>}
                {currentData.map(t => (
                  <tr key={t.id} onClick={() => setSelectedPreview(t)} className={`transition cursor-pointer ${selectedPreview?.id === t.id ? 'bg-purple-950/20 text-purple-300 font-bold border-l-2 border-purple-500' : 'hover:bg-slate-950/10'}`}>
                    <td className="p-4"><span className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-purple-400 font-mono font-bold text-[10px] block w-fit">{t.group_type}</span></td>
                    <td className="p-4 text-slate-200 font-bold">{t.template_name}</td>
                    <td className="p-4 text-center space-x-1 font-sans" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleTriggerTestMailModal(t)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-purple-400 hover:bg-purple-900/30 transition"><Send className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleOpenEdit(t)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-800 transition"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-red-950/20 transition"><Trash2 className="w-3.5 h-3.5"/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PHÂN TRANG */}
          <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400 select-none">
            <div>Tổng cộng <span className="text-purple-400 font-bold">{filteredTemplates.length}</span> mẫu</div>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 font-bold text-slate-200">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* KHỐI BÊN PHẢI: LIVE VIEW PREVIEW */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl h-fit">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h3 className="font-black text-slate-300 uppercase tracking-wider text-[10px]">Xem trước mẫu</h3>
          </div>
          {selectedPreview ? (
            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono leading-relaxed space-y-1">
                <p><span className="text-slate-500">Mã phân hệ:</span> <span className="text-purple-400 font-bold">{selectedPreview.group_type}</span></p>
                <p><span className="text-slate-500">Tiêu đề:</span> <span className="text-amber-400 font-bold select-all">{selectedPreview.subject}</span></p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800 text-[9px] text-slate-500 font-mono flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/60"></div><div className="w-2 h-2 rounded-full bg-amber-500/60"></div><div className="w-2 h-2 rounded-full bg-emerald-500/60"></div>
                </div>
                <div className="p-4 min-h-[160px] max-h-[320px] overflow-y-auto text-xs text-slate-300 bg-slate-950 text-left leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: selectedPreview.html_content || selectedPreview.body || '<span class="text-slate-500 italic">Bức thư trống.</span>' }} />
              </div>
            </div>
          ) : <p className="text-[11px] text-slate-600 font-mono italic text-center py-12">Chọn kịch bản bên trái để xem trước giao diện.</p>}
        </div>
      </div>

      {/* MODAL SỬA/THÊM KỊCH BẢN EMAIL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 text-xs text-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h2 className="font-bold uppercase text-purple-400 tracking-wide font-sans text-xs">{isEditing ? '📝 Sửa kịch bản email' : '✨ Thêm kịch bản email'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block">Phân hệ nhóm email:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-purple-400 font-bold focus:outline-none" value={groupType} onChange={(e) => setGroupType(e.target.value)}>
                  {emailGroups.map((g) => <option key={g.code} value={g.code}>📁 {g.label}</option>)}
                </select>
              </div>
              <div><label className="text-slate-400 font-bold block">Tên gọi kịch bản mẫu:</label><input className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 focus:outline-none text-slate-100 font-medium" value={scriptName} onChange={(e) => setScriptName(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold block">Tiêu đề thư gửi đi (Subject):</label><input className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 focus:outline-none text-slate-200 font-medium" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div>
                <div className="flex justify-between items-center"><label className="text-slate-400 font-bold block">Nội dung mã hóa văn bản HTML:</label><button type="button" onClick={handleGenerateSampleBody} className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 rounded-lg"><Sparkles className="w-3 h-3" /> Gen phôi mẫu</button></div>
                <textarea className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 text-xs h-36 resize-none focus:outline-none text-slate-300 font-mono leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2.5 border-t border-slate-800 font-sans"><button type="button" onClick={() => setShowModal(false)} disabled={saving} className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-slate-400 text-center disabled:opacity-50">Hủy</button>{isDirty && <button type="button" onClick={handleSave} disabled={saving} className="flex-1 p-3 bg-purple-600 text-white font-black rounded-xl shadow-lg disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" />{saving ? 'Đang lưu...' : 'Lưu'}</button>}</div>
          </div>
        </div>
      )}

      {/* Gửi email thử nghiệm: chỉ gửi tới địa chỉ Admin nhập rõ ràng. */}
      {showTestMailPopup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-lg space-y-4 shadow-2xl relative text-xs">
            <button aria-label="Đóng" onClick={() => setShowTestMailPopup(false)} disabled={sendingTestMail} className="absolute right-4 top-4 text-slate-500 hover:text-white disabled:opacity-50"><X className="w-4 h-4"/></button>
            <div><h4 className="text-sm font-black text-slate-100">Gửi email thử nghiệm</h4><p className="mt-1 text-slate-400">Xem trước mẫu và nhập rõ địa chỉ nhận. Thao tác này không gửi hàng loạt.</p></div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 p-3"><p className="font-bold text-amber-300">{activeTestTemplate?.subject || 'Chưa cập nhật tiêu đề'}</p><div className="mt-2 max-h-36 overflow-y-auto text-slate-300" dangerouslySetInnerHTML={{ __html: activeTestTemplate?.html_content || activeTestTemplate?.body || '<p>Chưa cập nhật nội dung</p>' }}/></div>
            <label className="block text-left"><span className="text-slate-400 font-bold">Email nhận thử nghiệm</span><input type="email" autoComplete="off" className="mt-1 w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-purple-300 focus:outline-none focus:border-purple-500" value={testMailAddress} onChange={e => setTestMailAddress(e.target.value)} /></label>
            {testDeliveryResult && <p role="status" className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-300">{testDeliveryResult}</p>}
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setShowTestMailPopup(false)} disabled={sendingTestMail} className="border border-slate-700 p-2.5 rounded-xl font-bold text-slate-300 disabled:opacity-50">Hủy</button><button onClick={executeSendTestEmail} disabled={sendingTestMail} className="bg-purple-600 text-white font-bold p-2.5 rounded-xl disabled:opacity-50">{sendingTestMail ? 'Đang gửi...' : 'Gửi email thử nghiệm'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
