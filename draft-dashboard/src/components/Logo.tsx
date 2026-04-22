/**
 * CompBeasts logo mark.
 *
 * Two nested upward arcs (the "lens" shape) connecting two solid anchor
 * nodes. The master brand asset has black anchors on a white field; on
 * the site's dark theme the anchors render white so they remain visible
 * — a standard light/dark inversion of the same structure.
 */
import React from 'react';

interface LogoMarkProps {
  size?: number;
  /** Color of the anchor circles. "auto" uses white for dark surfaces, black for light. */
  anchorFill?: string;
  /** Color of the arc strokes. Defaults to the brand green. */
  arcStroke?: string;
}

export function LogoMark({
  size = 42,
  anchorFill = '#f9fafb',
  arcStroke = '#1a7a3f',
}: LogoMarkProps) {
  const height = Math.round(size * 0.70);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Upper (outer) arc — high peak */}
      <path
        d="M 32 110 Q 100 10 168 110"
        stroke={arcStroke}
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lower (inner) arc — shallower peak; together they form the lens shape */}
      <path
        d="M 32 110 Q 100 55 168 110"
        stroke={arcStroke}
        strokeWidth="13"
        strokeLinecap="round"
        fill="none"
      />
      {/* Solid anchor nodes */}
      <circle cx="32" cy="110" r="22" fill={anchorFill} />
      <circle cx="168" cy="110" r="22" fill={anchorFill} />
    </svg>
  );
}

/**
 * Brand wordmark with the logo mark to the left.
 *   variant="onDark"  → white "COMP" + green "BEASTS", white anchors
 *   variant="onLight" → black "COMP" + green "BEASTS", black anchors (master asset)
 */
interface LogoProps {
  size?: number;
  variant?: 'onDark' | 'onLight';
  textSize?: string;
  className?: string;
}

export function Logo({
  size = 42,
  variant = 'onDark',
  textSize = 'text-xl',
  className = '',
}: LogoProps) {
  const compColor  = variant === 'onLight' ? 'text-[#0d1117]' : 'text-[#f9fafb]';
  const anchorFill = variant === 'onLight' ? '#0d1117' : '#f9fafb';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} anchorFill={anchorFill} />
      <span className={`font-bold ${textSize} tracking-wide uppercase select-none leading-none`}>
        <span className={compColor}>COMP </span>
        <span className="text-[#1a7a3f]">BEASTS</span>
      </span>
    </div>
  );
}
