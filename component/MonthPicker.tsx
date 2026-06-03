// component/MonthPicker.tsx
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useMemo } from 'react';

interface MonthPickerProps {
  value: string; // Định dạng: YYYY-MM
  onChange: (newValue: string) => void;
  accent?: 'default' | 'purple'; // Tùy biến màu sắc cho hợp với từng trang
}

export default function MonthPicker({ value, onChange, accent = 'default' }: MonthPickerProps) {
  // Tạo danh sách tháng cố định 100% Tiếng Việt
  const options = useMemo(() => {
    const opts = [];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 2; y >= currentYear - 3; y--) {
      for (let m = 12; m >= 1; m--) {
        const monthStr = String(m).padStart(2, '0');
        opts.push({
          value: `${y}-${monthStr}`,
          label: `Tháng ${monthStr} / ${y}`
        });
      }
    }
    return opts;
  }, []);

  // Xử lý nút lùi 1 tháng
  const handlePrev = () => {
    if (!value) return;
    let [year, month] = value.split('-').map(Number);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    onChange(`${year}-${String(month).padStart(2, '0')}`);
  };

  // Xử lý nút tiến 1 tháng
  const handleNext = () => {
    if (!value) return;
    let [year, month] = value.split('-').map(Number);
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
    onChange(`${year}-${String(month).padStart(2, '0')}`);
  };

  const textAccentClass = accent === 'purple' ? 'text-purple-400' : 'text-slate-300';

  return (
    <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
      <button 
        onClick={handlePrev} 
        className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-900"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <div className="relative flex items-center justify-center group">
        <CalendarDays className={`w-3.5 h-3.5 absolute left-2 pointer-events-none ${textAccentClass} opacity-70 group-hover:opacity-100 transition`} />
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className={`appearance-none bg-transparent text-xs font-black font-mono uppercase pl-7 pr-3 py-1.5 focus:outline-none cursor-pointer text-center hover:text-white transition w-[140px] ${textAccentClass}`}
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-200">
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button 
        onClick={handleNext} 
        className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-900"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}