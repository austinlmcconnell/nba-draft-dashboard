/**
 * ComparisonCard — shows one historical player comparison result.
 * Handles all three comparison types: statistical, physical, overall.
 */

import React from 'react';
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

export function ComparisonCard({ comparison, className = '' }: Props) {
  const { historical_player: h, comparison_type, similarity_score, breakdown } = comparison;
  const typeStyle = TYPE_LABELS[comparison_type];

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
    <div className={`relative bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-300 ${className}`}>
      {/* Type badge */}
      <div className={`absolute -top-3 left-4 px-3 py-1 rounded-full text-xs font-bold border ${typeStyle.bg} ${typeStyle.color}`}>
        {typeStyle.label} Comp
      </div>

      {/* Similarity score */}
      <div className={`absolute -top-3 right-4 px-3 py-1 rounded-full text-xs font-bold border ${similarityColor(similarity_score)}`}>
        {similarity_score.toFixed(1)}% match
      </div>

      <div className="p-6 pt-8">
        {/* Player name + meta */}
        <h3 className="text-xl font-bold text-gray-900 mb-1">{h.name}</h3>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500 mb-5">
          <span>{h.college_team}</span>
          <span>·</span>
          <span>{h.college_season}</span>
          {h.draft_pick != null && (
            <>
              <span>·</span>
              <span className="font-semibold text-blue-600">{ordinal(h.draft_pick)} pick ({h.draft_year})</span>
            </>
          )}
          {h.physical.height_inches && (
            <>
              <span>·</span>
              <span>{fmtHeight(h.physical.height_inches)}{h.physical.weight_pounds ? `, ${h.physical.weight_pounds} lbs` : ''}</span>
            </>
          )}
        </div>

        {/* College ↔ NBA stats */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">College</p>
            <div className="space-y-1 text-sm">
              <StatLine label="PPG" value={h.college_stats.points_per_game.toFixed(1)} />
              <StatLine label="RPG" value={h.college_stats.rebounds_per_game.toFixed(1)} />
              <StatLine label="APG" value={h.college_stats.assists_per_game.toFixed(1)} />
              <StatLine label="TS%" value={`${h.college_stats.true_shooting_pct.toFixed(1)}%`} />
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
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-5" />
      <div className="grid grid-cols-2 gap-4 mb-5">
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
  );
}
