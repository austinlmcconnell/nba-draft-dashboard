'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { DraftBoardEntry, DraftBoardApiResponse } from '@/types/player';

// ─── RAPTOR color helpers ────────────────────────────────────────────────────
// Avg career RAPTOR of 10 comps (pts per 100 possessions above average).
// RAPTOR is position-neutral — guards and bigs are on the same scale.
//   ≥ 3.0 : comp group averages star-tier NBA impact
//   ≥ 1.5 : comp group averages solid starter / All-Star fringe
//   ≥ 0.0 : comp group averages positive contributors
//   ≥ -1.5: comp group averages rotation-level players
//   < -1.5: comp group mostly busts / below replacement
function raptorColor(r: number | null): string {
  if (r === null) return 'text-[#6b7280]';
  if (r >= 3.0)  return 'text-emerald-400';
  if (r >= 1.5)  return 'text-[#4ade80]';
  if (r >= 0.0)  return 'text-[#9ca3af]';
  if (r >= -1.5) return 'text-amber-400';
  return 'text-red-400';
}

function raptorBadge(r: number | null): string {
  if (r === null) return 'bg-[#1a2332] border-[#1f2937] text-[#6b7280]';
  if (r >= 3.0)  return 'bg-emerald-900/30 border-emerald-700/40 text-emerald-300';
  if (r >= 1.5)  return 'bg-[#1a7a3f]/20 border-[#1a7a3f]/40 text-[#4ade80]';
  if (r >= 0.0)  return 'bg-[#1a2332] border-[#1f2937] text-[#9ca3af]';
  if (r >= -1.5) return 'bg-amber-900/20 border-amber-700/30 text-amber-400';
  return 'bg-red-900/20 border-red-700/30 text-red-400';
}

// ─── Row ──────────────────────────────────────────────────────────────────────
function BoardRow({ entry, ws48Rank }: { entry: DraftBoardEntry; ws48Rank: number }) {
  return (
    <Link
      href={`/draft/${entry.slug}`}
      className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1f2937] hover:bg-white/[0.02] transition-colors group"
    >
      {/* WS/48 rank */}
      <div className="w-8 text-center text-sm font-black text-[#4b5563] group-hover:text-[#6b7280] transition-colors">
        {ws48Rank}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[#f9fafb] text-sm truncate group-hover:text-[#4ade80] transition-colors">
          {entry.name}
        </p>
        <p className="text-xs text-[#6b7280] truncate">
          {entry.school} · {entry.position}
        </p>
      </div>

      {/* Big board rank */}
      <div className="hidden sm:block w-20 text-right">
        <span className="text-xs text-[#6b7280]">#{entry.bigBoardRank}</span>
      </div>

      {/* Avg RAPTOR */}
      <div className="w-28 text-right">
        {entry.avgRaptor !== null ? (
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${raptorBadge(entry.avgRaptor)}`}>
            {entry.avgRaptor >= 0 ? '+' : ''}{entry.avgRaptor.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-[#374151]">—</span>
        )}
      </div>

      {/* Comps coverage */}
      <div className="hidden lg:block w-20 text-right">
        <span className="text-xs text-[#374151]">{entry.raptorCoverage}/10 comps</span>
      </div>

      {/* Chevron */}
      <svg className="w-4 h-4 text-[#374151] group-hover:text-[#4ade80] flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1f2937]">
      <div className="w-8 h-4 animate-shimmer rounded" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-36 animate-shimmer rounded" />
        <div className="h-3 w-24 animate-shimmer rounded" />
      </div>
      <div className="w-20 h-5 animate-shimmer rounded-full" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DraftBoardPage() {
  const [entries,      setEntries]      = useState<DraftBoardEntry[]>([]);
  const [updatedAt,    setUpdatedAt]    = useState<string | null>(null);
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/draft-board', { cache: 'no-store' });
      const data: DraftBoardApiResponse = await res.json();
      if (data.error && entries.length === 0) throw new Error(data.error);
      setEntries(data.entries);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [entries.length]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const iv = setInterval(() => load(true), 60_000);
    const focus = () => load(true);
    window.addEventListener('focus', focus);
    return () => { clearInterval(iv); window.removeEventListener('focus', focus); };
  }, [load]);

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* Header */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#1a7a3f]/20 border border-[#1a7a3f]/40 rounded-full text-xs font-semibold text-[#4ade80]">
                  RAPTOR Rankings
                </span>
                {updatedAt && (
                  <span className="flex items-center gap-1.5 text-xs text-[#6b7280]">
                    <span className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-amber-400 animate-pulse' : 'bg-[#1a7a3f]'}`} />
                    {isRefreshing ? 'Refreshing…' : `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#f9fafb]">
                2026 Draft <span className="gradient-text">Board</span>
              </h1>
              <p className="mt-2 text-[#6b7280] text-sm max-w-lg">
                Prospects ranked by average career RAPTOR of their 10 closest historical
                college comps — an impact-based metric that is already position-neutral.
              </p>
            </div>
            <Link href="/methodology" className="btn-secondary text-sm self-start">
              How it works →
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">

          {/* Column headers */}
          {(entries.length > 0 || isLoading) && (
            <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1f2937] bg-[#0d1117]">
              <div className="w-8 text-center text-xs font-semibold uppercase tracking-wider text-[#6b7280]">#</div>
              <div className="flex-1 text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Prospect</div>
              <div className="hidden sm:block w-20 text-right text-xs font-semibold uppercase tracking-wider text-[#6b7280]">My Rank</div>
              <div className="w-28 text-right text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Avg RAPTOR</div>
              <div className="hidden lg:block w-20 text-right text-xs font-semibold uppercase tracking-wider text-[#6b7280]">Coverage</div>
              <div className="w-4" />
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div>{Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)}</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <p className="text-red-400 text-sm mb-4">{error}</p>
              <button onClick={() => load()} className="btn-primary text-sm">Try Again</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <p className="text-[#6b7280] text-sm">No prospects on the Big Board yet.</p>
              <p className="text-xs text-[#374151] mt-1">Add players to your Google Sheet and they&apos;ll appear here.</p>
            </div>
          ) : (
            <div>
              {entries.map((entry, i) => (
                <BoardRow key={entry.slug} entry={entry} ws48Rank={i + 1} />
              ))}
              <div className="px-5 py-4 border-t border-[#1f2937] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#374151]">
                  Ranked by avg career RAPTOR of 10 historical college comps · click any prospect for full breakdown
                </p>
                <button
                  onClick={() => load(true)}
                  className="text-xs text-[#6b7280] hover:text-[#4ade80] transition-colors flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {entries.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
            <p className="text-xs text-[#374151] font-semibold uppercase tracking-wider">RAPTOR:</p>
            {[
              { label: '≥ +3.0  Star comps',       cls: 'text-emerald-400' },
              { label: '≥ +1.5  Starter tier',      cls: 'text-[#4ade80]' },
              { label: '≥  0.0  Positive impact',   cls: 'text-[#9ca3af]' },
              { label: '≥ −1.5  Rotation level',    cls: 'text-amber-400' },
              { label: '< −1.5  Below replacement', cls: 'text-red-400' },
            ].map(({ label, cls }) => (
              <span key={label} className={`text-xs font-semibold ${cls}`}>{label}</span>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
