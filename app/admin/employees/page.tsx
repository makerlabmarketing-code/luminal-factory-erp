// app/admin/employees/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Users, UserPlus, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit2, Trash2, X, RefreshCcw, Link, MapPin } from 'lucide-react';

export default function AdminEmployeesManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Form Fields
  const [targetId, setTargetId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [cccd, setCccd] = useState('');
  const [driveCccd, setDriveCccd] = useState('');
  const [driveContract, setDriveContract] = useState('');
  const [title, setTitle] = useState('Kỹ thuật');
  const [level, setLevel] = useState('A1');
  const [status, setStatus] = useState('ACTIVE');
  const [role, setRole] = useState('STAFF'); 
  const [bankName, setBankName] = useState('MB');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('CN1');

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: metaBranch } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
      setBranches(metaBranch?.data || [
        { "code": "CN1", "name": "Xưởng chính Luminal Hà Nội", "lat": 20.982252, "lng": 105.886674, "radius": 20 },
        { "code": "CN2", "name": "Văn phòng Điều hành - TP.HCM", "lat": 10.762622, "lng": 106.660172, "radius": 150 }
      ]);
      const { data: emps } = await supabase.from('employees').select('*').order('id', { ascending: false });
      setEmployees(emps || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleOpenAdd = () => {
    setIsEditing(false); setTargetId(''); setFullName(''); setEmail(''); setPhone(''); setAddress(''); setCccd(''); 
    setDriveCccd(''); setDriveContract(''); setStatus('ACTIVE'); setRole('STAFF'); setBankName('MB'); setBankAccountNumber('');
    setBranchCode(branches[0]?.code || 'CN1'); setShowModal(true);
  };

  const handleOpenEdit = (emp: any) => {
    setIsEditing(true); setTargetId(emp.id); setFullName(emp.full_name || ''); setEmail(emp.email || ''); 
    setPhone(emp.phone || ''); setAddress(emp.address || ''); setCccd(emp.cccd || ''); 
    setDriveCccd(emp.drive_cccd || ''); setDriveContract(emp.drive_contract || ''); 
    setTitle(emp.title || 'Kỹ thuật'); setLevel(emp.level || 'A1'); setStatus(emp.status || 'ACTIVE'); setRole(emp.role || 'STAFF'); 
    setBankName(emp.bank_name || 'MB'); setBankAccountNumber(emp.bank_account_number || '');
    setBranchCode(emp.branch_code || 'CN1'); setShowModal(true);
  };

  const handleSave = async () => {
    if (!fullName.trim()) return showToast('Thiếu thông tin', 'Sếp vui lòng nhập họ tên Nhân sự!', 'error');
    
    const payload: any = { 
      full_name: fullName.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), cccd: cccd.trim(), 
      drive_cccd: driveCccd.trim(), drive_contract: driveContract.trim(), title, level, status, role,
      bank_name: bankName, bank_account_number: bankAccountNumber.trim(), branch_code: branchCode
    };
    
    if (!isEditing) payload.qr_token = crypto.randomUUID();
    if (isEditing) await supabase.from('employees').update(payload).eq('id', targetId);
    else await supabase.from('employees').insert([payload]);
    
    setShowModal(false); loadData(); 
    showToast('Thành công', 'Hồ sơ nhân sự đã được đồng bộ lên mây!', 'success');
  };

  const handleDelete = (id: string) => {
    showConfirm('Xác nhận xóa', 'Sếp có chắc chắn muốn gỡ vĩnh viễn nhân sự này không?', async () => {
      await supabase.from('employees').delete().eq('id', id);
      loadData();
      showToast('Đã xóa', 'Hồ sơ nhân sự đã được gỡ bỏ khỏi cơ sở dữ liệu.', 'info');
    });
  };

  const handleCopyLink = (token: string) => {
    if (!token) return showToast('Lỗi', 'Nhân sự này chưa được cấp token định danh!', 'error');
    const url = `${window.location.origin}/staff/portal?token=${token}`;
    navigator.clipboard.writeText(url);
    showToast('Đã sao chép', 'Đã sao chép liên kết Cổng Portal gửi cho Nhân sự!', 'success');
  };

  const filtered = employees.filter(e => {
    const matchText = (e.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (e.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchBranch = selectedBranchFilter === 'ALL' || e.branch_code === selectedBranchFilter;
    return matchText && matchBranch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const currentData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-base font-bold flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /> Điều Hành Hồ Sơ Nhân Sự</h1>
        <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"><UserPlus className="w-4 h-4" /> Tạo Nhân Sự</button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400">Danh Sách Điều Hành ({filtered.length})</span>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer" value={selectedBranchFilter} onChange={e => { setSelectedBranchFilter(e.target.value); setCurrentPage(1); }}>
              <option value="ALL">🌐 Tất cả cơ sở làm việc</option>
              {branches.map(b => <option key={b.code} value={b.code}>🏭 {b.name}</option>)}
            </select>
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input type="text" placeholder="Tìm tên Nhân sự, chức vụ..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="p-4">Họ Tên Nhân sự / Chức Vụ</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4">Cơ Sở Chỉ Định</th>
                <th className="p-4">Tài Khoản Ngân Hàng</th>
                <th className="p-4">Cổng Định Danh Số</th>
                <th className="p-4 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {currentData.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-950/20 transition">
                  <td className="p-4 font-bold text-slate-200">{emp.full_name} <br/><span className="text-[10px] text-slate-500 font-mono font-medium">{emp.title} ({emp.level})</span></td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${emp.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{emp.status === 'ACTIVE' ? 'Đang làm' : 'Nghỉ việc'}</span>
                  </td>
                  <td className="p-4 font-bold text-slate-400 flex items-center gap-1 mt-1.5"><MapPin className="w-3.5 h-3.5 text-blue-400"/> {branches.find(b=>b.code===emp.branch_code)?.name || 'Chưa gán'}</td>
                  <td className="p-4 font-mono text-slate-400">{emp.bank_name} - {emp.bank_account_number || '⏳ Chưa kê khai'}</td>
                  <td className="p-4"><button onClick={() => handleCopyLink(emp.qr_token)} className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 font-mono text-[10px] bg-purple-950/30 border border-purple-800/30 px-2.5 py-1 rounded-lg transition">Link Portal</button></td>
                  <td className="p-4 text-center space-x-1 font-sans">
                    <button onClick={() => handleOpenEdit(emp)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-800 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(emp.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-red-950/20 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
          <div>Total <span className="text-blue-400 font-bold">{filtered.length}</span> items</div>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-2 font-bold self-center text-slate-200">{currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border rounded disabled:opacity-20"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* MODAL CẬP NHẬT HỒ SƠ */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 text-xs text-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-blue-500 uppercase tracking-wider text-[13px]">{isEditing ? 'SỬA HỒ SƠ THÀNH VIÊN' : 'THÊM MỚI HỒ SƠ THÀNH VIÊN'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl grid grid-cols-2 gap-3">
                <div className="col-span-2 font-bold text-slate-400 uppercase text-[9px] tracking-wider">1. Thông tin cơ bản</div>
                <div><label className="text-slate-400">Họ Tên Nhân sự:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div><label className="text-slate-400">Email:</label><input type="email" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div><label className="text-slate-400">Số điện thoại:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div><label className="text-slate-400">Số CCCD:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={cccd} onChange={(e) => setCccd(e.target.value)} /></div>
                <div className="col-span-2"><label className="text-slate-400">Địa chỉ cư trú:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl grid grid-cols-2 gap-3">
                <div className="col-span-2 font-bold text-slate-400 uppercase text-[9px] tracking-wider">2. Vị trí & Chức vụ</div>
                <div><label className="text-slate-400">Vị trí:</label><select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer" value={title} onChange={(e) => setTitle(e.target.value)}><option value="Kỹ thuật">Kỹ thuật</option><option value="Vận hành">Vận hành</option><option value="Hành chính">Hành chính</option></select></div>
                <div><label className="text-slate-400">Cấp độ Level:</label><select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer" value={level} onChange={(e) => setLevel(e.target.value)}><option value="A1">A1</option><option value="A2">A2</option><option value="B1">B1</option><option value="B2">B2</option></select></div>
                <div><label className="text-slate-400">Trạng thái:</label><select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ACTIVE">Đang làm việc (Active)</option><option value="INACTIVE">Nghỉ việc (Inactive)</option></select></div>
                <div><label className="text-slate-400">Phân quyền:</label><select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer" value={role} onChange={(e) => setRole(e.target.value)}><option value="STAFF">Nhân sự (Staff)</option><option value="ADMIN">Quản trị viên (Admin)</option></select></div>
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl grid grid-cols-1 gap-3">
                <div className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">3. Chỉ định cơ sở làm việc (GPS Geofencing)</div>
                <div>
                  <select className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-blue-400 font-bold" value={branchCode} onChange={(e) => setBranchCode(e.target.value)}>
                    {branches.map(b => <option key={b.code} value={b.code}>🏭 {b.name} (Bán kính an toàn {b.radius}m)</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-slate-950/40 p-4 border border-slate-800/80 rounded-2xl grid grid-cols-2 gap-3">
                <div className="col-span-2 font-bold text-slate-400 uppercase text-[9px] tracking-wider">4. Hồ sơ số hóa & Ngân hàng</div>
                <div><label className="text-slate-400">Ngân hàng:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none" value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
                <div><label className="text-slate-400">Số tài khoản:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold focus:outline-none" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} /></div>
                <div><label className="text-slate-400">Link Drive CCCD:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-blue-400" value={driveCccd} onChange={(e) => setDriveCccd(e.target.value)} /></div>
                <div><label className="text-slate-400">Link Drive Hợp Đồng:</label><input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-blue-400" value={driveContract} onChange={(e) => setDriveContract(e.target.value)} /></div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex gap-2 font-sans">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:bg-slate-850 transition">Hủy</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700 transition shadow-lg">Lưu hồ sơ số hóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}