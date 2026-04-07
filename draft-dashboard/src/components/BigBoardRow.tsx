'use client';

/**
 * BigBoardRow — a single row in Austin's ranked Big Board.
 * Headshot is auto-fetched via /api/espn-lookup using ESPN's search API.
 * Manual override via big-board-config.json still supported.
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BigBoardPlayer, ProspectConfig } from '@/types/bigboard';
import { findSchool, schoolLogoUrl } from '@/lib/data/school-logos';
import { findNBATeam, nbaLogoUrl } from '@/lib/data/nba-teams';

interface BigBoardRowProps {
  player: BigBoardPlayer;
  config?: ProspectConfig;
  index: number;
}

function InitialsAvatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2);
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-white/10 flex-shrink-0"
      style={{ background: `#${color}` }}
    >
      <span className="text-sm font-bold text-white/80">{initials}</span>
    </div>
  );
}

function pickTierColor(pick: number): string {
  if (pick <= 5)  return 'bg-amber-400/20 text-amber-300 border-amber-400/40';
  if (pick <= 14) return 'bg-[#1a7a3f]/30 text-[#4ade80] border-[#1a7a3f]/50';
  if (pick <= 30) return 'bg-[#1a2332] text-[#9ca3af] border-[#374151]';
  return 'bg-[#1a2332] text-[#6b7280] border-[#374151]';
}

// ─── ESPN headshot hook ───────────────────────────────────────────────────────
function useHeadshot(name: string, school: string, manualAthleteId?: number) {
  // If we have a manual ID, construct the URL directly
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(
    manualAthleteId
      ? `https://a.espncdn.com/i/headshots/mens-college-basketball/players/full/${manualAthleteId}.png`
      : null
  );

  useEffect(() => {
    if (manualAthleteId) return; // already set above
    if (!name) return;

    let cancelled = false;
    const key = `espn::${name.toLowerCase()}::${school.toLowerCase()}`;

    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!cancelled && parsed.headshotUrl) setHeadshotUrl(parsed.headshotUrl);
        return;
      }
    } catch { /* ignore */ }

    fetch(`/api/espn-lookup?name=${encodeURIComponent(name)}&school=${encodeURIComponent(school)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.headshotUrl) setHeadshotUrl(data.headshotUrl);
        try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [name, school, manualAthleteId]);

  return headshotUrl;
}

// ─── Row component ────────────────────────────────────────────────────────────
export function BigBoardRow({ player, config, index }: BigBoardRowProps) {
  const school  = findSchool(player.school);
  const nbaTeam = player.mockTeam ? findNBATeam(player.mockTeam) : null;

  const headshotUrl = useHeadshot(player.name, player.school, config?.espnAthleteId);

  const [headErr,   setHeadErr]   = useState(false);
  const [schoolErr, setSchoolErr] = useState(false);
  const [nbaErr,    setNbaErr]    = useState(false);

  useEffect(() => { setHeadErr(false); }, [headshotUrl]);

  const hasHeadshot = !!headshotUrl && !headErr;
  const hasSchool   = !!school && school.espnTeamId > 0 && !schoolErr;
  const hasNbaTeam  = !!nbaTeam && !nbaErr;
  const primaryColor = school?.primary ?? '1a7a3f';

  return (
    <Link href={`/big-board/${player.slug}`} className="group block" style={{ animationDelay: `${index * 30}ms` }}>
      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1f2937] transition-all duration-200 hover:bg-[#1a7a3f]/8 hover:border-[#1a7a3f]/30 cursor-pointer animate-fade-in-up">

        {/* Rank */}
        <div className="w-8 flex-shrink-0 text-center">
          <span className="text-lg font-black text-[#9ca3af] group-hover:text-[#4ade80] transition-colors">
            {player.rank}
          </span>
        </div>

        {/* Headshot */}
        <div className="flex-shrink-0">
          {hasHeadshot ? (
            <Image src={headshotUrl!} alt={player.name} width={48} height={48}
              className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
              onError={() => setHeadErr(true)} unoptimized />
          ) : (
            <InitialsAvatar name={player.name} color={primaryColor} />
          )}
        </div>

        {/* Name + School + Position */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#f9fafb] group-hover:text-[#4ade80] transition-colors truncate">
              {player.name}
            </span>
            <span className="px-2 py-0.5 bg-[#1a2332] rounded-full text-xs font-semibold text-[#9ca3af] flex-shrink-0">
              {player.position}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {hasSchool ? (
              <Image src={schoolLogoUrl(school!.espnTeamId)} alt={player.school} width={14} height={14}
                className="object-contain" onError={() => setSchoolErr(true)} unoptimized />
            ) : (
              <span className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                style={{ background: `#${primaryColor}` }}>
                {school?.abbreviation?.[0] ?? player.school[0]}
              </span>
            )}
            <span className="text-xs text-[#6b7280] truncate">{player.school}</span>
          </div>
        </div>

        {/* Physical */}
        <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0 w-20">
          {player.height && <span className="text-sm font-semibold text-[#d1d5db]">{player.height}</span>}
          {player.weight > 0 && <span className="text-xs text-[#6b7280]">{player.weight} lbs</span>}
        </div>

        {/* NBA Comp */}
        <div className="hidden md:block flex-shrink-0 w-36 text-right">
          {player.nbaComparison && (
            <span className="text-xs text-[#9ca3af] italic">{player.nbaComparison}</span>
          )}
        </div>

        {/* Mock Pick */}
        <div className="flex-shrink-0 w-28 flex items-center justify-end gap-2">
          {player.mockPickNo && player.mockTeam ? (
            <>
              {hasNbaTeam && (
                <Image src={nbaLogoUrl(nbaTeam!.espnId)} alt={player.mockTeam} width={22} height={22}
                  className="object-contain" onError={() => setNbaErr(true)} unoptimized />
              )}
              <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${pickTierColor(player.mockPickNo)}`}>
                #{player.mockPickNo}
              </span>
            </>
          ) : (
            <span className="text-xs text-[#374151]">—</span>
          )}
        </div>

        {/* Chevron */}
        <svg className="w-4 h-4 text-[#374151] group-hover:text-[#4ade80] group-hover:translate-x-1 transition-all flex-shrink-0"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export function BigBoardRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[#1f2937]">
      <div className="w-8 h-5 animate-shimmer rounded" />
      <div className="w-12 h-12 animate-shimmer rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="h-4 animate-shimmer rounded w-40" />
        <div className="h-3 animate-shimmer rounded w-24" />
      </div>
      <div className="hidden sm:block w-16 h-8 animate-shimmer rounded" />
      <div className="hidden md:block w-32 h-4 animate-shimmer rounded" />
      <div className="w-20 h-6 animate-shimmer rounded-full" />
    </div>
  );
}
