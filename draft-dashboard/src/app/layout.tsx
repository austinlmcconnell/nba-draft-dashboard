/**
 * Root Layout — CompBeasts
 */

import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default:  'CompBeasts — NBA Draft Analytics',
    template: '%s | CompBeasts',
  },
  description:
    'Advanced NBA draft analytics. Compare college basketball prospects to 6,800+ historical players using multi-faceted statistical modeling.',
  keywords: [
    'NBA draft', 'basketball analytics', 'prospect comparison',
    'college basketball', 'draft board', '2026 NBA draft', 'CompBeasts',
  ],
  openGraph: {
    title:       'CompBeasts — NBA Draft Analytics',
    description: 'Compare 2026 NBA draft prospects to historical player comps.',
    type:        'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#0d1117] text-[#f9fafb] flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
