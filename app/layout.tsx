// app/layout.tsx
import { NotificationProvider } from '@/component/NotificationContext';
import { GlobalLoadingProvider } from '@/component/GlobalLoading';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {/* 🔥 BỌC PROVIDER Ở ĐÂY ĐỂ VÁ TRIỆT ĐỂ LỖI CHƯA ĐỊNH NGHĨA TRÊN TOÀN HỆ THỐNG */}
        <GlobalLoadingProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
