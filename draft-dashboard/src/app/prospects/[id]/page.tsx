'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ComparisonCard, ComparisonCardSkeleton } from '@/components/ComparisonCard';
import type { CollegePlayer, ProspectComparisons, NormParams } from '@/types/player';
import { getProspectComparisons } from '@/lib/utils/comparison';
import {
  loadHistoricalPlayers,
  getDatasetNorms,
  getProspectById,
  getSeasonAverages,
  type StatAverages,
} from '@/lib/utils/dataLoader';

export default function ProspectDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [prospect, setProspect] = useState<CollegePlayer | null>(null);
  const [comparisons, setComparisons] = useState<ProspectComparisons | null>(null);
  const [seasonAvg, setSeasonAvg] = useState<StatAverages | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, historical, norms] = await Promise.all([
          getProspectById(id),
          loadHistoricalPlayers(),
          getDatasetNorms(),
        ]);

        if (!p) { setError('Prospect not found'); setIsLoading(false); return; }
        if (!norms || historical.length === 0) { setError('Historical data unavailable'); setIsLoading(false); return; }

        // Only compare against players from PREVIOUS seasons to avoid
        // self-comparison and comparisons against current-season teammates.
        const compPool = historical.filter(h => h.college_season < p.season);
        const comps = getProspectComparisons(p.stats, p.physical ?? null, compPool, norms);
        const avg = await getSeasonAverages(p.season);
        setProspect(p);
        setComparisons(comps);
        setSeasonAvg(avg);
      } catch (e) {
        setError(String(e));
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !prospect) return <NotFound message={error ?? 'Prospect not found'} />;

  const s = prospect.stats;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Back nav */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Profile hero */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <HeroSection prospect={prospect} />

          {/* Stat strip */}
          <div className="px-8 py-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Season Stats</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {[
                { label: 'PPG',  value: s.points_per_game.toFixed(1),   norm: seasonAvg?.points_per_game,   raw: s.points_per_game },
                { label: 'RPG',  value: s.rebounds_per_game.toFixed(1), norm: seasonAvg?.rebounds_per_game, raw: s.rebounds_per_game },
                { label: 'APG',  value: s.assists_per_game.toFixed(1),  norm: seasonAvg?.assists_per_game,  raw: s.assists_per_game },
                { label: 'SPG',  value: s.steals_per_game.toFixed(1),   norm: seasonAvg?.steals_per_game,   raw: s.steals_per_game },
                { label: 'BPG',  value: s.blocks_per_game.toFixed(1),   norm: seasonAvg?.blocks_per_game,   raw: s.blocks_per_game },
                { label: 'MPG',  value: s.minutes_per_game.toFixed(1),  norm: seasonAvg?.minutes_per_game,  raw: s.minutes_per_game },
              ].map(stat => (
                <StatBox
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  norm={stat.norm}
                  raw={stat.raw}
                  primary={prospect.team_primary_color}
                  secondary={prospect.team_secondary_color}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'FG%',  value: `${s.field_goal_percentage.toFixed(1)}%`,  norm: seasonAvg?.field_goal_percentage,  raw: s.field_goal_percentage },
                { label: '3P%',  value: `${s.three_point_percentage.toFixed(1)}%`, norm: seasonAvg?.three_point_percentage, raw: s.three_point_percentage },
                { label: 'FT%',  value: `${s.free_throw_percentage.toFixed(1)}%`,  norm: seasonAvg?.free_throw_percentage,  raw: s.free_throw_percentage },
                { label: 'TS%',  value: `${s.true_shooting_pct.toFixed(1)}%`,      norm: seasonAvg?.true_shooting_pct,      raw: s.true_shooting_pct },
                { label: 'USG%', value: `${s.usage_rate.toFixed(1)}%`,             norm: seasonAvg?.usage_rate,             raw: s.usage_rate },
              ].map(stat => (
                <StatBox
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  norm={stat.norm}
                  raw={stat.raw}
                  primary={prospect.team_primary_color}
                  secondary={prospect.team_secondary_color}
                />
              ))}
            </div>
            {/* Per-36 row */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Per 36 Minutes</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                {[
                  { l: 'PTS',  v: s.pts_per36 },
                  { l: 'REB',  v: s.reb_per36 },
                  { l: 'AST',  v: s.ast_per36 },
                  { l: 'STL',  v: s.stl_per36 },
                  { l: 'BLK',  v: s.blk_per36 },
                  { l: 'TOV',  v: s.tov_per36 },
                ].map(x => (
                  <div key={x.l} className="text-center">
                    <p className="text-xs text-gray-500">{x.l}</p>
                    <p className="font-bold text-gray-800">{x.v.toFixed(1)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Three comparisons */}
        {comparisons ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Historical Comparisons</h2>
            <p className="text-gray-500 mb-6 text-sm">
              Three distinct lenses — statistical production, physical profile, and overall similarity.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <ComparisonCard comparison={comparisons.statistical} />
              {comparisons.physical
                ? <ComparisonCard comparison={comparisons.physical} />
                : <NoPhysicalCard />
              }
              <ComparisonCard comparison={comparisons.overall} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ComparisonCardSkeleton />
            <ComparisonCardSkeleton />
            <ComparisonCardSkeleton />
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HeroSection — team-branded gradient, ESPN logo + headshot
// ---------------------------------------------------------------------------
function teamGradient(primary?: string, secondary?: string): string {
  const p = primary   ? `#${primary.replace('#', '')}`   : '#1d4ed8';
  const s = secondary ? `#${secondary.replace('#', '')}` : '#1e3a8a';
  return `linear-gradient(135deg, ${p}, ${s})`;
}

function HeroSection({ prospect }: { prospect: CollegePlayer }) {
  const [headErr, setHeadErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const headshotSrc = prospect.athlete_id
    ? `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${prospect.athlete_id}.png`
    : null;
  const logoSrc = prospect.espn_team_id
    ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${prospect.espn_team_id}.png`
    : null;

  return (
    <div
      className="relative h-52 flex items-center px-8 gap-6"
      style={{ background: teamGradient(prospect.team_primary_color, prospect.team_secondary_color) }}
    >
      {/* Team logo — top right, links back to dashboard filtered by this school */}
      {logoSrc && !logoErr && (
        <Link
          href={`/?school=${encodeURIComponent(prospect.team)}`}
          className="absolute top-4 right-4 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center overflow-hidden p-1 hover:scale-105 transition-transform"
          title={`View all ${prospect.team} prospects`}
        >
          <Image
            src={logoSrc}
            alt={prospect.team}
            width={48}
            height={48}
            className="object-contain"
            onError={() => setLogoErr(true)}
            unoptimized
          />
        </Link>
      )}

      {/* Headshot or initials */}
      <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {headshotSrc && !headErr ? (
          <Image
            src={headshotSrc}
            alt={prospect.name}
            width={112}
            height={112}
            className="w-full h-full object-cover"
            onError={() => setHeadErr(true)}
            unoptimized
          />
        ) : (
          <span className="text-5xl font-bold text-white/70">
            {prospect.name.split(' ').map(n => n[0]).join('')}
          </span>
        )}
      </div>

      {/* Name / team / badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 bg-white/90 text-blue-900 text-xs font-bold rounded-full">{prospect.position}</span>
          <span className="px-2 py-0.5 bg-white/90 text-blue-900 text-xs font-bold rounded-full">{prospect.conference}</span>
        </div>
        <h1 className="text-4xl font-bold text-white truncate">{prospect.name}</h1>
        <p className="text-blue-200 mt-1">{prospect.team}</p>
        <PhysicalBadges physical={prospect.physical} />
      </div>
    </div>
  );
}

function formatHeight(inches: number | null | undefined): string {
  if (!inches) return '';
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

function PhysicalBadges({ physical }: { physical: CollegePlayer['physical'] }) {
  if (!physical) return null;
  const { height_inches, weight_pounds, wingspan_inches, age_at_season_start } = physical;
  if (!height_inches && !weight_pounds && !wingspan_inches && !age_at_season_start) return null;

  const items = [
    height_inches   ? formatHeight(height_inches)           : null,
    weight_pounds   ? `${weight_pounds} lbs`                : null,
    wingspan_inches ? `${formatHeight(wingspan_inches)} ws`  : null,
    age_at_season_start ? `Age ${age_at_season_start}`       : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map(item => (
        <span key={item} className="px-2 py-0.5 bg-white/15 text-white text-xs rounded-full border border-white/20">
          {item}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Parse a hex color string → [r, g, b], returns null on failure. */
function parseHex(hex: string | undefined): [number, number, number] | null {
  if (!hex) return null;
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return [r, g, b];
}

/**
 * Convert z-score to a 0–1 intensity:
 *   z ≤ -2 → ~0.10 (very muted)  z = 0 → 0.50 (midpoint)  z ≥ +2 → ~0.90 (vivid)
 */
function zToIntensity(z: number): number {
  return 0.50 + 0.40 * Math.tanh(z * 0.65);
}

function statBoxStyle(
  primary: string | undefined,
  secondary: string | undefined,
  intensity: number,  // 0–1
): React.CSSProperties {
  const p = parseHex(primary)  ?? [29,  78, 216];   // blue-700 fallback
  const s = parseHex(secondary) ?? [30,  58, 138];   // blue-900 fallback

  // Lerp: low intensity → secondary colour, high → primary colour
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * intensity);
  const [r, g, b] = [lerp(s[0], p[0]), lerp(s[1], p[1]), lerp(s[2], p[2])];

  // Darken slightly for the gradient end
  const dim = (v: number) => Math.max(0, v - 22);
  return {
    background: `linear-gradient(135deg, rgb(${r},${g},${b}) 0%, rgb(${dim(r)},${dim(g)},${dim(b)}) 100%)`,
  };
}

function StatBox({
  label, value, norm, raw, primary, secondary,
}: {
  label: string;
  value: string;
  norm?: NormParams;
  raw: number;
  primary?: string;
  secondary?: string;
}) {
  const z = norm && norm.std_dev > 0 ? (raw - norm.mean) / norm.std_dev : 0;
  const intensity = norm ? zToIntensity(z) : 0.5;
  const style = statBoxStyle(primary, secondary, intensity);

  // Small indicator dot: top 25% = bright ring, bottom 25% = dim
  const ringClass = z > 0.67 ? 'ring-2 ring-white/40' : z < -0.67 ? 'ring-1 ring-white/10' : '';

  return (
    <div
      className={`rounded-lg p-3 text-center shadow-sm ${ringClass}`}
      style={style}
      title={norm ? `League avg: ${norm.mean.toFixed(1)} · z-score: ${z.toFixed(2)}` : undefined}
    >
      <p className="text-white/75 text-xs uppercase tracking-wide">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
    </div>
  );
}

function NoPhysicalCard() {
  return (
    <div className="bg-white rounded-xl shadow-md border border-dashed border-purple-200 flex flex-col items-center justify-center p-8 text-center min-h-64">
      <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-purple-700 mb-1">Physical Comp</p>
      <p className="text-xs text-gray-400 leading-relaxed">
        Physical measurements (height, weight, wingspan) are not yet available for this prospect.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-52 bg-white rounded-xl shadow animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          <div className="h-96 bg-white rounded-xl shadow animate-pulse" />
          <div className="h-96 bg-white rounded-xl shadow animate-pulse" />
          <div className="h-96 bg-white rounded-xl shadow animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Not Found</h1>
        <p className="text-gray-500 mb-6">{message}</p>
        <Link href="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
