import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'U3LAB Board',
  description: 'U3LAB タスク&スケジュール管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-stone-50 text-stone-800 antialiased">{children}</body>
    </html>
  );
}
