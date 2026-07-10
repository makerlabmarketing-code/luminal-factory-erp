'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import { businessMonthFromInstant, formatBusinessMonthInput } from '@/lib/business-date';
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  RefreshCcw,
  Search,
} from 'lucide-react';
import type { FinancialLedgerEntry } from '@/lib/types/finance';
import type { Employee } from '@/lib/types/employee';
import {
  formatCurrency,
  getStaffExpensesData,
  parseCurrency,
  submitStaffExpense,
} from '@/services/staffExpensesService';

interface StaffExpensesContentProps {
  token?: string | null;
  workerData?: Employee | null;
}

const ITEMS_PER_PAGE = 10;

export function StaffExpensesContent({
  token: propsToken,
  workerData,
}: StaffExpensesContentProps) {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = propsToken || searchParams.get('token');

  const [expenses, setExpenses] = useState<FinancialLedgerEntry[]>([]);
  const [worker, setWorker] = useState<Employee | null>(workerData || null);
  const [loading, setLoading] = useState(!workerData);

  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expBillUrl, setExpBillUrl] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const [monthInput, setMonthInput] = useState(() => {
    return formatBusinessMonthInput(businessMonthFromInstant(new Date()));
  });

  const [currentPage, setCurrentPage] = useState(1);

  const loadExpensesData = async () => {
    if (!token && !workerData) {
      setLoading(false);
      return;
    }

    try {
      const expensesData = await getStaffExpensesData({
        token,
        workerData,
      });

      setWorker(expensesData.employee);
      setExpenses(expensesData.expenses);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpensesData();
  }, [token, workerData]);

  const handleSubmitExpense = async () => {
    if (!worker) {
      showToast('Lỗi', 'Chưa xác định danh tính thợ trực ca!', 'error');
      return;
    }

    const numericAmount = parseCurrency(expAmount);

    if (!expCategory.trim() || !numericAmount) {
      showToast('Thiếu thông tin', 'Vui lòng điền đủ thông tin vật tư và tiền chi!', 'error');
      return;
    }

    try {
      await submitStaffExpense({
        employee: worker,
        category: expCategory,
        amount: numericAmount,
        billUrl: expBillUrl,
      });

      setExpCategory('');
      setExpAmount('');
      setExpBillUrl('');

      showToast('Nộp phiếu thành công', 'Yêu cầu hoàn ứng đã được gửi lên hệ thống chờ duyệt!', 'success');
      loadExpensesData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể gửi phiếu hoàn ứng.';
      showToast('Lỗi', message, 'error');
    }
  };

  const filteredExpenses = useMemo(() => {
    const [year, month] = monthInput.split('-');
    const targetPeriod = `${month}/${year}`;
    const normalizedSearch = searchTerm.toLowerCase();

    return expenses.filter((expense) => {
      const matchSearch = expense.category?.toLowerCase().includes(normalizedSearch);
      const matchMonth = expense.month_period === targetPeriod;

      return matchSearch && matchMonth;
    });
  }, [expenses, searchTerm, monthInput]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));

  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredExpenses.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExpenses, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, monthInput]);

  if (loading) {
    return (
      <div className="text-center p-6 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-emerald-500 mx-auto mb-2" /> Đang tải dữ liệu chi tiêu...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start w-full text-slate-100">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs shadow-xl">
        <h3 className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-800 pb-2 flex items-center gap-1">
          <Banknote className="w-3.5 h-3.5 text-emerald-400" /> Kê khai vật tư phát sinh
        </h3>

        <div>
          <label className="text-slate-400 font-bold">Tên vật tư đồ chi mua:</label>
          <input
            type="text"
            placeholder="Ví dụ: Khớp nối đồng"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-slate-200"
            value={expCategory}
            onChange={(event) => setExpCategory(event.target.value)}
          />
        </div>

        <div>
          <label className="text-slate-400 font-bold">Số tiền mặt thực chi (VND):</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-amber-400 font-bold focus:outline-none"
            value={expAmount}
            onChange={(event) => setExpAmount(formatCurrency(event.target.value))}
          />
        </div>

        <div>
          <label className="text-slate-400 font-bold">Link ảnh hóa đơn Bill (Tùy chọn):</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-blue-400 font-mono"
            value={expBillUrl}
            onChange={(event) => setExpBillUrl(event.target.value)}
          />
        </div>

        <button
          onClick={handleSubmitExpense}
          className="w-full bg-emerald-600 hover:bg-emerald-700 transition text-white font-black p-3.5 rounded-xl uppercase text-xs mt-2 cursor-pointer"
        >
          Nộp phiếu hoàn ứng
        </button>
      </div>

      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
          <div className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">
            Sổ đối soát quỹ chi cá nhân
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm tên vật tư..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none text-slate-200"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="w-full sm:w-auto">
              <MonthPicker value={monthInput} onChange={setMonthInput} accent="default" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left text-xs text-slate-300">
            <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-slate-500 italic">
                    Không có khoản phát sinh nào trong kỳ này.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-950/10 transition">
                    <td className="p-4">
                      <p className="font-bold text-slate-200">{expense.category}</p>

                      {expense.bill_url && (
                        <a
                          href={expense.bill_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 flex items-center gap-0.5 mt-1 text-[10px] hover:underline font-mono"
                        >
                          <ImageIcon className="w-3 h-3" /> Mở xem hóa đơn
                        </a>
                      )}

                      <span className="text-[9px] text-slate-500 mt-1 block">
                        Kỳ: {expense.month_period}
                      </span>
                    </td>

                    <td className="p-4 text-center">
                      <span
                        className={`px-2 py-1 rounded text-[9px] font-black border ${
                          expense.is_paid
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}
                      >
                        {expense.is_paid ? '✅ Đã thanh toán' : '⏳ Chờ duyệt'}
                      </span>
                    </td>

                    <td className="p-4 font-mono text-red-400 font-bold text-right">
                      {Number(expense.amount || 0).toLocaleString()} đ
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredExpenses.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-between items-center text-[10px] text-slate-400">
            <div>
              Hiển thị{' '}
              <span className="font-bold text-slate-200">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{' '}
              -{' '}
              <span className="font-bold text-slate-200">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredExpenses.length)}
              </span>{' '}
              trong <span className="font-bold text-slate-200">{filteredExpenses.length}</span> khoản
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-3 font-bold text-slate-300">
                Trang {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
