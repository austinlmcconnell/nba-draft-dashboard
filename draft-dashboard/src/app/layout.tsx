/**
 * Root Layout
 * Main layout wrapper for the entire application
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
