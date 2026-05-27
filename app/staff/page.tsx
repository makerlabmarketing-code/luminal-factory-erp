// app/staff/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function StaffPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      // Đẩy thẳng Nhân sự vào trang chủ Portal tích hợp mới kèm theo Token bảo mật
      router.replace(`/staff/portal?token=${token}`);
    }
  }, [token, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono text-xs gap-2 select-none">
      <RefreshCcw className="w-4 h-4 animate-spin text-purple-500" />
      {token ? (
        <span>Đang xác thực link định danh và mở cổng thông tin xưởng...</span>
      ) : (
        <span className="text-red-400 font-sans font-bold">⚠️ Lỗi: Không tìm thấy Token bảo mật trên đường link! Vui lòng sử dụng đúng Link định danh được cấp.</span>
      )}
    </div>
  );
}

// Icon Refresh phục vụ hiệu ứng loading chuyển trang nhanh
function RefreshCcw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 16h5v5" /></svg>
  );
}