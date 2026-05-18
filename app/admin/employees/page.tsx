// app/admin/employees/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCheck, UserPlus, Trash2, Edit2, Save, X, Layers, RefreshCcw } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  title: string;
  hourly_rate: number;
  qr_token: string;
  email: string;
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Thêm Mới
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('Nhân viên In 3D');
  const [newRate, setNewRate] = useState(30000);
  const [newEmail, setNewEmail] = useState('');

  // Trạng thái Sửa trực tiếp dòng (Inline Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editRate, setEditRate] = useState(30000);

  // Danh mục Ma trận Cấp bậc cứng của xưởng để làm mẫu đối chiếu
  const salaryTiers = [
    { level: 'Nhân viên In 3D', rate: 30000, desc: 'Vận hành máy in resin, xử lý thô phôi' },
    { level: 'Nhân viên Decor/QC', rate: 30000, desc: 'Sơn phủ màu, đổ keo bảo vệ, kiểm định' },
    { level: 'Cộng tác viên thời vụ', rate: 25000, desc: 'Hỗ trợ đóng gói, dọn dẹp xưởng' },
  ];

  // 1. Đọc danh sách nhân viên từ Supabase
  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
    } catch (e) {
      alert('Lỗi tải dữ liệu nhân sự!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // 2. Hàm Thêm Mới Nhân Viên
  const handleAddEmployee = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      alert('Vui lòng điền đầy đủ Họ tên và Email!');
      return;
    }
    const cleanToken = 'NV_' + newName.toUpperCase().replace(/\s+/g, '');

    try {
      const { error } = await supabase.from('employees').insert([
        {
          full_name: newName.trim(),
          title: newTitle,
          hourly_rate: Number(newRate),
          qr_token: cleanToken,
          email: newEmail.trim(),
        },
      ]);

      if (error) throw error;
      alert('Kích hoạt hồ sơ nhân sự mới thành công!');
      setNewName('');
      setNewEmail('');
      fetchEmployees();
    } catch (e) {
      alert('Lỗi: Email hoặc mã Token trùng lặp!');
    }
  };

  // 3. Kích hoạt chế độ sửa dòng
  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditName(emp.full_name);
    setEditTitle(emp.title);
    setEditRate(emp.hourly_rate);
  };

  // 4. Lưu thông tin sau khi sửa lên Supabase
  const handleSaveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          full_name: editName.trim(),
          title: editTitle,
          hourly_rate: Number(editRate),
        })
        .eq('id', id);

      if (error) throw error;
      alert('Đã cập nhật thay đổi thành công!');
      setEditingId(null);
      fetchEmployees();
    } catch (e) {
      alert('Lỗi cập nhật hồ sơ!');
    }
  };

  // 5. Xóa nhân viên (Chuyển trạng thái hoạt động về false)
  const handleDeleteEmployee = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn ngưng kích hoạt nhân sự này không?')) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
      fetchEmployees();
    } catch (e) {
      alert('Lỗi thao tác xóa!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-mono text-xs">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mr-2" /> Đang đọc hồ sơ lưu trữ từ Supabase...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
          <UserCheck className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold tracking-wide">Studio Hồ Sơ Nhân Sự & Định Mức Lương</h1>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý sửa đổi thông tin, quyền truy cập ca làm và định mức chi trả</p>
          </div>
        </div>

        {/* CẤU PHẦN 1: BẢNG TRA CỨU ĐỊNH MỨC CẤP BẬC MẪU CỦA VĂN PHÒNG */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" /> Bảng Quy Chuẩn Định Mức Phân Bậc Văn Phòng
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {salaryTiers.map((tier, idx) => (
              <div key={idx} className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-1">
                <span className="text-xs font-bold text-slate-200 block">{tier.level}</span>
                <span className="text-sm font-extrabold text-amber-400 font-mono block">{tier.rate.toLocaleString()} đ/giờ</span>
                <span className="text-[10px] text-slate-500 block leading-relaxed">{tier.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CẤU PHẦN 2: FORM THÊM NHÂN VIÊN MỚI */}
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
            <UserPlus className="w-4 h-4 text-emerald-400" /> Kích hoạt thêm nhân sự mới vào ca
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Họ và Tên:</label>
              <input type="text" placeholder="Ví dụ: Đỗ Hải Vân" className="mt-1.5 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Email hệ thống:</label>
              <input type="email" placeholder="van@gmail.com..." className="mt-1.5 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Cấp bậc công việc:</label>
              <select className="mt-1.5 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none" value={newTitle} onChange={(e) => {
                setNewTitle(e.target.value);
                // Tự động gán định mức lương mặc định tương ứng với cấp bậc chọn
                const matchingTier = salaryTiers.find(t => t.level === e.target.value);
                if (matchingTier) setNewRate(matchingTier.rate);
              }}>
                <option value="Nhân viên In 3D">Nhân viên In 3D</option>
                <option value="Nhân viên Decor/QC">Nhân viên Decor/QC</option>
                <option value="Cộng tác viên thời vụ">Cộng tác viên thời vụ</option>
              </select>
            </div>
            <button onClick={handleAddEmployee} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 transition">
              <UserPlus className="w-4 h-4" /> Lưu & Sinh Mã QR
            </button>
          </div>
        </div>

        {/* CẤU PHẦN 3: BẢNG DANH SÁCH & SỬA THÔNG TIN LIVE */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Danh Sách Quản Lý Nhân Sự Hiện Thời</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase">
                <tr>
                  <th className="p-4">Nhân sự</th>
                  <th className="p-4">Cấp bậc / Vị trí</th>
                  <th className="p-4">Định mức công nhật</th>
                  <th className="p-4">Mã Token QR</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => {
                  const isEditing = editingId === emp.id;
                  return (
                    <tr key={emp.id} className="hover:bg-slate-950/20 transition">
                      {/* Cột Tên */}
                      <td className="p-4 font-semibold text-slate-100">
                        {isEditing ? (
                          <input type="text" className="bg-slate-950 border border-slate-700 rounded p-1 text-xs text-slate-200 focus:outline-none" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        ) : (
                          <div>
                            <p className="text-slate-200">{emp.full_name}</p>
                            <p className="text-[10px] text-slate-500 font-normal mt-0.5 font-mono">{emp.email}</p>
                          </div>
                        )}
                      </td>

                      {/* Cột Vị trí */}
                      <td className="p-4">
                        {isEditing ? (
                          <select className="bg-slate-950 border border-slate-700 rounded p-1 text-xs text-slate-200 focus:outline-none" value={editTitle} onChange={(e) => {
                            setEditTitle(e.target.value);
                            const matchingTier = salaryTiers.find(t => t.level === e.target.value);
                            if (matchingTier) setEditRate(matchingTier.rate);
                          }}>
                            <option value="Nhân viên In 3D">Nhân viên In 3D</option>
                            <option value="Nhân viên Decor/QC">Nhân viên Decor/QC</option>
                            <option value="Cộng tác viên thời vụ">Cộng tác viên thời vụ</option>
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">{emp.title}</span>
                        )}
                      </td>

                      {/* Cột Định mức lương */}
                      <td className="p-4 font-mono font-semibold text-amber-400">
                        {isEditing ? (
                          <input type="number" className="w-20 bg-slate-950 border border-slate-700 rounded p-1 text-xs text-slate-200 focus:outline-none text-right" value={editRate} onChange={(e) => setEditRate(Number(e.target.value))} />
                        ) : (
                          `${emp.hourly_rate.toLocaleString()} đ/h`
                        )}
                      </td>

                      {/* Cột Mã QR */}
                      <td className="p-4 font-mono text-slate-500">{emp.qr_token}</td>

                      {/* Cột Nút bấm */}
                      <td className="p-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleSaveEdit(emp.id)} className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg" title="Lưu chỉnh sửa"><Save className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg" title="Hủy"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEdit(emp)} className="p-1.5 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg" title="Sửa thông tin"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleDeleteEmployee(emp.id)} className="p-1.5 border border-slate-800 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded-lg" title="Xóa hồ sơ"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}