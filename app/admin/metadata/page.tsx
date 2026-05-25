// app/admin/metadata/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Database, Plus, Trash2, Save, RefreshCcw, Layers, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function MetadataManagement() {
  const { showToast, showConfirm } = useNotification();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCatId, setSelectedCatId] = useState<string>(''); 
  const [subSearchTerm, setSubSearchTerm] = useState<string>(''); 
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState('1');

  const [newCatName, setNewCatName] = useState('');

  const loadMetadata = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('system_metadata').select('*').order('id', { ascending: true });
      setCategories(data || []);
      if (data && data.length > 0 && !selectedCatId) {
        setSelectedCatId(data[0].id.toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMetadata(); }, []);

  const handleCategoryFilterChange = (catId: string) => {
    setSelectedCatId(catId);
    setCurrentPage(1);
    setPageInput('1');
    setSubSearchTerm('');
  };

  const activeCategory = categories.find(c => c.id === Number(selectedCatId));
  const activeData = activeCategory ? activeCategory.data || [] : [];

  const rowsWithGlobalIndex = activeData.map((row: any, index: number) => ({
    ...row,
    __globalIndex: index
  }));

  const filteredRows = rowsWithGlobalIndex.filter((row: any) => {
    return Object.keys(row).some(key => {
      if (key === '__globalIndex') return false;
      return String(row[key]).toLowerCase().includes(subSearchTerm.toLowerCase());
    });
  });

  const totalPages = Math.ceil(filteredRows.length / itemsPerPage) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const tableHeaders = activeData.length > 0 
    ? Object.keys(activeData[0]).filter(k => k !== '__globalIndex') 
    : [];

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return showToast('Thiếu thông tin', 'Sếp vui lòng nhập tên danh mục lớn!', 'error');
    const { data } = await supabase.from('system_metadata').insert([{ name: newCatName.trim(), data: [] }]).select();
    if (data && data.length > 0) setSelectedCatId(data[0].id.toString());
    setNewCatName(''); loadMetadata();
    // 🔥 ĐÃ VÁ: Chuyển sang Popup Toast dùng chung
    showToast('Thành công', '✨ Khởi tạo danh mục lớn hệ thống thành công!', 'success');
  };

  const handleDeleteCategory = () => {
    if (!activeCategory) return;
    // 🔥 ĐÃ VÁ: Thay confirm() trình duyệt bằng hộp thoại Confirm Modal bo góc
    showConfirm('Xóa danh mục lớn', `Sếp có chắc chắn muốn xóa vĩnh viễn danh mục lớn [${activeCategory.name}] cùng toàn bộ thuộc tính con không?`, async () => {
      await supabase.from('system_metadata').delete().eq('id', activeCategory.id);
      setSelectedCatId(''); loadMetadata();
      showToast('Đã xóa vĩnh viễn', 'Danh mục lớn đã được gỡ bỏ.', 'info');
    });
  };

  const handleAddRow = () => {
    if (!activeCategory) return;
    let newRow = {};
    const nameLower = activeCategory.name.toLowerCase();
    
    if (nameLower.includes('cấp bậc & lương')) {
      newRow = { level: 'Bậc mới', rate: 30000 };
    } else if (nameLower.includes('vị trí & cấp bậc')) {
      newRow = { title: 'Vị trí mới', level: 'A1' };
    } else {
      newRow = tableHeaders.length > 0 
        ? tableHeaders.reduce((acc, currentKey) => ({ ...acc, [currentKey]: currentKey === 'rate' ? 0 : 'Nhập dữ liệu' }), {})
        : { key: 'Nhãn', value: 'Giá trị' };
    }

    const updatedData = [...activeCategory.data, newRow];
    setCategories(categories.map(c => c.id === activeCategory.id ? { ...c, data: updatedData } : c));
    setTimeout(() => { setCurrentPage(Math.ceil(updatedData.length / itemsPerPage) || 1); }, 50);
  };

  const handleUpdateRowValue = (globalIndex: number, field: string, value: any) => {
    if (!activeCategory) return;
    const newData = [...activeCategory.data];
    newData[globalIndex] = { ...newData[globalIndex], [field]: field === 'rate' ? Number(value) : value };
    setCategories(categories.map(c => c.id === activeCategory.id ? { ...c, data: newData } : c));
  };

  const handleRemoveRow = (globalIndex: number) => {
    if (!activeCategory) return;
    const newData = activeCategory.data.filter((__, i) => i !== globalIndex);
    setCategories(categories.map(c => c.id === activeCategory.id ? { ...c, data: newData } : c));
    const maxPage = Math.ceil(newData.length / itemsPerPage) || 1;
    if (currentPage > maxPage) setCurrentPage(maxPage);
  };

  const handleSaveCategory = async () => {
    if (!activeCategory) return;
    await supabase.from('system_metadata').update({ data: activeCategory.data }).eq('id', activeCategory.id);
    // 🔥 ĐÃ VÁ: Chuyển sang Popup Toast
    showToast('Đồng bộ thành công', `✨ Đã cập nhật và lưu trữ danh mục [${activeCategory.name}] lên Cloud!`, 'success');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER TỔNG */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          <div>
            <h1 className="text-base font-bold">Hệ Thống Danh Mục Metadata Trung Tâm</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Bảng cấu trúc thuộc tính động điều khiển dây chuyền xưởng máy</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
          <input type="text" placeholder="Tạo danh mục lớn..." className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none w-44" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
          <button onClick={handleCreateCategory} className="bg-purple-600 hover:bg-purple-700 font-bold px-3 py-1.5 rounded-lg text-white transition flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Tạo lớn</button>
        </div>
      </div>

      {/* CONTAINER BẢNG DỮ LIỆU CHUYÊN NGHIỆP */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <Database className="w-4 h-4 text-purple-400 shrink-0" />
            <select className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-purple-300 font-black focus:outline-none w-full md:w-64 cursor-pointer" value={selectedCatId} onChange={(e) => handleCategoryFilterChange(e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>📁 {c.name} ({c.data?.length || 0})</option>)}
            </select>
            {activeCategory && (
              <button onClick={handleDeleteCategory} className="p-2 bg-slate-950 border border-red-900/30 text-red-400 hover:bg-red-950/20 rounded-xl text-[10px] font-bold transition">Xóa danh mục lớn</button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="relative w-full md:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="text" placeholder="Tìm nội dung con..." className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none" value={subSearchTerm} onChange={(e) => { setSubSearchTerm(e.target.value); setCurrentPage(1); setPageInput('1'); }} />
            </div>
            <button onClick={handleSaveCategory} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center gap-1 transition shrink-0"><Save className="w-3.5 h-3.5" /> Lưu bảng</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 table-fixed min-w-[600px]">
            <thead className="bg-slate-950 text-slate-500 border-b border-slate-800 uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                {tableHeaders.map(header => <th key={header} className="p-4 font-bold text-slate-400">{header}</th>)}
                <th className="p-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {paginatedRows.length === 0 ? (
                <tr><td colSpan={tableHeaders.length + 1} className="p-8 text-center text-slate-500 font-mono italic">Chưa có hàng dữ liệu con nào khớp bộ lọc tra cứu.</td></tr>
              ) : paginatedRows.map((row) => (
                <tr key={row.__globalIndex} className="hover:bg-slate-950/30 transition">
                  {tableHeaders.map((key) => (
                    <td key={key} className="p-3">
                      <input type={key === 'rate' ? 'number' : 'text'} className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none font-medium" value={row[key] !== undefined ? row[key] : ''} onChange={(e) => handleUpdateRowValue(row.__globalIndex, key, e.target.value)} />
                    </td>
                  ))}
                  <td className="p-3 text-center">
                    <button onClick={() => handleRemoveRow(row.__globalIndex)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* THANH PHÂN TRANG */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400 select-none">
          <div className="w-full md:w-auto flex justify-between md:justify-start items-center gap-4">
            <button onClick={handleAddRow} className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 transition font-sans"><Plus className="w-4 h-4" /> Thêm hàng con mới</button>
            <div>Total <span className="text-purple-400 font-bold">{filteredRows.length}</span> items</div>
          </div>
          
          <div className="flex flex-wrap items-center justify-end gap-4 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <span>Show rows:</span>
              <select className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-bold text-slate-200 focus:outline-none cursor-pointer" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); setPageInput('1'); }}>
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => { setCurrentPage(1); setPageInput('1'); }} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronsLeft className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); setPageInput(String(p)); }} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => { setCurrentPage(page); setPageInput(String(page)); }} className={`w-7 h-7 rounded-lg font-black transition text-[11px] ${currentPage === page ? 'bg-red-600 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>{page}</button>
              ))}
              <button onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); setPageInput(String(p)); }} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => { setCurrentPage(totalPages); setPageInput(String(totalPages)); }} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronsRight className="w-4 h-4 text-slate-300" /></button>
            </div>

            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={totalPages} className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-bold text-slate-100 focus:outline-none" value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
              <button onClick={() => { const p = Number(pageInput); if (p >= 1 && p <= totalPages) setCurrentPage(p); }} className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg font-black hover:bg-slate-800 text-slate-200 transition">Go</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}