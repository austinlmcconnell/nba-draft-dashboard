'use client';

/**
 * /big-board — Austin's personal 2026 NBA Draft Big Board.
 * Reads live from Google Sheets via /api/big-board.
 * Polls every 60 s so edits in the sheet appear automatically.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import type { BigBoardPlayer, BigBoardConfig, BigBoardApiResponse } from '@/types/bigboard';
import { BigBoardRow, BigBoardRowSkeleton } from '@/components/BigBoardRow';

// ─── Column header ────────────────────────────────────────────────────────────
function ColHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-xs font-semibold uppercase tracking-wider text-[#6b7280] ${className}`}>
      {children}
    </div>
  );
}

// ─── Last-updated badge ───────────────────────────────────────────────────────
function UpdatedBadge({ updatedAt, isRefreshing }: { updatedAt: string | null; isRefreshing: boolean }) {
  if (!updatedAt) return null;
  const time = new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex items-center gap-1.5 text-xs text-[#6b7280]">
      <span
        className={`w-1.5 h-1.5 rounded-full ${isRefreshing ? 'bg-amber-400 animate-pulse' : 'bg-[#1a7a3f]'}`}
      />
      {isRefreshing ? 'Refreshing…' : `Updated ${time}`}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-[#1a2332] flex items-center justify-center mb-4 border border-[#1f2937]">
        <svg className="w-8 h-8 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-[#f9fafb] mb-2">Board is empty</h3>
      <p className="text-sm text-[#6b7280] max-w-xs">
        Start filling in your 2026 NBA Draft Big Board Google Sheet and prospects will appear here automatically.
      </p>
      <a
        href="https://docs.google.com/spreadsheets/d/1X0l92tV3ZPAiWsJ_-NEINBtVv50kYix7s4EbKHK-XxM/edit"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 btn-secondary text-sm"
      >
        Open Google Sheet
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────
function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-800/30 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-[#f9fafb] mb-2">Couldn't load board</h3>
      <p className="text-xs text-[#6b7280] mb-4 max-w-sm font-mono">{message}</p>
      <button onClick={retry} className="btn-primary text-sm">
        Try Again
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BigBoardPage() {
  const [players,     setPlayers]     = useState<BigBoardPlayer[]>([]);
  const [config,      setConfig]      = useState<BigBoardConfig | null>(null);
  const [updatedAt,   setUpdatedAt]   = useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isRefreshing,setIsRefreshing]= useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const fetchBoard = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [boardRes, configRes] = await Promise.all([
        fetch('/api/big-board', { cache: 'no-store' }),
        fetch('/data/big-board-config.json').catch(() => null),
      ]);

      const board: BigBoardApiResponse = await boardRes.json();
      if (board.error && players.length === 0) throw new Error(board.error);

      setPlayers(board.players);
      setUpdatedAt(board.updatedAt);

      if (configRes?.ok) {
        const cfg: BigBoardConfig = await configRes.json();
        setConfig(cfg);
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [players.length]);

  // Initial load
  useEffect(() => { fetchBoard(); }, []);

  // Auto-refresh every 60 s + on window focus
  useEffect(() => {
    const interval = setInterval(() => fetchBoard(true), 60_000);
    const onFocus  = () => fetchBoard(true);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [fetchBoard]);

  const hasMockData = players.some(p => p.mockPickNo !== null);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#1a7a3f]/20 border border-[#1a7a3f]/40 rounded-full text-xs font-semibold text-[#4ade80]">
                  Live · Auto-updates
                </span>
                <UpdatedBadge updatedAt={updatedAt} isRefreshing={isRefreshing} />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-[#f9fafb]">
                My <span className="gradient-text">2026 NBA Draft</span> Big Board
              </h1>
              <p className="mt-2 text-[#6b7280] text-sm max-w-lg">
                Personal prospect rankings updated as the 2025–26 season progresses.
                Synced live from Google Sheets.
              </p>
            </div>

            {/* Sheet link */}
            <a
              href="https://docs.google.com/spreadsheets/d/1X0l92tV3ZPAiWsJ_-NEINBtVv50kYix7s4EbKHK-XxM/edit"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm self-start"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Edit Sheet
            </a>
          </div>

          {/* Summary stats */}
          {players.length > 0 && (
            <div className="mt-6 flex gap-6 flex-wrap">
              <div>
                <span className="text-2xl font-black text-[#f9fafb]">{players.length}</span>
                <span className="text-xs text-[#6b7280] ml-1.5">Prospects ranked</span>
              </div>
              {hasMockData && (
                <div>
                  <span className="text-2xl font-black text-[#4ade80]">
                    {players.filter(p => p.mockPickNo !== null).length}
                  </span>
                  <span className="text-xs text-[#6b7280] ml-1.5">Mock picks assigned</span>
                </div>
              )}
              <div>
                <span className="text-2xl font-black text-[#f9fafb]">
                  {[...new Set(players.map(p => p.position))].length}
                </span>
                <span className="text-xs text-[#6b7280] ml-1.5">Positions</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Board ─────────────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">

          {/* Column headers */}
          {(players.length > 0 || isLoading) && (
            <div className="flex items-center gap-4 px-5 py-3 border-b border-[#1f2937] bg-[#0d1117]">
              <ColHeader className="w-8 text-center">#</ColHeader>
              <div className="w-12" /> {/* headshot spacer */}
              <ColHeader className="flex-1">Prospect</ColHeader>
              <ColHeader className="hidden sm:block w-20 text-right">Size</ColHeader>
              <ColHeader className="hidden md:block w-36 text-right">NBA Comp</ColHeader>
              <ColHeader className="w-28 text-right">{hasMockData ? 'Mock Pick' : ''}</ColHeader>
              <div className="w-4" /> {/* chevron spacer */}
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div>
              {Array.from({ length: 10 }).map((_, i) => (
                <BigBoardRowSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} retry={() => fetchBoard()} />
          ) : players.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {players.map((player, i) => (
                <BigBoardRow
                  key={player.slug}
                  player={player}
                  config={config?.players?.[player.name]}
                  index={i}
                />
              ))}

              {/* Footer note */}
              <div className="px-5 py-4 border-t border-[#1f2937] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#374151]">
                  Rankings update live from Google Sheets · click any prospect for full profile
                </p>
                <button
                  onClick={() => fetchBoard(true)}
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
      </main>
    </div>
  );
}
