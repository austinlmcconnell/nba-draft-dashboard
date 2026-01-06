/**
 * ComparisonCard Component
 * Displays a historical player comparison with their NBA career stats
 */

import React from 'react';
import type { PlayerComparison } from '@/types/player';

interface ComparisonCardProps {
  comparison: PlayerComparison;
  rank?: number;
  showBreakdown?: boolean;
  className?: string;
}

export function ComparisonCard({
  comparison,
  rank,
  showBreakdown = true,
  className = '',
}: ComparisonCardProps) {
  const { historical_player, similarity_score, stat_breakdown } = comparison;
  const { name, college_profile, nba_career, draft_year, draft_pick } = historical_player;

  // Format height
  const formatHeight = (inches: number): string => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  // Get similarity color
  const getSimilarityColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 70) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  // Get category color
  const getCategoryColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div
      className={`
        relative bg-white rounded-xl shadow-md border border-gray-200
        hover:shadow-lg transition-shadow duration-300
        ${className}
      `}
    >
      {/* Rank Badge */}
      {rank && (
        <div className="absolute -top-3 -left-3 w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-lg">#{rank}</span>
        </div>
      )}

      {/* Similarity Score Badge */}
      <div className="absolute -top-3 -right-3">
        <div className={`px-4 py-2 rounded-full font-bold shadow-lg ${getSimilarityColor(similarity_score)}`}>
          {similarity_score.toFixed(1)}% Match
        </div>
      </div>

      <div className="p-6 pt-8">
        {/* Player Name and Info */}
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">{name}</h3>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{college_profile.team}</span>
            <span>•</span>
            <span>{college_profile.season}</span>
            {draft_pick && (
              <>
                <span>•</span>
                <span className="font-medium text-blue-600">
                  {draft_pick === 1 ? '1st' : `${draft_pick}${getOrdinalSuffix(draft_pick)}`} Pick
                </span>
              </>
            )}
          </div>
        </div>

        {/* College vs NBA Stats Comparison */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* College Stats */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              College Stats
            </h4>
            <div className="space-y-2">
              <StatRow
                label="PPG"
                value={college_profile.stats.points_per_game.toFixed(1)}
                color="blue"
              />
              <StatRow
                label="RPG"
                value={college_profile.stats.rebounds_per_game.toFixed(1)}
                color="green"
              />
              <StatRow
                label="APG"
                value={college_profile.stats.assists_per_game.toFixed(1)}
                color="purple"
              />
              <StatRow
                label="FG%"
                value={`${college_profile.stats.field_goal_percentage.toFixed(1)}%`}
                color="gray"
              />
            </div>
          </div>

          {/* NBA Career Stats */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              NBA Career
            </h4>
            <div className="space-y-2">
              <StatRow
                label="PPG"
                value={nba_career.career_ppg.toFixed(1)}
                color="blue"
                bold
              />
              <StatRow
                label="RPG"
                value={nba_career.career_rpg.toFixed(1)}
                color="green"
                bold
              />
              <StatRow
                label="APG"
                value={nba_career.career_apg.toFixed(1)}
                color="purple"
                bold
              />
              <StatRow
                label="Seasons"
                value={nba_career.seasons_played.toString()}
                color="gray"
                bold
              />
            </div>
          </div>
        </div>

        {/* NBA Accolades */}
        {(nba_career.all_star_selections > 0 || nba_career.championships > 0) && (
          <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-4 text-sm">
              {nba_career.all_star_selections > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-2xl">⭐</span>
                  <span className="font-semibold text-gray-900">
                    {nba_career.all_star_selections}x All-Star
                  </span>
                </div>
              )}
              {nba_career.championships > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-2xl">🏆</span>
                  <span className="font-semibold text-gray-900">
                    {nba_career.championships}x Champion
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {showBreakdown && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">
              Similarity Breakdown
            </h4>
            <div className="space-y-2">
              <CategoryBar
                label="Scoring"
                score={stat_breakdown.scoring_similarity}
              />
              <CategoryBar
                label="Rebounding"
                score={stat_breakdown.rebounding_similarity}
              />
              <CategoryBar
                label="Playmaking"
                score={stat_breakdown.playmaking_similarity}
              />
              <CategoryBar
                label="Defense"
                score={stat_breakdown.defense_similarity}
              />
              <CategoryBar
                label="Physical"
                score={stat_breakdown.physical_similarity}
              />
            </div>
          </div>
        )}

        {/* Current Team (if active) */}
        {nba_career.is_active && nba_career.current_team && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Currently plays for{' '}
              <span className="font-semibold text-gray-900">
                {nba_career.current_team}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * StatRow - Helper component for displaying stat lines
 */
function StatRow({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: string;
  bold?: boolean;
}) {
  const colorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
    gray: 'text-gray-600',
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span
        className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${
          colorClasses[color as keyof typeof colorClasses]
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * CategoryBar - Progress bar for category similarity
 */
function CategoryBar({ label, score }: { label: string; score: number }) {
  const getColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs font-semibold text-gray-900">{score}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${getColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Helper function for ordinal suffixes
 */
function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

/**
 * ComparisonCardSkeleton - Loading state
 */
export function ComparisonCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-2/3 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-1/2 mb-6" />
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}
