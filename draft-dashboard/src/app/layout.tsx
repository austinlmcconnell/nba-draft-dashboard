/**
 * Root Layout
 * Main layout wrapper for the entire application
 */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NBA Draft Dashboard',
  description: 'Compare college basketball prospects to historical NBA players',
  keywords: ['NBA', 'draft', 'basketball', 'prospects', 'college basketball', 'player comparison'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
