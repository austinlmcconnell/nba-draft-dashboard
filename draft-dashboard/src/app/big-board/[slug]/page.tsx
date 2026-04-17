'use client';

/**
 * /big-board/[slug] — Individual prospect profile page.
 * Hero banner uses school branding; body uses CompBeasts branding.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import type { BigBoardPlayer, BigBoardConfig, BigBoardApiResponse } from '@/types/bigboard';
import type { StatItem } from '@/app/api/player-stats/route';
import { findSchool, schoolLogoUrl } from '@/lib/data/school-logos';
import { findNBATeam, nbaLogoUrl } from '@/lib/data/nba-teams';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function ScoutLabel({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-widest text-[#4b5563]">{label}</span>
  );
}

function ScoutValue({ value, color }: { value: string; color?: string }) {
  if (!value) return <span className="text-[#374151] text-sm mt-1 block">—</span>;
  return (
    <div className="flex items-start gap-2 mt-1.5">
      {color && (
        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: color }} />
      )}
      <p className="text-sm leading-relaxed text-[#d1d5db] font-medium">{value}</p>
    </div>
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

// ─── Season stats ─────────────────────────────────────────────────────────────
function SeasonStats({ stats }: { stats: StatItem[] }) {
  if (!stats.length) return null;
  const featured = stats.filter(s => ['PTS', 'REB', 'AST'].includes(s.label));
  const rest      = stats.filter(s => !['PTS', 'REB', 'AST'].includes(s.label));
  return (
    <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
      <div className="px-6 pt-4 pb-3 border-b border-[#1f2937] flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-widest text-[#4ade80]">
          2025–26 Stats
        </h2>
        <span className="text-[10px] text-[#374151] uppercase tracking-wide">Per Game</span>
      </div>
      {/* Big three */}
      {featured.length > 0 && (
        <div className="grid grid-cols-3 divide-x divide-[#1f2937]">
          {featured.map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-6">
              <span className="text-4xl font-black text-[#f9fafb] leading-none">{value}</span>
              <span className="text-[11px] font-bold text-[#4ade80] uppercase tracking-widest mt-2">{label}</span>
            </div>
          ))}
        </div>
      )}
      {/* Supporting stats */}
      {rest.length > 0 && (
        <div className={`grid grid-cols-4 sm:grid-cols-${Math.min(rest.length, 7)} border-t border-[#1f2937] divide-x divide-[#1f2937]`}>
          {rest.map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center py-3">
              <span className="text-sm font-black text-[#9ca3af]">{value}</span>
              <span className="text-[9px] font-bold text-[#4b5563] uppercase tracking-wide mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── YouTube embed ─────────────────────────────────────────────────────────────
function HighlightsEmbed({ videoId, onRefresh }: { videoId: string; onRefresh: () => void }) {
  return (
    <div className="space-y-3">
      <div className="aspect-video w-full rounded-lg overflow-hidden shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1&mute=1`}
          title="Highlights"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      </div>
      <div className="flex items-center justify-end gap-3">
        <p className="text-xs text-[#374151] flex-1">Auto-matched via YouTube · may not be perfect</p>
        <button
          onClick={onRefresh}
          className="text-xs text-[#6b7280] hover:text-[#4ade80] transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try another
        </button>
      </div>
    </div>
  );
}

function HighlightsLoading() {
  return (
    <div className="aspect-video w-full rounded-lg border border-[#1f2937] bg-[#0d1117] flex flex-col items-center justify-center">
      <svg className="w-5 h-5 animate-spin text-[#4ade80] mb-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="text-xs text-[#4b5563]">Finding highlights…</span>
    </div>
  );
}

function NoHighlights({ playerName, school }: { playerName: string; school: string }) {
  const query = encodeURIComponent(`${playerName} ${school} basketball highlights 2025 2026`);
  return (
    <div className="aspect-video w-full rounded-lg border border-[#1f2937] bg-[#0d1117] flex flex-col items-center justify-center text-center p-6">
      <p className="text-sm text-[#6b7280] mb-1">No highlight reel found.</p>
      <p className="text-xs text-[#374151] mb-4">Enable YouTube Data API v3 in Google Cloud Console.</p>
      <a href={`https://www.youtube.com/results?search_query=${query}`}
        target="_blank" rel="noopener noreferrer"
        className="btn-secondary text-xs py-1.5 px-3">
        Search YouTube manually
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
        <div className="h-52 animate-shimmer rounded-xl" />
        <div className="h-32 animate-shimmer rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-3 h-64 animate-shimmer rounded-xl" />
          <div className="md:col-span-2 h-64 animate-shimmer rounded-xl" />
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
        <p className="text-[#6b7280] text-sm mb-6">This player isn&apos;t on the current Big Board.</p>
        <Link href="/big-board" className="btn-primary text-sm">← Back to Big Board</Link>
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

  const [videoId,       setVideoId]       = useState<string | null>(null);
  const [videoLoading,  setVideoLoading]  = useState(false);
  const [videoSearched, setVideoSearched] = useState(false);

  const [seasonStats,   setSeasonStats]   = useState<StatItem[]>([]);

  const [headErr,       setHeadErr]       = useState(false);
  const [schoolErr,     setSchoolErr]     = useState(false);
  const [nbaErr,        setNbaErr]        = useState(false);
  const [compHeadErr,   setCompHeadErr]   = useState(false);
  const [compTeamErr,   setCompTeamErr]   = useState(false);

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
        if (configRes?.ok) { cfg = await configRes.json(); setConfig(cfg); }

        const pinnedId = cfg?.players?.[found.name]?.youtubeVideoId;
        if (pinnedId) { setVideoId(pinnedId); setVideoSearched(true); }
        setIsLoading(false);
        if (!pinnedId) searchHighlights(found.name, found.school);
      } catch {
        setNotFound(true); setIsLoading(false);
      }
    }
    load();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const manualAthleteId = player ? config?.players?.[player.name]?.espnAthleteId : undefined;
  const { athleteId: prospectAthleteId, headshotUrl: prospectHeadshotUrl } = useESPNLookup(
    player?.name ?? null, player?.school ?? '', 'mens-college-basketball', manualAthleteId,
  );
  useEffect(() => { setHeadErr(false); }, [prospectHeadshotUrl]);

  useEffect(() => {
    if (!prospectAthleteId) return;
    fetch(`/api/player-stats?athleteId=${prospectAthleteId}`)
      .then(r => r.json())
      .then(data => { if (data.stats?.length) setSeasonStats(data.stats); })
      .catch(() => {});
  }, [prospectAthleteId]);

  const { headshotUrl: nbaCompHeadshotUrl, teamName: nbaCompTeamName } = useESPNLookup(
    player?.nbaComparison ?? null, '', 'nba',
  );
  const nbaCompTeam = nbaCompTeamName ? findNBATeam(nbaCompTeamName) : null;
  useEffect(() => { setCompHeadErr(false); setCompTeamErr(false); }, [nbaCompHeadshotUrl]);

  const searchHighlights = useCallback(async (name: string, school: string) => {
    setVideoLoading(true); setVideoSearched(false);
    try {
      const res = await fetch(`/api/highlights?${new URLSearchParams({ name, school })}`);
      if (res.ok) { const data = await res.json(); setVideoId(data.videoId ?? null); }
    } finally { setVideoLoading(false); setVideoSearched(true); }
  }, []);

  const handleRefresh = useCallback(() => {
    if (player) { setVideoId(null); setVideoSearched(false); searchHighlights(player.name, player.school); }
  }, [player, searchHighlights]);

  if (isLoading) return <LoadingSkeleton />;
  if (notFound || !player) return <NotFound />;

  const school  = findSchool(player.school);
  const nbaTeam = player.mockTeam ? findNBATeam(player.mockTeam) : null;

  const hasHeadshot = !!prospectHeadshotUrl && !headErr;
  const hasSchool   = !!school && school.espnTeamId > 0 && !schoolErr;
  const hasNbaLogo  = !!nbaTeam && !nbaErr;
  const hasCompHead = !!nbaCompHeadshotUrl && !compHeadErr;
  const hasCompTeam = !!nbaCompTeam && !compTeamErr;

  const primaryColor   = school?.primary   ?? '1a7a3f';
  const secondaryColor = school?.secondary ?? '145f30';

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* ── Back nav ──────────────────────────────────────────────────────────── */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link href="/big-board"
            className="inline-flex items-center text-sm font-medium text-[#6b7280] hover:text-[#4ade80] transition-colors">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Big Board
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-5">

        {/* ── Hero card — SCHOOL BRANDING ────────────────────────────────────── */}
        <div className="rounded-xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-[#1f2937]">

          {/* Colored banner — school owns this entirely */}
          <div className="relative h-52"
            style={{ background: `linear-gradient(135deg, #${primaryColor} 0%, #${secondaryColor}cc 60%, #${primaryColor}88 100%)` }}>

            {/* Crosshatch texture */}
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg,white 0,white 1px,transparent 0,transparent 24px),repeating-linear-gradient(90deg,white 0,white 1px,transparent 0,transparent 24px)' }} />

            {/* Bottom vignette so text pops */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

            {/* Giant watermark rank — right side */}
            <div className="absolute right-2 top-0 bottom-0 flex items-center pointer-events-none select-none"
              style={{ fontSize: '11rem', fontWeight: 900, color: 'rgba(255,255,255,0.07)', lineHeight: 1 }}>
              {player.rank}
            </div>

            {/* School logo — top left */}
            <div className="absolute top-5 left-6 w-16 h-16 bg-white/95 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden">
              {hasSchool ? (
                <Image src={schoolLogoUrl(school!.espnTeamId)} alt={player.school}
                  width={52} height={52} className="object-contain p-1.5"
                  onError={() => setSchoolErr(true)} unoptimized />
              ) : (
                <span className="text-sm font-black text-gray-700">
                  {school?.abbreviation ?? player.school.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>

            {/* Rank + position badges — top right */}
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <span className="px-3 py-1 bg-black/40 backdrop-blur-sm border border-white/20 text-white text-xs font-black rounded-full">
                #{player.rank} Overall
              </span>
              <span className="px-2.5 py-1 bg-black/40 backdrop-blur-sm border border-white/20 text-white/80 text-xs font-bold rounded-full">
                {player.position}
              </span>
            </div>

            {/* Player name + school — anchored to bottom-left */}
            <div className="absolute bottom-5 left-6 right-44">
              <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight drop-shadow-lg">
                {player.name}
              </h1>
              <p className="text-white/60 text-sm font-semibold mt-0.5 uppercase tracking-wide">
                {player.school}
              </p>
            </div>
          </div>

          {/* ── Dark body — COMPBEASTS BRANDING ─────────────────────────────── */}
          <div className="bg-[#111827] relative">

            {/* Headshot — straddles banner/body divide */}
            <div className="absolute -top-14 right-8 z-10">
              {hasHeadshot ? (
                <Image src={prospectHeadshotUrl!} alt={player.name}
                  width={120} height={120}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover shadow-2xl"
                  style={{ border: '4px solid white' }}
                  onError={() => setHeadErr(true)} unoptimized />
              ) : (
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full shadow-2xl flex items-center justify-center"
                  style={{ background: `#${primaryColor}`, border: '4px solid white' }}>
                  <span className="text-4xl font-black text-white/80">
                    {player.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
              )}
            </div>

            {/* Physical measurements */}
            <div className="px-6 pt-8 pb-6 pr-44">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Height',    value: player.height || '—' },
                  { label: 'Weight',    value: player.weight > 0 ? `${player.weight} lbs` : '—' },
                  { label: 'Wingspan',  value: player.wingspan || '—' },
                  { label: 'Draft Age', value: player.draftAge > 0 ? player.draftAge.toFixed(1) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col items-center p-3 bg-[#0d1117] rounded-lg border border-[#1f2937]">
                    <span className="text-base font-black text-[#f9fafb]">{value}</span>
                    <span className="text-[10px] font-bold text-[#4b5563] uppercase tracking-widest mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Season stats ────────────────────────────────────────────────────── */}
        <SeasonStats stats={seasonStats} />

        {/* ── Scouting (3/5) + Mock Draft (2/5) ──────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

          {/* Scouting report — wider */}
          <div className="md:col-span-3 bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#1f2937]">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#4ade80]">Scouting Report</h2>
            </div>
            <div className="px-6 py-5 space-y-5">

              <div>
                <ScoutLabel label="Biggest Skill" />
                <ScoutValue value={player.biggestSkill} color="#4ade80" />
              </div>

              <div>
                <ScoutLabel label="Biggest Weakness" />
                <ScoutValue value={player.biggestWeakness} color="#ef4444" />
              </div>

              <div className="pt-4 border-t border-[#1f2937]">
                <ScoutLabel label="NBA Comparison" />
                {player.nbaComparison ? (
                  <div className="mt-2 flex items-center gap-3 px-4 py-3 bg-[#0d1117] rounded-xl border border-[#1f2937]">
                    {hasCompHead ? (
                      <Image src={nbaCompHeadshotUrl!} alt={player.nbaComparison}
                        width={44} height={44}
                        className="w-11 h-11 rounded-full object-cover border-2 border-[#1f2937] flex-shrink-0"
                        onError={() => setCompHeadErr(true)} unoptimized />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-[#1a2332] border-2 border-[#1f2937] flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-[#6b7280]">
                          {player.nbaComparison.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-bold text-[#f9fafb] flex-1 truncate">{player.nbaComparison}</span>
                    {hasCompTeam && (
                      <Image src={nbaLogoUrl(nbaCompTeam!.espnId)} alt={nbaCompTeam!.name}
                        width={28} height={28} className="object-contain flex-shrink-0"
                        onError={() => setCompTeamErr(true)} unoptimized />
                    )}
                  </div>
                ) : (
                  <p className="text-[#374151] text-sm mt-1.5">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Mock Draft — narrower, pick number dominates */}
          <div className="md:col-span-2 bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-[#1f2937]">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#4ade80]">My Mock Draft</h2>
            </div>
            <div className="px-6 py-5">
              {player.mockPickNo && player.mockTeam ? (
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-20 h-20 bg-[#0d1117] rounded-2xl border border-[#1f2937] flex items-center justify-center overflow-hidden">
                    {hasNbaLogo ? (
                      <Image src={nbaLogoUrl(nbaTeam!.espnId)} alt={player.mockTeam}
                        width={64} height={64} className="object-contain p-2"
                        onError={() => setNbaErr(true)} unoptimized />
                    ) : (
                      <span className="text-xl font-black text-[#6b7280]">
                        {player.mockTeam.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="text-7xl font-black text-[#f9fafb] leading-none">
                      #{player.mockPickNo}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      {player.mockPickNo <= 5 && (
                        <span className="px-2.5 py-0.5 bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-black rounded-full">
                          Top 5
                        </span>
                      )}
                      {player.mockPickNo > 5 && player.mockPickNo <= 14 && (
                        <span className="px-2.5 py-0.5 bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] text-xs font-black rounded-full">
                          Lottery
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[#f9fafb] font-bold text-lg leading-tight">{player.mockTeam}</p>
                    {nbaTeam && (
                      <p className="text-xs text-[#4b5563] mt-0.5">{nbaTeam.city} {nbaTeam.name}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-[#0d1117] border border-[#1f2937] flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-[#374151]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm text-[#6b7280]">No pick assigned yet</p>
                  <p className="text-xs text-[#374151] mt-1">Fill in Mock Pick No. and Team in your sheet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Highlights ──────────────────────────────────────────────────────── */}
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-[#1f2937]">
            <h2 className="text-xs font-black uppercase tracking-widest text-[#4ade80]">Highlights</h2>
          </div>
          <div className="p-6">
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
        </div>

      </main>
    </div>
  );
}
