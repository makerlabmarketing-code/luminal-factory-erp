// app/layout.tsx
import { GlobalLoadingProvider } from '@/component/GlobalLoading';
import '@/app/globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <GlobalLoadingProvider>
          {children}
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
