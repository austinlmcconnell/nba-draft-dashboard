/**
 * CompBeasts logo mark.
 *
 * Two nested quadratic arcs (the "leaf" shape) connecting two solid anchor
 * nodes — intended to evoke a basketball net / court-spanning comparison.
 * Matches the master brand asset exactly; keep structure in sync with
 * the PNG in public/logo.png.
 */
import React from 'react';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.55)}
      viewBox="0 0 200 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Upper (outer) arc — high peak */}
      <path
        d="M 28 85 Q 100 -6 172 85"
        stroke="#1a7a3f"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lower (inner) arc — shallower peak; together they form a lens shape */}
      <path
        d="M 28 85 Q 100 30 172 85"
        stroke="#1a7a3f"
        strokeWidth="11"
        strokeLinecap="round"
        fill="none"
      />
      {/* Solid anchor nodes at each endpoint */}
      <circle cx="28" cy="85" r="17" fill="#0d1117" />
      <circle cx="172" cy="85" r="17" fill="#0d1117" />
    </svg>
  );
}

/**
 * Brand wordmark with the logo mark to the left.
 *  variant="onDark"  → COMP in white (default; for dark-themed headers/footers)
 *  variant="onLight" → COMP in near-black (matches the master brand asset)
 */
interface LogoProps {
  size?: number;
  variant?: 'onDark' | 'onLight';
  textSize?: string;
  className?: string;
}

export function Logo({
  size = 36,
  variant = 'onDark',
  textSize = 'text-xl',
  className = '',
}: LogoProps) {
  const compColor = variant === 'onLight' ? 'text-[#0d1117]' : 'text-[#f9fafb]';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className={`font-bold ${textSize} tracking-wide uppercase select-none leading-none`}>
        <span className={compColor}>COMP </span>
        <span className="text-[#1a7a3f]">BEASTS</span>
      </span>
    </div>
  );
}
