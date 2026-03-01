/**
 * ComparisonCard — shows one historical player comparison result.
 * Handles all three comparison types: statistical, physical, overall.
 *
 * Displays a school-colored gradient header with the team logo and player
 * headshot (via ESPN CDN), plus age in the player metadata row.
 */
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import type { PlayerComparison } from '@/types/player';

interface Props {
  comparison: PlayerComparison;
  className?: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  statistical: { label: 'Statistical',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  physical:    { label: 'Physical',     color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  overall:     { label: 'Overall',      color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
};

function similarityColor(score: number) {
  if (score >= 75) return 'text-green-700 bg-green-50 border-green-300';
  if (score >= 60) return 'text-blue-700 bg-blue-50 border-blue-300';
  if (score >= 45) return 'text-yellow-700 bg-yellow-50 border-yellow-300';
  return 'text-gray-600 bg-gray-50 border-gray-300';
}

function barColor(score: number) {
  if (score >= 75) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 45) return 'bg-yellow-400';
  return 'bg-gray-400';
}

function fmtHeight(inches: number | null): string {
  if (!inches) return '—';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function ordinal(n: number): string {
  const j = n % 10, k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

function cardGradient(primary?: string, secondary?: string): string {
  const p = primary   ? `#${primary.replace('#', '')}` : '#1e293b';
  const s = secondary ? `#${secondary.replace('#', '')}` : '#0f172a';
  return `linear-gradient(135deg, ${p} 0%, ${s} 100%)`;
}

// Static school-colors lookup for programs not yet in the live data.
// Keyed by college_team name as it appears in nba_career_stats.json.
const TEAM_COLORS: Record<string, { primary: string; secondary: string; espnTeamId: number }> = {
  'Air Force':        { primary: '004a7b', secondary: '004a7b', espnTeamId: 2005 },
  'Arizona':          { primary: 'AB0520', secondary: '003366', espnTeamId: 12 },
  'Arizona State':    { primary: '8C1D40', secondary: 'FFC627', espnTeamId: 9 },
  'Arkansas':         { primary: '9D2235', secondary: '9D2235', espnTeamId: 8 },
  'Auburn':           { primary: '0C2340', secondary: 'E87722', espnTeamId: 2 },
  'Baylor':           { primary: '003015', secondary: 'FFCC00', espnTeamId: 239 },
  'BYU':              { primary: '002E5D', secondary: '98002E', espnTeamId: 252 },
  'Butler':           { primary: '13294B', secondary: 'C8C372', espnTeamId: 2050 },
  'Cincinnati':       { primary: 'E00122', secondary: '000000', espnTeamId: 2132 },
  'Clemson':          { primary: 'F66733', secondary: '522D80', espnTeamId: 228 },
  'Colorado':         { primary: 'CFB87C', secondary: '000000', espnTeamId: 38 },
  'Colorado State':   { primary: '1E4D2B', secondary: 'C8C372', espnTeamId: 36 },
  'Connecticut':      { primary: '000E2F', secondary: 'E4002B', espnTeamId: 41 },
  'Creighton':        { primary: '005CA9', secondary: '005CA9', espnTeamId: 156 },
  'Dayton':           { primary: 'CF0A2C', secondary: '004B8D', espnTeamId: 2168 },
  'Duke':             { primary: '001A57', secondary: '001A57', espnTeamId: 150 },
  'Florida':          { primary: '0021A5', secondary: 'FA4616', espnTeamId: 57 },
  'Florida State':    { primary: '782F40', secondary: 'CEB888', espnTeamId: 52 },
  'Fresno State':     { primary: 'CC0000', secondary: '003399', espnTeamId: 278 },
  'Georgetown':       { primary: '041E42', secondary: '7A7A7A', espnTeamId: 46 },
  'Georgia':          { primary: 'BA0C2F', secondary: '000000', espnTeamId: 61 },
  'Georgia Tech':     { primary: 'B3A369', secondary: '003057', espnTeamId: 59 },
  'Gonzaga':          { primary: '002967', secondary: 'CC0033', espnTeamId: 2250 },
  'Houston':          { primary: 'C8102E', secondary: '63666A', espnTeamId: 248 },
  'Illinois':         { primary: 'E84A27', secondary: '13294B', espnTeamId: 356 },
  'Indiana':          { primary: '990000', secondary: '990000', espnTeamId: 84 },
  'Iowa':             { primary: 'FFCD00', secondary: '000000', espnTeamId: 2294 },
  'Iowa State':       { primary: '9E1B32', secondary: 'F1BE48', espnTeamId: 66 },
  'Kansas':           { primary: '0051A5', secondary: 'E8000D', espnTeamId: 2305 },
  'Kansas State':     { primary: '512888', secondary: '512888', espnTeamId: 2306 },
  'Kentucky':         { primary: '0033A0', secondary: '0033A0', espnTeamId: 96 },
  'Long Beach State': { primary: '000000', secondary: 'FFC72C', espnTeamId: 2400 },
  'LSU':              { primary: '461D7C', secondary: 'FDD023', espnTeamId: 99 },
  'Louisville':       { primary: 'AD0000', secondary: '000000', espnTeamId: 97 },
  'Marquette':        { primary: '003366', secondary: 'FFCC00', espnTeamId: 269 },
  'Maryland':         { primary: 'E03A3E', secondary: '000000', espnTeamId: 120 },
  'Memphis':          { primary: '003087', secondary: '898C8F', espnTeamId: 235 },
  'Miami':            { primary: 'F47321', secondary: '005030', espnTeamId: 2390 },
  'Michigan':         { primary: '00274C', secondary: 'FFCB05', espnTeamId: 130 },
  'Michigan State':   { primary: '18453B', secondary: '18453B', espnTeamId: 127 },
  'Minnesota':        { primary: '7A0019', secondary: 'FFD700', espnTeamId: 135 },
  'Mississippi State':{ primary: '5D1725', secondary: '5D1725', espnTeamId: 344 },
  'Missouri':         { primary: 'F1B300', secondary: '000000', espnTeamId: 142 },
  'Nevada':           { primary: '003366', secondary: '8E9090', espnTeamId: 2440 },
  'New Mexico':       { primary: 'BA0C2F', secondary: '63666A', espnTeamId: 167 },
  'North Carolina':   { primary: '4B9CD3', secondary: '13294B', espnTeamId: 153 },
  'Notre Dame':       { primary: '0C2340', secondary: 'C99700', espnTeamId: 87 },
  'Ohio State':       { primary: 'BB0000', secondary: '666666', espnTeamId: 194 },
  'Oklahoma':         { primary: '841617', secondary: '841617', espnTeamId: 201 },
  'Oklahoma State':   { primary: 'FF6600', secondary: '000000', espnTeamId: 197 },
  'Ole Miss':         { primary: '14213D', secondary: 'CE1126', espnTeamId: 145 },
  'Oregon':           { primary: '154733', secondary: 'FEE123', espnTeamId: 2483 },
  'Oregon State':     { primary: 'D73F09', secondary: '000000', espnTeamId: 204 },
  'Penn State':       { primary: '003087', secondary: '009CDE', espnTeamId: 213 },
  'Pittsburgh':       { primary: '003594', secondary: 'FFB81C', espnTeamId: 221 },
  'Portland':         { primary: '6D1A3A', secondary: '808080', espnTeamId: 2501 },
  'Providence':       { primary: '000000', secondary: '77B5D9', espnTeamId: 2507 },
  'Purdue':           { primary: '9D4918', secondary: 'B1B3B3', espnTeamId: 2509 },
  'San Diego State':  { primary: 'A6192E', secondary: '000000', espnTeamId: 21 },
  'South Carolina':   { primary: '73000A', secondary: '000000', espnTeamId: 2579 },
  'Stanford':         { primary: '8C1515', secondary: '8C1515', espnTeamId: 24 },
  "St. John's":       { primary: 'C60C30', secondary: '000000', espnTeamId: 2599 },
  'Syracuse':         { primary: 'F76900', secondary: '002954', espnTeamId: 183 },
  'Temple':           { primary: '9D2235', secondary: '9D2235', espnTeamId: 218 },
  'Tennessee':        { primary: 'FF8200', secondary: 'FF8200', espnTeamId: 2633 },
  'Texas':            { primary: 'BF5700', secondary: 'BF5700', espnTeamId: 251 },
  'Texas A&M':        { primary: '500000', secondary: '500000', espnTeamId: 245 },
  'Texas Tech':       { primary: 'CC0000', secondary: '000000', espnTeamId: 2641 },
  'UCLA':             { primary: '2D68C4', secondary: 'F2A900', espnTeamId: 26 },
  'UNLV':             { primary: 'CC0000', secondary: '888B8D', espnTeamId: 2439 },
  'USC':              { primary: '990000', secondary: 'FFC72C', espnTeamId: 30 },
  'Utah':             { primary: 'CC0000', secondary: '000000', espnTeamId: 254 },
  'Utah State':       { primary: '00263A', secondary: '8B8D8F', espnTeamId: 328 },
  'Villanova':        { primary: '003366', secondary: '13B5EA', espnTeamId: 222 },
  'Virginia':         { primary: '232D4B', secondary: 'E57200', espnTeamId: 258 },
  'Virginia Tech':    { primary: '630031', secondary: 'CF4420', espnTeamId: 259 },
  'Wake Forest':      { primary: '9E7E38', secondary: '000000', espnTeamId: 154 },
  'Washington':       { primary: '4B2E83', secondary: '4B2E83', espnTeamId: 264 },
  'West Virginia':    { primary: '002855', secondary: 'EAAA00', espnTeamId: 277 },
  'Wisconsin':        { primary: 'C5050C', secondary: 'C5050C', espnTeamId: 275 },
  'Xavier':           { primary: '003591', secondary: '9EA1A2', espnTeamId: 2752 },
};

export function ComparisonCard({ comparison, className = '' }: Props) {
  const [headErr, setHeadErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const { historical_player: h, comparison_type, similarity_score, breakdown } = comparison;
  const typeStyle = TYPE_LABELS[comparison_type];

  // Use live data first, fall back to static lookup, then neutral slate
  const teamFallback   = TEAM_COLORS[h.college_team];
  const primaryColor   = h.team_primary_color   ?? teamFallback?.primary;
  const secondaryColor = h.team_secondary_color  ?? teamFallback?.secondary;
  const teamId         = h.espn_team_id          ?? teamFallback?.espnTeamId;

  const headshotSrc = h.athlete_id
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${h.athlete_id}.png`
    : null;
  const logoSrc = teamId
    ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${teamId}.png`
    : null;

  const facets = [
    { label: 'Scoring Eff.',  score: breakdown.scoring_efficiency },
    { label: 'Scoring Vol.',  score: breakdown.scoring_volume },
    { label: 'Playmaking',    score: breakdown.playmaking },
    { label: 'Rebounding',    score: breakdown.rebounding },
    { label: 'Defense',       score: breakdown.defense },
    ...(comparison_type !== 'statistical' && breakdown.physical > 0
      ? [{ label: 'Physical', score: breakdown.physical }]
      : []),
  ];

  return (
    <div className={`relative bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300 overflow-hidden ${className}`}>

      {/* School-colored gradient header */}
      <div
        className="relative h-20 px-4 pt-3"
        style={{ background: cardGradient(primaryColor, secondaryColor) }}
      >
        {/* Type + similarity badges */}
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${typeStyle.bg} ${typeStyle.color}`}>
            {typeStyle.label} Comp
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${similarityColor(similarity_score)}`}>
            {similarity_score.toFixed(1)}% match
          </span>
        </div>

        {/* Team logo — top right */}
        {logoSrc && !logoErr && (
          <div className="absolute top-2 right-3 w-10 h-10 bg-white/90 rounded-full shadow-md flex items-center justify-center p-1.5">
            <Image
              src={logoSrc}
              alt={h.college_team}
              width={28}
              height={28}
              className="object-contain w-full h-full"
              onError={() => setLogoErr(true)}
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Player headshot overlapping header / body */}
      <div className="px-4 -mt-7 mb-1">
        <div className="w-14 h-14 rounded-full bg-gray-100 border-4 border-white shadow-md flex items-center justify-center overflow-hidden">
          {headshotSrc && !headErr ? (
            <Image
              src={headshotSrc}
              alt={h.name}
              width={56}
              height={56}
              className="w-full h-full object-cover"
              onError={() => setHeadErr(true)}
              unoptimized
            />
          ) : (
            <span className="text-lg font-bold text-gray-400">
              {h.name.split(' ').map((n: string) => n[0]).join('')}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-5">
        {/* Player name + meta */}
        <h3 className="text-xl font-bold text-gray-900 mb-1">{h.name}</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 mb-4">
          <span>{h.college_team}</span>
          <span>·</span>
          <span>{h.college_season}</span>
          <span>·</span>
          {h.draft_pick != null
            ? <span className="font-semibold text-blue-600">{ordinal(h.draft_pick)} pick ({h.draft_year})</span>
            : <span className="font-semibold text-gray-400 italic">Undrafted</span>
          }
          {h.physical.height_inches && (
            <>
              <span>·</span>
              <span>{fmtHeight(h.physical.height_inches)}{h.physical.weight_pounds ? `, ${h.physical.weight_pounds} lbs` : ''}</span>
            </>
          )}
          {h.physical.age_at_season_start && (
            <>
              <span>·</span>
              <span>Age {h.physical.age_at_season_start}</span>
            </>
          )}
        </div>

        {/* College ↔ NBA stats */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">College</p>
            <div className="space-y-1 text-sm">
              <StatLine label="PPG" value={h.college_stats.points_per_game.toFixed(1)} />
              <StatLine label="RPG" value={h.college_stats.rebounds_per_game.toFixed(1)} />
              <StatLine label="APG" value={h.college_stats.assists_per_game.toFixed(1)} />
              <StatLine label="TS%"  value={`${h.college_stats.true_shooting_pct.toFixed(1)}%`} />
              <StatLine label="USG" value={`${h.college_stats.usage_rate.toFixed(1)}%`} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">NBA Career</p>
            <div className="space-y-1 text-sm">
              <StatLine label="PPG"     value={h.nba_career.career_ppg.toFixed(1)} bold />
              <StatLine label="RPG"     value={h.nba_career.career_rpg.toFixed(1)} bold />
              <StatLine label="APG"     value={h.nba_career.career_apg.toFixed(1)} bold />
              <StatLine label="Seasons" value={String(h.nba_career.seasons_played)} bold />
              <StatLine label="Active"  value={h.nba_career.is_active ? 'Yes' : 'No'} bold />
            </div>
          </div>
        </div>

        {/* Similarity breakdown bars */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Similarity breakdown</p>
          <div className="space-y-2">
            {facets.map(f => (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{f.label}</span>
                  <span className="font-semibold text-gray-800">{f.score}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-500 ${barColor(f.score)}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatLine({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}>{value}</span>
    </div>
  );
}

export function ComparisonCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-pulse">
      <div className="h-20 bg-gray-200" />
      <div className="px-4 -mt-7 mb-1">
        <div className="w-14 h-14 rounded-full bg-gray-300 border-4 border-white" />
      </div>
      <div className="px-4 pb-5">
        <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-200 rounded" />)}
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <div key={i} className="h-4 bg-gray-200 rounded" />)}
          </div>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-3 bg-gray-200 rounded" />)}
        </div>
      </div>
    </div>
  );
}
