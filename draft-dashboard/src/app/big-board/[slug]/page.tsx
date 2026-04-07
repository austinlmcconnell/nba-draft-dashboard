'use client';

/**
 * /big-board/[slug] — Individual prospect profile page.
 * Shows full scouting details, headshot, school logo, NBA comp,
 * mock draft assignment (with team logo), and auto-searched YouTube highlights.
 *
 * Headshots and NBA comp player photos are auto-fetched via /api/espn-lookup.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import type { BigBoardPlayer, BigBoardConfig, BigBoardApiResponse } from '@/types/bigboard';
import type { StatItem } from '@/app/api/player-stats/route';
import { findSchool, schoolLogoUrl, collegeHeadshotUrl } from '@/lib/data/school-logos';
import { findNBATeam, nbaLogoUrl } from '@/lib/data/nba-teams';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function StatPill({ label, value }: { label: string; value: string | number }) {
  if (!value || value === 0) return null;
  return (
    <div className="flex flex-col items-center p-3 bg-[#1a2332] rounded-lg">
      <span className="text-base font-black text-[#f9fafb]">{value}</span>
      <span className="text-xs text-[#6b7280] uppercase tracking-wide mt-0.5">{label}</span>
    </div>
  );
}

function ScoutLabel({ label }: { label: string }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">{label}</span>
  );
}

function ScoutValue({ value, color }: { value: string; color?: string }) {
  if (!value) return <span className="text-[#374151] text-sm">—</span>;
  return (
    <p className="text-sm mt-1 leading-relaxed font-semibold" style={{ color: color ?? '#d1d5db' }}>
      {value}
    </p>
  );
}

// ─── ESPN auto-lookup hook ────────────────────────────────────────────────────
function useESPNLookup(
  name: string | null,
  school: string,
  sport: 'mens-college-basketball' | 'nba' = 'mens-college-basketball',
  manualAthleteId?: number,
) {
  const [athleteId,   setAthleteId]   = useState<number | null>(manualAthleteId ?? null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(
    manualAthleteId
      ? `https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/${manualAthleteId}.png`
      : null
  );
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    if (manualAthleteId) { setAthleteId(manualAthleteId); return; }

    let cancelled = false;
    const key = `espnv3::${sport}::${name.toLowerCase()}::${school.toLowerCase()}`;

    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!cancelled) {
          setAthleteId(parsed.athleteId ?? null);
          setHeadshotUrl(parsed.headshotUrl ?? null);
          setTeamName(parsed.teamName ?? null);
        }
        return;
      }
    } catch { /* ignore */ }

    fetch(`/api/espn-lookup?name=${encodeURIComponent(name)}&school=${encodeURIComponent(school)}&sport=${sport}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setAthleteId(data.athleteId ?? null);
        setHeadshotUrl(data.headshotUrl ?? null);
        setTeamName(data.teamName ?? null);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
      })
      .catch(() => { /* silently fail */ });

    return () => { cancelled = true; };
  }, [name, school, sport, manualAthleteId]);

  return { athleteId, headshotUrl, teamName };
}

// ─── Season stats bar ─────────────────────────────────────────────────────────
function SeasonStats({ stats, primaryColor }: { stats: StatItem[]; primaryColor: string }) {
  if (!stats.length) return null;
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-6"
      style={{ borderColor: `#${primaryColor}30` }}>
      <h2 className="text-sm font-black uppercase tracking-widest mb-4"
        style={{ color: `#${primaryColor}` }}>
        2025–26 Stats
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-3">
        {stats.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center p-3 bg-[#1a2332] rounded-lg"
            style={{ borderBottom: `2px solid #${primaryColor}40` }}>
            <span className="text-base font-black text-[#f9fafb]">{value}</span>
            <span className="text-xs text-[#6b7280] uppercase tracking-wide mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── YouTube embed ─────────────────────────────────────────────────────────────
function HighlightsEmbed({ videoId, onRefresh }: { videoId: string; onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#1f2937] shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&mute=1`}
          title="Highlights"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-[#374151] flex-1">
          Auto-matched via YouTube search · may not be perfect
        </p>
        <button
          onClick={onRefresh}
          className="text-xs text-[#6b7280] hover:text-[#4ade80] transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try a different video
        </button>
      </div>
    </div>
  );
}

function HighlightsLoading() {
  return (
    <div className="aspect-video w-full rounded-xl border border-[#1f2937] bg-[#111827] flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 text-[#6b7280]">
        <svg className="w-5 h-5 animate-spin text-[#1a7a3f]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <span className="text-sm">Searching for highlights…</span>
      </div>
    </div>
  );
}

function NoHighlights({ playerName, school }: { playerName: string; school: string }) {
  const query = encodeURIComponent(`${playerName} ${school} basketball highlights 2025 2026`);
  return (
    <div className="aspect-video w-full rounded-xl border border-[#1f2937] bg-[#111827] flex flex-col items-center justify-center text-center p-6">
      <div className="w-12 h-12 rounded-full bg-[#1a2332] border border-[#1f2937] flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p className="text-sm text-[#6b7280] mb-1">No highlight reel found.</p>
      <p className="text-xs text-[#374151] mb-4">
        Enable the YouTube Data API v3 in Google Cloud Console to auto-search videos.
      </p>
      <a
        href={`https://www.youtube.com/results?search_query=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary text-xs py-1.5 px-3"
      >
        Search YouTube manually
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="h-12 bg-[#111827] border-b border-[#1f2937]" />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-8">
          <div className="flex gap-6 flex-wrap">
            <div className="w-32 h-32 animate-shimmer rounded-full" />
            <div className="flex-1 space-y-3 pt-2">
              <div className="h-8 animate-shimmer rounded w-64" />
              <div className="h-5 animate-shimmer rounded w-40" />
              <div className="flex gap-3 mt-4">
                {[1,2,3,4].map(i => <div key={i} className="h-16 w-20 animate-shimmer rounded-lg" />)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 animate-shimmer rounded-xl" />
          <div className="h-64 animate-shimmer rounded-xl" />
        </div>
        <div className="aspect-video animate-shimmer rounded-xl" />
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
        <p className="text-[#6b7280] text-sm mb-6">
          This player isn&apos;t on the current Big Board.
        </p>
        <Link href="/big-board" className="btn-primary text-sm">
          ← Back to Big Board
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProspectProfilePage() {
  const { slug } = useParams<{ slug: string }>();

  const [player,        setPlayer]        = useState<BigBoardPlayer | null>(null);
  const [config,        setConfig]        = useState<BigBoardConfig | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [notFound,      setNotFound]      = useState(false);

  // Highlights state
  const [videoId,       setVideoId]       = useState<string | null>(null);
  const [videoLoading,  setVideoLoading]  = useState(false);
  const [videoSearched, setVideoSearched] = useState(false);

  // Season stats
  const [seasonStats,   setSeasonStats]   = useState<StatItem[]>([]);

  // Image error states
  const [headErr,       setHeadErr]       = useState(false);
  const [schoolErr,     setSchoolErr]     = useState(false);
  const [nbaErr,        setNbaErr]        = useState(false);
  const [compHeadErr,   setCompHeadErr]   = useState(false);
  const [compTeamErr,   setCompTeamErr]   = useState(false);

  // ── Load player data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [boardRes, configRes] = await Promise.all([
          fetch('/api/big-board', { cache: 'no-store' }),
          fetch('/data/big-board-config.json').catch(() => null),
        ]);

        const board: BigBoardApiResponse = await boardRes.json();
        const found = board.players.find(p => p.slug === slug) ?? null;
        if (!found) { setNotFound(true); setIsLoading(false); return; }
        setPlayer(found);

        let cfg = null;
        if (configRes?.ok) {
          cfg = await configRes.json();
          setConfig(cfg);
        }

        const pinnedId = cfg?.players?.[found.name]?.youtubeVideoId;
        if (pinnedId) {
          setVideoId(pinnedId);
          setVideoSearched(true);
        }

        setIsLoading(false);

        if (!pinnedId) {
          searchHighlights(found.name, found.school);
        }
      } catch {
        setNotFound(true);
        setIsLoading(false);
      }
    }
    load();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ESPN auto-lookup for this prospect ─────────────────────────────────────
  const manualAthleteId = player ? config?.players?.[player.name]?.espnAthleteId : undefined;
  const { athleteId: prospectAthleteId, headshotUrl: prospectHeadshotUrl } = useESPNLookup(
    player?.name ?? null,
    player?.school ?? '',
    'mens-college-basketball',
    manualAthleteId,
  );

  // Reset headshot error if a new URL arrives
  useEffect(() => { setHeadErr(false); }, [prospectHeadshotUrl]);

  // Fetch season stats once we have the ESPN athlete ID
  useEffect(() => {
    if (!prospectAthleteId) return;
    fetch(`/api/player-stats?athleteId=${prospectAthleteId}`)
      .then(r => r.json())
      .then(data => { if (data.stats?.length) setSeasonStats(data.stats); })
      .catch(() => {});
  }, [prospectAthleteId]);

  // ── ESPN auto-lookup for the NBA comparison player ─────────────────────────
  const { headshotUrl: nbaCompHeadshotUrl, teamName: nbaCompTeamName } = useESPNLookup(
    player?.nbaComparison ?? null,
    '',
    'nba',
  );

  // Resolve NBA comp team from name returned by ESPN
  const nbaCompTeam = nbaCompTeamName ? findNBATeam(nbaCompTeamName) : null;

  // Reset comp errors if new data arrives
  useEffect(() => { setCompHeadErr(false); setCompTeamErr(false); }, [nbaCompHeadshotUrl]);

  // ── YouTube search ──────────────────────────────────────────────────────────
  const searchHighlights = useCallback(async (name: string, school: string) => {
    setVideoLoading(true);
    setVideoSearched(false);
    try {
      const params = new URLSearchParams({ name, school });
      const res = await fetch(`/api/highlights?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVideoId(data.videoId ?? null);
      }
    } finally {
      setVideoLoading(false);
      setVideoSearched(true);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    if (player) {
      setVideoId(null);
      setVideoSearched(false);
      searchHighlights(player.name, player.school);
    }
  }, [player, searchHighlights]);

  // ── Render guards ───────────────────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;
  if (notFound || !player) return <NotFound />;

  const school  = findSchool(player.school);
  const nbaTeam = player.mockTeam ? findNBATeam(player.mockTeam) : null;

  const hasHeadshot   = !!prospectHeadshotUrl && !headErr;
  const hasSchool     = !!school && school.espnTeamId > 0 && !schoolErr;
  const hasNbaLogo    = !!nbaTeam && !nbaErr;
  const hasCompHead   = !!nbaCompHeadshotUrl && !compHeadErr;
  const hasCompTeam   = !!nbaCompTeam && !compTeamErr;

  const primaryColor   = school?.primary   ?? '1a7a3f';
  const secondaryColor = school?.secondary ?? '145f30';

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* ── Back nav ────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            href="/big-board"
            className="inline-flex items-center text-sm font-medium text-[#9ca3af] hover:text-[#4ade80] transition-colors"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Big Board
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Hero card ─────────────────────────────────────────────────────── */}
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.4)]">

          {/* Gradient banner — school logo only, no badges (avoids headshot overlap) */}
          <div
            className="h-20 relative"
            style={{ background: `linear-gradient(135deg, #${primaryColor}, #${secondaryColor})` }}
          >
            <div className="absolute inset-0 bg-black/20" />
            <div className="absolute top-3 right-6 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center overflow-hidden z-10">
              {hasSchool ? (
                <Image src={schoolLogoUrl(school!.espnTeamId)} alt={player.school}
                  width={40} height={40} className="object-contain p-1"
                  onError={() => setSchoolErr(true)} unoptimized />
              ) : (
                <span className="text-xs font-black text-gray-700">
                  {school?.abbreviation ?? player.school.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 pt-5" style={{ borderTop: `3px solid #${primaryColor}` }}>
            <div className="flex items-start gap-5 flex-wrap">

              {/* Headshot */}
              <div className="flex-shrink-0">
                {hasHeadshot ? (
                  <Image src={prospectHeadshotUrl!} alt={player.name}
                    width={96} height={96}
                    className="w-24 h-24 rounded-full object-cover border-4 shadow-xl"
                    style={{ borderColor: `#${primaryColor}` }}
                    onError={() => setHeadErr(true)} unoptimized />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 shadow-xl flex items-center justify-center"
                    style={{ background: `#${primaryColor}` }}>
                    <span className="text-3xl font-black text-white/80">
                      {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + school + rank/position badges */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-3 py-1 text-white text-xs font-black rounded-full"
                    style={{ background: `#${primaryColor}`, border: `1px solid #${primaryColor}80` }}>
                    #{player.rank} Overall
                  </span>
                  <span className="px-2.5 py-1 bg-[#1a2332] text-[#9ca3af] text-xs font-bold rounded-full border border-[#374151]">
                    {player.position}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#f9fafb] leading-tight">
                  {player.name}
                </h1>
                <p className="text-sm text-[#6b7280] mt-0.5">{player.school}</p>
              </div>
            </div>

            {/* Physical stat pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              <StatPill label="Draft Age" value={player.draftAge > 0 ? player.draftAge.toFixed(1) : '—'} />
              <StatPill label="Height"   value={player.height   || '—'} />
              <StatPill label="Weight"   value={player.weight > 0 ? `${player.weight} lbs` : '—'} />
              <StatPill label="Wingspan" value={player.wingspan  || '—'} />
            </div>
          </div>
        </div>

        {/* ── Season stats ──────────────────────────────────────────────────── */}
        <SeasonStats stats={seasonStats} primaryColor={primaryColor} />

        {/* ── Two-column layout ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Scouting report */}
          <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-6 space-y-5"
            style={{ borderColor: `#${primaryColor}30` }}>
            <h2 className="text-sm font-black uppercase tracking-widest"
              style={{ color: `#${primaryColor}` }}>
              Scouting Report
            </h2>

            <div>
              <ScoutLabel label="Biggest Skill" />
              <ScoutValue value={player.biggestSkill} color="#4ade80" />
            </div>

            <div>
              <ScoutLabel label="Biggest Weakness" />
              <ScoutValue value={player.biggestWeakness} color="#ef4444" />
            </div>

            <div className="pt-2 border-t border-[#1f2937]">
              <ScoutLabel label="NBA Comparison" />
              {player.nbaComparison ? (
                <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-[#1a2332] rounded-lg border border-[#374151]">
                  {/* NBA comp player headshot */}
                  {hasCompHead ? (
                    <Image src={nbaCompHeadshotUrl!} alt={player.nbaComparison}
                      width={40} height={40}
                      className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                      onError={() => setCompHeadErr(true)} unoptimized />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#0d1117] border border-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#6b7280]">
                        {player.nbaComparison.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[#d1d5db] truncate">
                      {player.nbaComparison}
                    </span>
                    {/* NBA comp player's current team logo */}
                    {hasCompTeam && (
                      <Image src={nbaLogoUrl(nbaCompTeam!.espnId)} alt={nbaCompTeam!.name}
                        width={20} height={20}
                        className="object-contain flex-shrink-0"
                        onError={() => setCompTeamErr(true)} unoptimized />
                    )}
                  </div>
                </div>
              ) : (
                <ScoutValue value="" />
              )}
            </div>
          </div>

          {/* Mock Draft */}
          <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-6"
            style={{ borderColor: `#${primaryColor}30` }}>
            <h2 className="text-sm font-black uppercase tracking-widest mb-5"
              style={{ color: `#${primaryColor}` }}>
              My Mock Draft
            </h2>

            {player.mockPickNo && player.mockTeam ? (
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-[#1a2332] rounded-xl border border-[#374151] flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {hasNbaLogo ? (
                    <Image
                      src={nbaLogoUrl(nbaTeam!.espnId)}
                      alt={player.mockTeam}
                      width={64} height={64}
                      className="object-contain p-2"
                      onError={() => setNbaErr(true)}
                      unoptimized
                    />
                  ) : (
                    <span className="text-lg font-black text-[#6b7280]">
                      {player.mockTeam.slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl font-black text-[#f9fafb]">#{player.mockPickNo}</span>
                    {player.mockPickNo <= 5 && (
                      <span className="px-2 py-0.5 bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold rounded-full">
                        Top 5
                      </span>
                    )}
                    {player.mockPickNo > 5 && player.mockPickNo <= 14 && (
                      <span className="px-2 py-0.5 bg-[#1a7a3f]/20 border border-[#1a7a3f]/40 text-[#4ade80] text-xs font-bold rounded-full">
                        Lottery
                      </span>
                    )}
                  </div>
                  <p className="text-[#f9fafb] font-bold text-lg mt-0.5">{player.mockTeam}</p>
                  {nbaTeam && (
                    <p className="text-xs text-[#6b7280] mt-0.5">{nbaTeam.city} {nbaTeam.name}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-full bg-[#1a2332] border border-[#1f2937] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-[#6b7280]">Mock pick not yet assigned</p>
                <p className="text-xs text-[#374151] mt-1">
                  Fill in &ldquo;My Mock Pick No.&rdquo; and &ldquo;My Mock Team&rdquo; in your sheet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Highlights ────────────────────────────────────────────────────── */}
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] p-6"
          style={{ borderColor: `#${primaryColor}30` }}>
          <h2 className="text-sm font-black uppercase tracking-widest mb-5"
            style={{ color: `#${primaryColor}` }}>
            Highlights
          </h2>

          {videoLoading ? (
            <HighlightsLoading />
          ) : videoId ? (
            <HighlightsEmbed videoId={videoId} onRefresh={handleRefresh} />
          ) : videoSearched ? (
            <NoHighlights playerName={player.name} school={player.school} />
          ) : (
            <HighlightsLoading />
          )}
        </div>

      </main>
    </div>
  );
}
