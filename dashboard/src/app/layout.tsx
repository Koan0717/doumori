import type { Metadata } from 'next';
import './globals.css';
import ToasterProvider from '@/components/ToasterProvider';

export const metadata: Metadata = {
  title: 'どう森BOT ダッシュボード',
  description: 'あつまれ どうぶつの森風 Discord Bot 管理ダッシュボード',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-leaf-50 text-leaf-900 min-h-screen">
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
