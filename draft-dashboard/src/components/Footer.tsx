import React from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';

const LINKS = [
  { group: 'Product',   items: [
    { href: '/draft',       label: 'Draft Board'  },
    { href: '/methodology', label: 'Methodology'  },
    { href: '/about',       label: 'About'        },
  ]},
  { group: 'Data Sources', items: [
    { href: 'https://www.collegebasketballdata.com', label: 'CollegeBasketballData' },
    { href: 'https://www.basketball-reference.com',  label: 'Basketball Reference'  },
    { href: 'https://www.tankathon.com',             label: 'Tankathon Big Board'   },
  ]},
];

export default function Footer() {
  return (
    <footer className="bg-[#0d1117] border-t border-[#1f2937] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand column */}
          <div>
            <div className="mb-3">
              <Logo size={32} variant="onDark" textSize="text-base" />
            </div>
            <p className="text-[#6b7280] text-sm leading-relaxed max-w-xs">
              Advanced NBA draft analytics. Compare college prospects to
              6,800+ historical players using multi-faceted statistical modeling.
            </p>
            <p className="text-[#374151] text-xs mt-4">
              2025–26 Season · 2026 NBA Draft
            </p>
          </div>

          {/* Link groups */}
          {LINKS.map(({ group, items }) => (
            <div key={group}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-4">
                {group}
              </h3>
              <ul className="space-y-2.5">
                {items.map(({ href, label }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm text-[#9ca3af] hover:text-[#f9fafb] transition-colors"
                      {...(href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-[#1f2937] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[#374151] text-xs">
            © {new Date().getFullYear()} CompBeasts. For informational purposes only.
          </p>
          <p className="text-[#374151] text-xs">
            Stats from CollegeBasketballData · Basketball Reference · Rankings from Tankathon
          </p>
        </div>
      </div>
    </footer>
  );
}
