import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'leadgen dashboard — local',
  description: 'Local-only website filter and lead pool inspector.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
