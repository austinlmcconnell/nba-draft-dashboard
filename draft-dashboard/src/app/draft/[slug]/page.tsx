'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { DraftBoardEntry, DraftComp, DraftBoardApiResponse } from '@/types/player';

// ─── VORP color helpers ─────────────────────────────────────────────────────
// Career total VORP thresholds:
//   ≥ 25 : franchise-level career   (LeBron, Curry tier)
//   ≥ 10 : solid long starter
//   ≥  2 : established rotation
//   ≥  0 : stuck in the league
//   <  0 : never cleared replacement
function vorpTextColor(r: number | null): string {
  if (r === null) return 'text-[#6b7280]';
  if (r >= 25) return 'text-emerald-400';
  if (r >= 10) return 'text-[#4ade80]';
  if (r >=  2) return 'text-[#9ca3af]';
  if (r >=  0) return 'text-amber-400';
  return 'text-red-400';
}

function vorpBarColor(r: number | null): string {
  if (r === null) return 'bg-[#1f2937]';
  if (r >= 25) return 'bg-emerald-500';
  if (r >= 10) return 'bg-[#22a052]';
  if (r >=  2) return 'bg-[#4b5563]';
  if (r >=  0) return 'bg-amber-500';
  return 'bg-red-500';
}

// VORP career totals range ≈ −2 to +150 in our dataset. Map −2…40 linearly to
// 0…100% so the bar fills meaningfully for most drafted players (the handful
// of all-time greats saturate at 100%).
function vorpBarWidth(r: number | null): string {
  if (r === null) return '0%';
  const pct = Math.max(0, Math.min(100, ((r + 2) / 42) * 100));
  return `${pct.toFixed(1)}%`;
}

// ─── Comp row ─────────────────────────────────────────────────────────────────
function CompRow({ comp, index }: { comp: DraftComp; index: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1f2937] last:border-0">
      {/* Rank */}
      <div className="w-6 text-center text-xs font-black text-[#4b5563]">{index + 1}</div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#f9fafb] truncate">{comp.name}</p>
        <p className="text-xs text-[#6b7280] truncate">
          {comp.collegeTeam} · {comp.collegeSeason}–{String(comp.collegeSeason + 1).slice(2)}
          {comp.position ? ` · ${comp.position}` : ''}
        </p>
      </div>

      {/* Similarity */}
      <div className="hidden sm:block w-20 text-right">
        <span className="text-xs text-[#4b5563]">{comp.similarity.toFixed(0)}% sim</span>
      </div>

      {/* VORP bar + value */}
      <div className="w-40 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#1f2937] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${vorpBarColor(comp.vorp)}`}
            style={{ width: vorpBarWidth(comp.vorp) }}
          />
        </div>
        <span className={`text-sm font-black w-14 text-right tabular-nums ${vorpTextColor(comp.vorp)}`}>
          {comp.vorp !== null
            ? `${comp.vorp >= 0 ? '+' : ''}${comp.vorp.toFixed(2)}`
            : '—'}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="h-12 bg-[#111827] border-b border-[#1f2937]" />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        <div className="h-28 animate-shimmer rounded-xl" />
        <div className="h-96 animate-shimmer rounded-xl" />
      </div>
    </div>
  );
}

// ─── Not found ────────────────────────────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="text-center px-4">
        <div className="text-6xl font-black text-[#1f2937] mb-4">404</div>
        <h2 className="text-xl font-bold text-[#f9fafb] mb-2">Prospect not found</h2>
        <p className="text-[#6b7280] text-sm mb-6">This player isn&apos;t on the current Draft Board.</p>
        <Link href="/draft" className="btn-primary text-sm">← Back to Draft Board</Link>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DraftProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [entry,     setEntry]     = useState<DraftBoardEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound,  setNotFound]  = useState(false);

  useEffect(() => {
    fetch('/api/draft-board', { cache: 'no-store' })
      .then(r => r.json())
      .then((data: DraftBoardApiResponse) => {
        const found = data.entries.find(e => e.slug === slug) ?? null;
        if (!found) { setNotFound(true); } else { setEntry(found); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [slug]);

  if (isLoading) return <LoadingSkeleton />;
  if (notFound || !entry) return <NotFound />;

  const vorpComps = entry.comps.filter(c => c.vorp !== null);

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* Back nav */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/draft"
            className="inline-flex items-center text-sm font-medium text-[#6b7280] hover:text-[#4ade80] transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Draft Board
          </Link>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* Hero card */}
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
          <div className="px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-widest text-[#4b5563]">
                  #{entry.bigBoardRank} on Big Board
                </span>
                <span className="text-[#374151]">·</span>
                <span className="text-xs font-semibold text-[#6b7280]">{entry.position}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#f9fafb]">{entry.name}</h1>
              <p className="text-[#6b7280] text-sm mt-0.5">{entry.school}</p>
            </div>

            {/* Avg VORP display */}
            {entry.avgVorp !== null && (
              <div className="flex flex-col items-center text-center px-5 py-3 bg-[#0d1117] rounded-xl border border-[#1f2937]">
                <span className={`text-4xl font-black tabular-nums ${vorpTextColor(entry.avgVorp)}`}>
                  {entry.avgVorp >= 0 ? '+' : ''}{entry.avgVorp.toFixed(2)}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#4b5563] mt-1">
                  Avg Comp VORP
                </span>
                <span className="text-[10px] text-[#374151] mt-0.5">
                  {entry.vorpCoverage} of {entry.comps.length} comps
                </span>
              </div>
            )}
          </div>

          {entry.avgVorp === null && entry.comps.length === 0 && (
            <div className="px-6 pb-5">
              <p className="text-sm text-[#6b7280]">
                No college stats found for this player — they may not be in the 2025–26 database yet.
              </p>
            </div>
          )}
        </div>

        {/* Comps table */}
        {entry.comps.length > 0 && (
          <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#1f2937] flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-[#4ade80]">
                  Historical Comparisons
                </h2>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  10 closest college statistical comps who were drafted · sorted by similarity
                </p>
              </div>
              <span className="text-[10px] text-[#374151] uppercase tracking-wide">Career VORP</span>
            </div>

            <div>
              {entry.comps.map((comp, i) => (
                <CompRow key={`${comp.name}-${comp.collegeSeason}`} comp={comp} index={i} />
              ))}
            </div>

            {/* VORP summary */}
            {vorpComps.length > 0 && (
              <div className="px-6 py-4 border-t border-[#1f2937] bg-[#0d1117]/50 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[#6b7280]">
                    {entry.vorpCoverage} comps with VORP data
                    {entry.vorpCoverage < 10 && (
                      <span className="text-[#374151]"> · {10 - entry.vorpCoverage} comps pre-2014 era</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#6b7280]">Group avg:</span>
                  <span className={`text-base font-black tabular-nums ${vorpTextColor(entry.avgVorp)}`}>
                    {entry.avgVorp !== null
                      ? `${entry.avgVorp >= 0 ? '+' : ''}${entry.avgVorp.toFixed(2)}`
                      : '—'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* What VORP means */}
        <div className="bg-[#0d1117] rounded-xl border border-[#1f2937] px-5 py-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#4b5563] mb-3">VORP Scale</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { range: '≥ +4.0', label: 'Elite / All-Star',    cls: 'text-emerald-400' },
              { range: '+1.5',   label: 'Solid Starter',       cls: 'text-[#4ade80]' },
              { range: '0',      label: 'Average',             cls: 'text-[#9ca3af]' },
              { range: '−2',     label: 'Below Average',       cls: 'text-amber-400' },
              { range: '< −2',   label: 'Replacement Level',   cls: 'text-red-400' },
            ].map(({ range, label, cls }) => (
              <div key={range} className="text-center">
                <p className={`text-sm font-black ${cls}`}>{range}</p>
                <p className="text-[10px] text-[#4b5563] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-[#374151] mt-4">
            VORP (Basketball Reference) measures points above average per 100 possessions.
            Career average is weighted by minutes played.
          </p>
        </div>

      </main>
    </div>
  );
}
