/**
 * PlayerCard Component
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

/** Build an ESPN headshot URL from an athleteId */
function headshotUrl(athleteId: number): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${athleteId}.png`;
}

/** Build an ESPN team logo URL from a sourceId */
function teamLogoUrl(espnTeamId: number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
}

/** Convert a hex color like "003087" to a CSS background-image gradient */
function teamGradient(primary?: string, secondary?: string): string {
  const p = primary   ? `#${primary.replace('#', '')}`   : '#1d4ed8';   // blue-700
  const s = secondary ? `#${secondary.replace('#', '')}` : '#1e3a8a';   // blue-900
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
          group relative overflow-hidden rounded-xl bg-white shadow-md
          transition-all duration-300 hover:shadow-xl hover:-translate-y-1
          border border-gray-100
          ${className}
        `}
      >
        {/* Header — team-colored gradient */}
        <div
          className="relative h-48"
          style={{ background: teamGradient(player.team_primary_color, player.team_secondary_color) }}
        >
          {/* Player headshot or initials */}
          <div className="absolute inset-0 flex items-center justify-center">
            {hasHeadshot ? (
              <Image
                src={headshotUrl(player.athlete_id!)}
                alt={name}
                width={128}
                height={128}
                className="w-32 h-32 rounded-full object-cover border-4 border-white/30"
                onError={() => setHeadErr(true)}
                unoptimized
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-6xl font-bold text-white/60">
                  {name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            )}
          </div>

          {/* Team logo */}
          <div className="absolute top-4 right-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center overflow-hidden">
            {hasLogo ? (
              <Image
                src={teamLogoUrl(player.espn_team_id!)}
                alt={team}
                width={40}
                height={40}
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

          {/* Position + Rank Badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-1.5">
            {rank !== undefined && (
              <span className="px-2.5 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full shadow">
                #{rank}
              </span>
            )}
            <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-blue-900 text-xs font-bold rounded-full">
              {position}
            </span>
          </div>
        </div>

        {/* Player Info */}
        <div className="p-6">
          {/* Name and School */}
          <h3 className="text-2xl font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
            {name}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {team} • {player.conference}
          </p>

          {/* Physical Stats — shown only when available */}
          {physical && (physical.height_inches || physical.weight_pounds) && (
            <div className="flex gap-4 mb-4 pb-4 border-b border-gray-100">
              <div>
                <p className="text-xs text-gray-500 uppercase">Height</p>
                <p className="text-lg font-semibold text-gray-900">
                  {formatHeight(physical.height_inches)}
                </p>
              </div>
              {physical.weight_pounds && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Weight</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {physical.weight_pounds} lbs
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {stats.points_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-gray-600 uppercase mt-1">PPG</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {stats.rebounds_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-gray-600 uppercase mt-1">RPG</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {stats.assists_per_game.toFixed(1)}
              </p>
              <p className="text-xs text-gray-600 uppercase mt-1">APG</p>
            </div>
          </div>

          {/* Shooting Stats */}
          <div className="mt-4 flex justify-between text-sm">
            <div>
              <span className="text-gray-500">FG:</span>{' '}
              <span className="font-semibold text-gray-900">
                {stats.field_goal_percentage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">3P:</span>{' '}
              <span className="font-semibold text-gray-900">
                {stats.three_point_percentage.toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-500">FT:</span>{' '}
              <span className="font-semibold text-gray-900">
                {stats.free_throw_percentage.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* View Details Link */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700 flex items-center">
              View Comparison
              <svg
                className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * PlayerCardSkeleton - Loading state
 */
export function PlayerCardSkeleton() {
  return (
    <div className="rounded-xl bg-white shadow-md border border-gray-100 animate-pulse">
      <div className="h-48 bg-gray-200" />
      <div className="p-6">
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="flex gap-4 mb-4">
          <div className="h-12 bg-gray-200 rounded w-20" />
          <div className="h-12 bg-gray-200 rounded w-20" />
          <div className="h-12 bg-gray-200 rounded w-20" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
          <div className="h-20 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
