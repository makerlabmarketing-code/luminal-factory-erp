// app/admin/email-editor/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Mail, Plus, Trash2, Edit2, X, Save, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, RefreshCcw, Send, Sparkles } from 'lucide-react';

export default function AdminEmailTemplates() {
  const { showToast, showConfirm } = useNotification();
  const [templates, setTemplates] = useState<any[]>([]);
  const [emailGroups, setEmailGroups] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [selectedPreview, setSelectedPreview] = useState<any>(null);

  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 
  const [pageInput, setPageInput] = useState('1');

  // States Modal Popup Form
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // ðŸ”¥ KHÃ”NG DÃ™NG WINDOW.PROMPT: Táº¡o Popup nháº­p email test cao cáº¥p ná»™i bá»™
  const [showTestMailPopup, setShowTestMailPopup] = useState(false);
  const [testMailAddress, setTestMailAddress] = useState('admin@gmail.com');
  const [activeTestTemplate, setActiveTestTemplate] = useState<any>(null);
  const [sendingTestMail, setSendingTestMail] = useState(false);

  // Form Fields
  const [groupType, setGroupType] = useState('WELCOME');
  const [scriptName, setScriptName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const loadData = async (isInitial = true) => {
    if (isInitial) setLoading(true);
    setDbError(null);
    try {
      const { data: metaGroup } = await supabase.from('system_metadata').select('data').eq('name', 'Danh má»¥c NhÃ³m Email').maybeSingle();
      const dynamicGroups = metaGroup?.data || [
        { "code": "WELCOME", "label": "ðŸ“§ ThÆ° ChÃ o Má»«ng ThÃ nh ViÃªn" },
        { "code": "ORDER_CONFIRM", "label": "ðŸ“¦ XÃ¡c Nháº­n ÄÆ¡n HÃ ng Má»›i" },
        { "code": "SHIPPING", "label": "ðŸšš ThÃ´ng BÃ¡o Giao HÃ ng Xuáº¥t Kho" },
        { "code": "ALERT_SYSTEM", "label": "âš ï¸ Cáº£nh BÃ¡o Ngháº½n DÃ¢y Chuyá»n" }
      ];
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
    } catch (err: any) {
      setDbError(err?.message || 'Lá»—i káº¿t ná»‘i máº¡ng Ä‘Ã¡m mÃ¢y Cloud');
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => { loadData(true); }, []);

  const handleOpenAdd = () => {
    setIsEditing(false); setEditingId(null); setScriptName(''); setSubject(''); setBody('');
    if (emailGroups.length > 0) setGroupType(emailGroups[0].code);
    setShowModal(true);
  };

  const handleOpenEdit = (t: any) => {
    setIsEditing(true); setEditingId(t.id); setGroupType(t.group_type || 'WELCOME'); setScriptName(t.template_name || ''); 
    setSubject(t.subject || ''); setBody(t.html_content || t.body || ''); 
    setShowModal(true);
  };

  const handleGenerateSampleBody = () => {
    let sample = '';
    if (groupType === 'WELCOME') {
      sample = '<p style="color: #a855f7; font-weight: bold;">ChÃ o sáº¿p [customer_name],</p><p>ChÃ o má»«ng sáº¿p Ä‘Ã£ gia nháº­p há»‡ thá»‘ng Ä‘iá»u hÃ nh xÆ°á»Ÿng cá»§a chÃºng tÃ´i! TÃ i khoáº£n quáº£n trá»‹ cá»§a sáº¿p Ä‘Ã£ sáºµn sÃ ng.</p>';
    } else if (groupType === 'ORDER_CONFIRM') {
      sample = '<p style="color: #10b981; font-weight: bold;">âœ“ Háº CH TOÃN THÃ€NH CÃ”NG</p><p>ÄÆ¡n hÃ ng <strong>#[order_id]</strong> cá»§a sáº¿p Ä‘Ã£ Ä‘Æ°á»£c phÃª duyá»‡t Ä‘Æ°a vÃ o sáº£n xuáº¥t vá»›i tá»•ng giÃ¡ trá»‹ <strong>[amount] Ä‘</strong>.</p>';
    } else if (groupType === 'SHIPPING') {
      sample = '<p>ChÃ o sáº¿p [customer_name], Ä‘Æ¡n sáº£n pháº©m #[order_id] Ä‘Ã£ bá»‘c xáº¿p xuáº¥t kho thÃ nh cÃ´ng vÃ  Ä‘ang trÃªn Ä‘Æ°á»ng váº­n chuyá»ƒn há»a tá»‘c.</p>';
    } else {
      sample = '<p>Ná»™i dung phÃ´i máº«u ká»‹ch báº£n há»‡ thá»‘ng cho phÃ¢n há»‡: ' + groupType + '</p>';
    }
    setBody(sample);
  };

  const handleTriggerTestMailModal = (t: any) => {
    setActiveTestTemplate(t);
    setShowTestMailPopup(true);
  };

  const executeSendTestEmail = async () => {
    if (!testMailAddress.trim()) return showToast('Thiếu địa chỉ', 'Vui lòng nhập email nhận thử nghiệm!', 'error');
    if (!activeTestTemplate?.id) return showToast('Thiếu template', 'Không xác định được template cần gửi thử.', 'error');

    setSendingTestMail(true);

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
        throw new Error(payload?.error || 'Không thể gửi email test.');
      }

      setShowTestMailPopup(false);
      showToast(
        'Gửi SMTP',
        `Đã gửi thử template [${activeTestTemplate?.template_name || ''}] tới ${testMailAddress.trim()} thành công!`,
        'success'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi email test.';
      showToast('SMTP lỗi', message, 'error');
    } finally {
      setSendingTestMail(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!scriptName.trim() || !subject.trim()) return showToast('Thiáº¿u sá»‘ liá»‡u', 'Vui lÃ²ng Ä‘iá»n Ä‘á»§ TÃªn ká»‹ch báº£n vÃ  TiÃªu Ä‘á» thÆ°!', 'error');
      
      const payload = { group_type: groupType, template_name: scriptName.trim(), subject: subject.trim(), html_content: body.trim() };
      
      if (isEditing && editingId) {
        await supabase.from('email_templates').update(payload).eq('id', editingId);
      } else {
        await supabase.from('email_templates').insert([payload]);
      }
      
      setShowModal(false); setEditingId(null); await loadData(false);
      showToast('ThÃ nh cÃ´ng', 'âœ¨ Ká»‹ch báº£n Email má»›i Ä‘Ã£ Ä‘Æ°á»£c ghi nháº­n vÃ  Ä‘á»“ng bá»™ trá»±c tiáº¿p lÃªn Cloud!', 'success');
    } catch (catchErr: any) { showToast('Lá»—i phÃ¡t sinh', catchErr.message, 'error'); }
  };

  const handleDelete = (id: number) => {
    // ðŸ”¥ ÄÃƒ VÃ: Sá»­ dá»¥ng há»™p thoáº¡i Confirm Modal bo gÃ³c cao cáº¥p Ä‘á»“ng bá»™
    showConfirm('XÃ¡c nháº­n xÃ³a ká»‹ch báº£n', 'Sáº¿p cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a vÄ©nh viá»…n máº«u Email Template nÃ y ra khá»i há»‡ thá»‘ng Ä‘iá»u hÃ nh khÃ´ng?', async () => {
      await supabase.from('email_templates').delete().eq('id', id);
      if (selectedPreview?.id === id) setSelectedPreview(null);
      loadData(false);
      showToast('ÄÃ£ xÃ³a', 'Ká»‹ch báº£n Ä‘Ã£ Ä‘Æ°á»£c giáº£i phÃ³ng khá»i danh má»¥c tá»•ng.', 'info');
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
      
      {/* HEADER Tá»”NG */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-base font-bold">Ká»‹ch Báº£n Email Templates Há»‡ Thá»‘ng</h1>
            <p className="text-[11px] text-purple-400 font-mono font-bold mt-0.5">âœ“ Cá»•ng SMTP viá»…n thÃ´ng sáºµn sÃ ng phÃ¡t lá»‡nh Ä‘iá»u hÃ nh tá»± Ä‘á»™ng</p>
          </div>
        </div>
        <button onClick={handleOpenAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"><Plus className="w-4 h-4" /> ThÃªm Ká»‹ch Báº£n</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* KHá»I BÃŠN TRÃI: TABLE FLAT LIST */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <select className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-purple-300 font-black focus:outline-none w-full sm:w-56 cursor-pointer" value={selectedGroupFilter} onChange={(e) => { setSelectedGroupFilter(e.target.value); setCurrentPage(1); }}>
              <option value="ALL">ðŸŒ Táº¥t cáº£ ká»‹ch báº£n ({templates.length})</option>
              {emailGroups.map(g => <option key={g.code} value={g.code}>{g.label}</option>)}
            </select>
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="text" placeholder="TÃ¬m tÃªn ká»‹ch báº£n, tiÃªu Ä‘á»..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setPageInput('1'); }} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px] tracking-wider">
                <tr><th className="p-4 w-1/4">Thuá»™c PhÃ¢n Há»‡</th><th className="p-4 w-1/3">TÃªn Gá»i Ká»‹ch Báº£n</th><th className="p-4 text-center w-32">Thao tÃ¡c</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-[11px] font-medium">
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

          {/* PHÃ‚N TRANG */}
          <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400 select-none">
            <div>Total <span className="text-purple-400 font-bold">{filteredTemplates.length}</span> items</div>
            <div className="flex gap-1">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 font-bold text-slate-200">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* KHá»I BÃŠN PHáº¢I: LIVE VIEW PREVIEW */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl h-fit">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2.5">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h3 className="font-black text-slate-300 uppercase tracking-wider text-[10px]">Live Body Preview</h3>
          </div>
          {selectedPreview ? (
            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono leading-relaxed space-y-1">
                <p><span className="text-slate-500">MÃ£ phÃ¢n há»‡:</span> <span className="text-purple-400 font-bold">{selectedPreview.group_type}</span></p>
                <p><span className="text-slate-500">TiÃªu Ä‘á» (Subject):</span> <span className="text-amber-400 font-bold select-all">{selectedPreview.subject}</span></p>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
                <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800 text-[9px] text-slate-500 font-mono flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-500/60"></div><div className="w-2 h-2 rounded-full bg-amber-500/60"></div><div className="w-2 h-2 rounded-full bg-emerald-500/60"></div>
                </div>
                <div className="p-4 min-h-[160px] max-h-[320px] overflow-y-auto text-xs text-slate-300 bg-slate-950 text-left leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: selectedPreview.html_content || selectedPreview.body || '<span class="text-slate-500 italic">Bá»©c thÆ° trá»‘ng.</span>' }} />
              </div>
            </div>
          ) : <p className="text-[11px] text-slate-600 font-mono italic text-center py-12">Chá»n ká»‹ch báº£n bÃªn trÃ¡i Ä‘á»ƒ xem trÆ°á»›c giao diá»‡n.</p>}
        </div>
      </div>

      {/* MODAL Sá»¬A/THÃŠM Ká»ŠCH Báº¢N EMAIL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 text-xs text-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h2 className="font-bold uppercase text-purple-400 tracking-wide font-sans text-xs">{isEditing ? 'ðŸ“ Sá»­a ká»‹ch báº£n email' : 'âœ¨ ThÃªm ká»‹ch báº£n email'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold block">PhÃ¢n há»‡ nhÃ³m email:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-purple-400 font-bold focus:outline-none" value={groupType} onChange={(e) => setGroupType(e.target.value)}>
                  {emailGroups.map((g: any) => <option key={g.code} value={g.code}>ðŸ“ {g.label}</option>)}
                </select>
              </div>
              <div><label className="text-slate-400 font-bold block">TÃªn gá»i ká»‹ch báº£n máº«u:</label><input className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 focus:outline-none text-slate-100 font-medium" value={scriptName} onChange={(e) => setScriptName(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold block">TiÃªu Ä‘á» thÆ° gá»­i Ä‘i (Subject):</label><input className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 focus:outline-none text-slate-200 font-medium" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
              <div>
                <div className="flex justify-between items-center"><label className="text-slate-400 font-bold block">Ná»™i dung mÃ£ hÃ³a vÄƒn báº£n HTML:</label><button type="button" onClick={handleGenerateSampleBody} className="text-[10px] text-amber-400 font-bold flex items-center gap-1 bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 rounded-lg"><Sparkles className="w-3 h-3" /> Gen phÃ´i máº«u</button></div>
                <textarea className="w-full bg-slate-950 p-3 mt-1.5 rounded-xl border border-slate-800 text-xs h-36 resize-none focus:outline-none text-slate-300 font-mono leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 pt-2.5 border-t border-slate-800 font-sans"><button type="button" onClick={() => setShowModal(false)} className="flex-1 p-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-slate-400 text-center hover:bg-slate-850">Há»§y</button><button type="button" onClick={handleSave} className="flex-1 p-3 bg-purple-600 text-white font-black rounded-xl shadow-lg">LÆ°u Ká»‹ch Báº£n</button></div>
          </div>
        </div>
      )}

      {/* ðŸ”¥ POPUP FORM NHáº¬P EMAIL Gá»¬I THá»¬ NGHIá»†M Äá»’NG Bá»˜ CAO Cáº¤P */}
      {showTestMailPopup && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm text-center space-y-4 shadow-2xl relative text-xs">
            <button onClick={() => setShowTestMailPopup(false)} className="absolute right-4 top-4 text-slate-500 hover:text-white"><X className="w-4 h-4"/></button>
            <div className="w-11 h-11 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto"><Send className="w-5 h-5"/></div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">Gá»­i thÆ° nghiá»‡m ká»‹ch báº£n</h4>
              <p className="text-[11px] text-slate-400 font-medium">Báº¯n lá»‡nh phÃ¡t thá»­ nghiá»‡m cáº¥u trÃºc ká»‹ch báº£n [{activeTestTemplate?.template_name}] qua cá»•ng SMTP xÆ°á»Ÿng.</p>
            </div>
            <div className="text-left"><label className="text-slate-500 font-bold block mb-1">Nháº­p Ä‘á»‹a chá»‰ Email nháº­n:</label><input type="email" className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-mono text-purple-400 font-bold focus:outline-none" value={testMailAddress} onChange={e => setTestMailAddress(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-sans"><button onClick={() => setShowTestMailPopup(false)} disabled={sendingTestMail} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-slate-400 disabled:opacity-50">Há»§y</button><button onClick={executeSendTestEmail} disabled={sendingTestMail} className="bg-purple-600 text-white font-black p-2.5 rounded-xl shadow-lg disabled:opacity-50">{sendingTestMail ? 'Äang gá»­i...' : 'ðŸš€ PhÃ¡t lá»‡nh báº¯n'}</button></div>
          </div>
        </div>
      )}

    </div>
  );
}
