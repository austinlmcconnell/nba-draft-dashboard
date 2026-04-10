'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// CompBeasts logo mark — basketball with three beast-claw slashes
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Ball body */}
      <circle cx="50" cy="50" r="44" fill="#081510" stroke="#22a052" strokeWidth="5.5" />
      {/* Basketball seams — subtle, inside the ball */}
      <path d="M 6 50 C 28 38, 72 38, 94 50" stroke="#1a5c2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 6 50 C 28 62, 72 62, 94 50" stroke="#1a5c2e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <line x1="50" y1="6" x2="50" y2="94" stroke="#1a5c2e" strokeWidth="2.5" strokeLinecap="round" />
      {/* Beast claw slashes — three bold diagonal marks across the ball */}
      <line x1="22" y1="22" x2="54" y2="80" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
      <line x1="40" y1="16" x2="68" y2="76" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
      <line x1="56" y1="18" x2="82" y2="72" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: '/big-board',   label: 'My Big Board'     },
  { href: '/draft',       label: 'Tankathon Board'  },
  { href: '/methodology', label: 'Methodology'      },
  { href: '/about',       label: 'About'            },
];

export default function Navbar() {
  const pathname  = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen]         = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0d1117]/95 backdrop-blur-md border-b border-[#1f2937] shadow-[0_1px_20px_rgba(0,0,0,0.5)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group" aria-label="CompBeasts home">
            <LogoMark size={36} />
            <span className="font-bold text-xl tracking-wide uppercase select-none">
              <span className="text-[#f9fafb]">COMP </span>
              <span className="text-[#1a7a3f]">BEASTS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    active
                      ? 'text-[#4ade80] bg-[#1a7a3f]/15'
                      : 'text-[#9ca3af] hover:text-[#f9fafb] hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* CTA */}
          <div className="hidden md:block">
            <Link
              href="/draft"
              className="btn-primary text-sm py-2 px-4"
            >
              2026 Draft Board
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/5 transition"
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {open
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 border-t border-[#1f2937] mt-1 pt-3 space-y-1">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-semibold ${
                    active
                      ? 'text-[#4ade80] bg-[#1a7a3f]/15'
                      : 'text-[#9ca3af] hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="pt-2 px-4">
              <Link href="/draft" className="btn-primary w-full justify-center text-sm">
                2026 Draft Board
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
