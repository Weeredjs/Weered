import './globals.css';
import type { Metadata } from 'next';
import DockShell from '../components/DockShell';

export const metadata: Metadata = {
  title: 'Weered',
  description: 'Weered lobby + rooms + chat',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DockShell>{children}</DockShell>
      </body>
    </html>
  );
}