/**
 * StatTable Component
 * Displays comprehensive player statistics in a table format
 */

import React from 'react';
import type { CollegePlayer } from '@/types/player';

interface StatTableProps {
  player: CollegePlayer;
  className?: string;
}

export function StatTable({ player, className = '' }: StatTableProps) {
  const { stats } = player;

  const statCategories = [
    {
      title: 'Scoring',
      stats: [
        { label: 'Points Per Game',  value: stats.points_per_game.toFixed(1) },
        { label: 'Pts / 36 min',     value: stats.pts_per36.toFixed(1) },
        { label: 'Field Goal %',     value: `${stats.field_goal_percentage.toFixed(1)}%` },
        { label: '3-Point %',        value: `${stats.three_point_percentage.toFixed(1)}%` },
        { label: 'Free Throw %',     value: `${stats.free_throw_percentage.toFixed(1)}%` },
        { label: 'True Shooting %',  value: `${stats.true_shooting_pct.toFixed(1)}%` },
        { label: 'Effective FG %',   value: `${stats.effective_fg_pct.toFixed(1)}%` },
        { label: 'FT Rate',          value: stats.free_throw_rate.toFixed(1) },
      ],
    },
    {
      title: 'Playmaking',
      stats: [
        { label: 'Assists Per Game',  value: stats.assists_per_game.toFixed(1) },
        { label: 'Ast / 36 min',      value: stats.ast_per36.toFixed(1) },
        { label: 'Turnovers Per Game',value: stats.turnovers_per_game.toFixed(1) },
        { label: 'AST/TOV Ratio',     value: stats.ast_tov_ratio.toFixed(2) },
        { label: 'Usage Rate',        value: `${stats.usage_rate.toFixed(1)}%` },
      ],
    },
    {
      title: 'Rebounding',
      stats: [
        { label: 'Rebounds Per Game', value: stats.rebounds_per_game.toFixed(1) },
        { label: 'Reb / 36 min',      value: stats.reb_per36.toFixed(1) },
        { label: 'Off. Reb %',        value: `${stats.oreb_pct.toFixed(1)}%` },
      ],
    },
    {
      title: 'Defense',
      stats: [
        { label: 'Steals Per Game',   value: stats.steals_per_game.toFixed(1) },
        { label: 'Stl / 36 min',      value: stats.stl_per36.toFixed(1) },
        { label: 'Blocks Per Game',   value: stats.blocks_per_game.toFixed(1) },
        { label: 'Blk / 36 min',      value: stats.blk_per36.toFixed(1) },
      ],
    },
    {
      title: 'Advanced Metrics',
      stats: [
        { label: 'Win Shares / 40',   value: stats.win_shares_per40.toFixed(3) },
        { label: 'Net Rating',        value: stats.net_rating.toFixed(1) },
        { label: 'Off. Rating',       value: stats.offensive_rating.toFixed(1) },
        { label: 'Def. Rating',       value: stats.defensive_rating.toFixed(1) },
        { label: 'PORPAG',            value: stats.porpag.toFixed(2) },
      ],
    },
    {
      title: 'Playing Time',
      stats: [
        { label: 'Minutes Per Game',  value: stats.minutes_per_game.toFixed(1) },
        { label: 'Games Played',      value: stats.games.toString() },
      ],
    },
  ];

  return (
    <div className={`overflow-x-auto ${className}`}>
      <div className="space-y-6">
        {statCategories.map((category) => (
          <div key={category.title}>
            <h3 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b-2 border-gray-200">
              {category.title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {category.stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    {stat.label}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ComparisonTable - Compare two players side by side
 */
interface ComparisonTableProps {
  prospect: CollegePlayer;
  historical: CollegePlayer;
  className?: string;
}

export function ComparisonTable({
  prospect,
  historical,
  className = '',
}: ComparisonTableProps) {
  const compareStats = [
    {
      category: 'Scoring',
      stats: [
        {
          label: 'PPG',
          prospect: prospect.stats.points_per_game.toFixed(1),
          historical: historical.stats.points_per_game.toFixed(1),
        },
        {
          label: 'FG%',
          prospect: `${prospect.stats.field_goal_percentage.toFixed(1)}%`,
          historical: `${historical.stats.field_goal_percentage.toFixed(1)}%`,
        },
        {
          label: '3P%',
          prospect: `${prospect.stats.three_point_percentage.toFixed(1)}%`,
          historical: `${historical.stats.three_point_percentage.toFixed(1)}%`,
        },
        {
          label: 'FT%',
          prospect: `${prospect.stats.free_throw_percentage.toFixed(1)}%`,
          historical: `${historical.stats.free_throw_percentage.toFixed(1)}%`,
        },
      ],
    },
    {
      category: 'Playmaking',
      stats: [
        {
          label: 'APG',
          prospect: prospect.stats.assists_per_game.toFixed(1),
          historical: historical.stats.assists_per_game.toFixed(1),
        },
        {
          label: 'TOV',
          prospect: prospect.stats.turnovers_per_game.toFixed(1),
          historical: historical.stats.turnovers_per_game.toFixed(1),
        },
      ],
    },
    {
      category: 'Other',
      stats: [
        {
          label: 'RPG',
          prospect: prospect.stats.rebounds_per_game.toFixed(1),
          historical: historical.stats.rebounds_per_game.toFixed(1),
        },
        {
          label: 'SPG',
          prospect: prospect.stats.steals_per_game.toFixed(1),
          historical: historical.stats.steals_per_game.toFixed(1),
        },
        {
          label: 'BPG',
          prospect: prospect.stats.blocks_per_game.toFixed(1),
          historical: historical.stats.blocks_per_game.toFixed(1),
        },
        {
          label: 'MPG',
          prospect: prospect.stats.minutes_per_game.toFixed(1),
          historical: historical.stats.minutes_per_game.toFixed(1),
        },
      ],
    },
  ];

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
              Statistic
            </th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-blue-600">
              {prospect.name}
            </th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-green-600">
              {historical.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {compareStats.map((category) => (
            <React.Fragment key={category.category}>
              <tr className="bg-gray-50">
                <td
                  colSpan={3}
                  className="py-2 px-4 text-xs font-bold text-gray-700 uppercase"
                >
                  {category.category}
                </td>
              </tr>
              {category.stats.map((stat) => {
                const prospectNum = parseFloat(stat.prospect);
                const historicalNum = parseFloat(stat.historical);
                const prospectBetter = prospectNum > historicalNum;
                const similar = Math.abs(prospectNum - historicalNum) < 0.5;

                return (
                  <tr key={stat.label} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {stat.label}
                    </td>
                    <td
                      className={`text-center py-3 px-4 font-semibold ${
                        similar
                          ? 'text-gray-900'
                          : prospectBetter
                          ? 'text-blue-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {stat.prospect}
                      {!similar && prospectBetter && ' ✓'}
                    </td>
                    <td
                      className={`text-center py-3 px-4 font-semibold ${
                        similar
                          ? 'text-gray-900'
                          : !prospectBetter
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {stat.historical}
                      {!similar && !prospectBetter && ' ✓'}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
