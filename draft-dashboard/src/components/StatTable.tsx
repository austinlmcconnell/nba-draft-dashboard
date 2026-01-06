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

  // Group stats by category
  const statCategories = [
    {
      title: 'Scoring',
      stats: [
        { label: 'Points Per Game', value: stats.points_per_game.toFixed(1) },
        { label: 'Field Goal %', value: `${stats.field_goal_percentage.toFixed(1)}%` },
        { label: '3-Point %', value: `${stats.three_point_percentage.toFixed(1)}%` },
        { label: 'Free Throw %', value: `${stats.free_throw_percentage.toFixed(1)}%` },
        ...(stats.true_shooting_percentage
          ? [{ label: 'True Shooting %', value: `${stats.true_shooting_percentage.toFixed(1)}%` }]
          : []),
      ],
    },
    {
      title: 'Playmaking',
      stats: [
        { label: 'Assists Per Game', value: stats.assists_per_game.toFixed(1) },
        { label: 'Turnovers Per Game', value: stats.turnovers_per_game.toFixed(1) },
        {
          label: 'Assist/Turnover Ratio',
          value: (stats.assists_per_game / stats.turnovers_per_game).toFixed(2),
        },
        ...(stats.usage_rate
          ? [{ label: 'Usage Rate', value: `${stats.usage_rate.toFixed(1)}%` }]
          : []),
      ],
    },
    {
      title: 'Rebounding',
      stats: [
        { label: 'Rebounds Per Game', value: stats.rebounds_per_game.toFixed(1) },
        ...(stats.offensive_rebounds_per_game
          ? [{ label: 'Offensive RPG', value: stats.offensive_rebounds_per_game.toFixed(1) }]
          : []),
        ...(stats.defensive_rebounds_per_game
          ? [{ label: 'Defensive RPG', value: stats.defensive_rebounds_per_game.toFixed(1) }]
          : []),
      ],
    },
    {
      title: 'Defense',
      stats: [
        { label: 'Steals Per Game', value: stats.steals_per_game.toFixed(1) },
        { label: 'Blocks Per Game', value: stats.blocks_per_game.toFixed(1) },
        {
          label: 'Defensive Actions/Game',
          value: (stats.steals_per_game + stats.blocks_per_game).toFixed(1),
        },
      ],
    },
    {
      title: 'Playing Time',
      stats: [
        { label: 'Minutes Per Game', value: stats.minutes_per_game.toFixed(1) },
        { label: 'Games Played', value: stats.games.toString() },
        ...(stats.games_started !== undefined
          ? [{ label: 'Games Started', value: stats.games_started.toString() }]
          : []),
      ],
    },
    ...(stats.player_efficiency_rating
      ? [
          {
            title: 'Advanced Metrics',
            stats: [
              {
                label: 'Player Efficiency Rating',
                value: stats.player_efficiency_rating.toFixed(1),
              },
              ...(stats.offensive_rating
                ? [{ label: 'Offensive Rating', value: stats.offensive_rating.toFixed(1) }]
                : []),
              ...(stats.defensive_rating
                ? [{ label: 'Defensive Rating', value: stats.defensive_rating.toFixed(1) }]
                : []),
            ],
          },
        ]
      : []),
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
