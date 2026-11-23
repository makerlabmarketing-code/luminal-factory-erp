// app/layout.tsx
import { GlobalLoadingProvider } from '@/component/GlobalLoading';
import '@/app/globals.css';
import { BentoCardLight } from '@/component/BentoCardLight';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <GlobalLoadingProvider>
          <BentoCardLight />
          {children}
        </GlobalLoadingProvider>
      </body>
    </html>
  );
}
