/**
 * PlayerCard Component — CompBeasts dark theme
 * Displays a prospect's basic info and stats in a card format
 */

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { CollegePlayer } from '@/types/player';

interface PlayerCardProps {
  player: CollegePlayer;
  rank?: number;
  className?: string;
}

function headshotUrl(athleteId: number): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${athleteId}.png`;
}

function teamLogoUrl(espnTeamId: number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
}

function teamGradient(primary?: string, secondary?: string): string {
  const p = primary   ? `#${primary.replace('#', '')}`   : '#1a7a3f';
  const s = secondary ? `#${secondary.replace('#', '')}` : '#145f30';
  return `linear-gradient(135deg, ${p}, ${s})`;
}

const formatHeight = (inches: number | null | undefined): string => {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
};

export function PlayerCard({ player, rank, className = '' }: PlayerCardProps) {
  const { name, team, position, stats, physical } = player;
  const [headErr, setHeadErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const hasHeadshot = !!player.athlete_id && !headErr;
  const hasLogo     = !!player.espn_team_id && !logoErr;

  return (
    <Link href={`/prospects/${player.id}`}>
      <div
        className={`
          group relative overflow-hidden rounded-xl
          bg-[#111827] border border-[#1f2937]
          transition-all duration-300
          hover:border-[#1a7a3f]/50 hover:-translate-y-1
          hover:shadow-[0_16px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(26,122,63,0.25)]
          ${className}
        `}
      >
        {/* Header — team-colored gradient */}
        <div
          className="relative h-48"
          style={{ background: teamGradient(player.team_primary_color, player.team_secondary_color) }}
        >
          {/* Darkening overlay for readability */}
          <div className="absolute inset-0 bg-black/20" />

          {/* Player headshot or initials */}
          <div className="absolute inset-0 flex items-center justify-center">
            {hasHeadshot ? (
              <Image
                src={headshotUrl(player.athlete_id!)}
                alt={name}
                width={128}
                height={128}
                className="w-32 h-32 rounded-full object-cover border-4 border-white/20 relative z-10"
                onError={() => setHeadErr(true)}
                unoptimized
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center relative z-10 border-4 border-white/10">
                <span className="text-5xl font-bold text-white/60">
                  {name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            )}
          </div>

          {/* Team logo */}
          <div className="absolute top-4 right-4 w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center overflow-hidden z-10">
            {hasLogo ? (
              <Image
                src={teamLogoUrl(player.espn_team_id!)}
                alt={team}
                width={36}
                height={36}
                className="object-contain p-1"
                onError={() => setLogoErr(true)}
                unoptimized
              />
            ) : (
              <span className="text-xs font-bold text-gray-700">
                {team.substring(0, 3).toUpperCase()}
              </span>
            )}
          </div>

          {/* Rank + Position Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
            {rank !== undefined && (
              <span className="px-2.5 py-0.5 bg-[#1a7a3f] text-white text-xs font-black rounded-full shadow border border-[#4ade80]/20">
                #{rank}
              </span>
            )}
            <span className="px-2.5 py-1 bg-black/40 backdrop-blur-sm text-white text-xs font-bold rounded-full border border-white/10">
              {position}
            </span>
          </div>
        </div>

        {/* Player Info */}
        <div className="p-5">
          {/* Name and School */}
          <h3 className="text-xl font-bold text-[#f9fafb] mb-0.5 group-hover:text-[#4ade80] transition-colors leading-tight">
            {name}
          </h3>
          <p className="text-sm text-[#6b7280] mb-4">
            {team} · {player.conference}
          </p>

          {/* Physical Stats — shown only when available */}
          {physical && (physical.height_inches || physical.weight_pounds) && (
            <div className="flex gap-5 mb-4 pb-4 border-b border-[#1f2937]">
              <div>
                <p className="text-xs text-[#6b7280] uppercase tracking-wide">Height</p>
                <p className="text-base font-bold text-[#d1d5db]">
                  {formatHeight(physical.height_inches)}
                </p>
              </div>
              {physical.weight_pounds && (
                <div>
                  <p className="text-xs text-[#6b7280] uppercase tracking-wide">Weight</p>
                  <p className="text-base font-bold text-[#d1d5db]">
                    {physical.weight_pounds} lbs
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-[#1a2332] rounded-lg">
              <p className="text-xl font-black text-[#4ade80]">
                {stats.points_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-[#6b7280] uppercase mt-0.5">PPG</p>
            </div>
            <div className="text-center p-3 bg-[#1a2332] rounded-lg">
              <p className="text-xl font-black text-[#22a052]">
                {stats.rebounds_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-[#6b7280] uppercase mt-0.5">RPG</p>
            </div>
            <div className="text-center p-3 bg-[#1a2332] rounded-lg">
              <p className="text-xl font-black text-[#d1d5db]">
                {stats.assists_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-[#6b7280] uppercase mt-0.5">APG</p>
            </div>
          </div>

          {/* Shooting Stats */}
          <div className="mt-3 flex justify-between text-sm">
            <div>
              <span className="text-[#6b7280]">FG </span>
              <span className="font-semibold text-[#d1d5db]">
                {stats.field_goal_percentage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[#6b7280]">3P </span>
              <span className="font-semibold text-[#d1d5db]">
                {stats.three_point_percentage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-[#6b7280]">FT </span>
              <span className="font-semibold text-[#d1d5db]">
                {stats.free_throw_percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* View Details */}
          <div className="mt-4 pt-3 border-t border-[#1f2937]">
            <span className="text-sm font-semibold text-[#1a7a3f] group-hover:text-[#4ade80] flex items-center transition-colors">
              View Comparisons
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="rounded-xl bg-[#111827] border border-[#1f2937] overflow-hidden">
      <div className="h-48 animate-shimmer" />
      <div className="p-5 space-y-3">
        <div className="h-6 animate-shimmer rounded w-3/4" />
        <div className="h-4 animate-shimmer rounded w-1/2" />
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="h-16 animate-shimmer rounded-lg" />
          <div className="h-16 animate-shimmer rounded-lg" />
          <div className="h-16 animate-shimmer rounded-lg" />
        </div>
        <div className="flex justify-between pt-2">
          <div className="h-4 animate-shimmer rounded w-16" />
          <div className="h-4 animate-shimmer rounded w-16" />
          <div className="h-4 animate-shimmer rounded w-16" />
        </div>
      </div>
    </div>
  );
}
