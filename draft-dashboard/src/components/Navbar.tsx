'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// CompBeasts logo mark — matches the exact brand logo (green arcs + dark nodes)
// On the dark background the nodes are rendered white so they contrast the same
// way the original black nodes contrast on a white background.
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * 0.76}
      viewBox="0 0 100 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer semicircle arc */}
      <path
        d="M 12 64 A 38 38 0 0 0 88 64"
        stroke="#1a7a3f"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Left inner curve — same weight as outer arc, forms left lens shape */}
      <path
        d="M 12 64 Q 44 54 50 26"
        stroke="#1a7a3f"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right inner curve — mirrors left, forms right lens shape */}
      <path
        d="M 88 64 Q 56 54 50 26"
        stroke="#1a7a3f"
        strokeWidth="5.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Endpoint nodes — white on dark bg = same contrast as black on white in source logo */}
      <circle cx="12" cy="64" r="9" fill="#f0f4f8" />
      <circle cx="88" cy="64" r="9" fill="#f0f4f8" />
    </svg>
  );
}

const NAV_LINKS = [
  { href: '/draft',       label: 'Draft Board'  },
  { href: '/methodology', label: 'Methodology'  },
  { href: '/about',       label: 'About'        },
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
