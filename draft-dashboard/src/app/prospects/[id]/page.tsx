/**
 * Prospect Detail Page
 * Shows detailed stats and historical player comparisons
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ComparisonCard, ComparisonCardSkeleton } from '@/components/ComparisonCard';
import { StatTable } from '@/components/StatTable';
import type { CollegePlayer, HistoricalPlayer, PlayerComparison } from '@/types/player';
import { findSimilarPlayers, buildDatasetStats } from '@/lib/utils/comparison';

export default function ProspectDetailPage() {
  const params = useParams();
  const prospectId = params.id as string;

  const [prospect, setProspect] = useState<CollegePlayer | null>(null);
  const [comparisons, setComparisons] = useState<PlayerComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'scoring' | 'playmaking' | 'defense'>('all');

  useEffect(() => {
    // Load prospect and calculate comparisons
    async function loadData() {
      try {
        // In production, load from your data files
        // const prospectsData = await import('@/data/current_prospects.json');
        // const historicalData = await import('@/data/nba_career_stats.json');
        
        // For now, using placeholder
        // const foundProspect = prospectsData.find(p => p.id === prospectId);
        // const datasetStats = buildDatasetStats(historicalData.map(h => h.college_profile));
        // const matches = findSimilarPlayers(foundProspect, historicalData, datasetStats, { topN: 10 });
        
        // setProspect(foundProspect);
        // setComparisons(matches);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    }

    loadData();
  }, [prospectId]);

  if (isLoading) {
    return <ProspectDetailSkeleton />;
  }

  if (!prospect) {
    return <ProspectNotFound />;
  }

  const formatHeight = (inches: number): string => {
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return `${feet}'${remainingInches}"`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <svg
              className="w-5 h-5 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Prospect Profile Section */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          {/* Hero Banner */}
          <div className="relative h-64 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
            <div className="absolute inset-0 bg-[url('/basketball-pattern.svg')] opacity-10" />
            
            {/* Profile Content */}
            <div className="relative h-full flex items-center px-8">
              {/* Player Avatar */}
              <div className="w-40 h-40 rounded-full bg-white/10 backdrop-blur-sm border-4 border-white/20 flex items-center justify-center mr-8">
                <span className="text-7xl font-bold text-white/70">
                  {prospect.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>

              {/* Player Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-blue-900 text-sm font-bold rounded-full">
                    {prospect.position}
                  </span>
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-sm text-blue-900 text-sm font-bold rounded-full">
                    {prospect.year}
                  </span>
                </div>
                <h1 className="text-5xl font-bold text-white mb-2">
                  {prospect.name}
                </h1>
                <p className="text-xl text-blue-100">
                  {prospect.team} • {prospect.conference}
                </p>
              </div>

              {/* Physical Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-blue-200 text-sm uppercase">Height</p>
                  <p className="text-3xl font-bold text-white">
                    {formatHeight(prospect.physical.height_inches)}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-200 text-sm uppercase">Weight</p>
                  <p className="text-3xl font-bold text-white">
                    {prospect.physical.weight_pounds}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-200 text-sm uppercase">Age</p>
                  <p className="text-3xl font-bold text-white">
                    {prospect.physical.age_at_season_start}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              2024-25 Season Stats
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              <StatBox
                label="Points"
                value={prospect.stats.points_per_game.toFixed(1)}
                color="blue"
              />
              <StatBox
                label="Rebounds"
                value={prospect.stats.rebounds_per_game.toFixed(1)}
                color="green"
              />
              <StatBox
                label="Assists"
                value={prospect.stats.assists_per_game.toFixed(1)}
                color="purple"
              />
              <StatBox
                label="Steals"
                value={prospect.stats.steals_per_game.toFixed(1)}
                color="yellow"
              />
              <StatBox
                label="Blocks"
                value={prospect.stats.blocks_per_game.toFixed(1)}
                color="red"
              />
              <StatBox
                label="FG%"
                value={`${prospect.stats.field_goal_percentage.toFixed(1)}%`}
                color="indigo"
              />
              <StatBox
                label="3P%"
                value={`${prospect.stats.three_point_percentage.toFixed(1)}%`}
                color="pink"
              />
              <StatBox
                label="FT%"
                value={`${prospect.stats.free_throw_percentage.toFixed(1)}%`}
                color="cyan"
              />
              <StatBox
                label="Turnovers"
                value={prospect.stats.turnovers_per_game.toFixed(1)}
                color="gray"
              />
              <StatBox
                label="Minutes"
                value={prospect.stats.minutes_per_game.toFixed(1)}
                color="orange"
              />
              <StatBox
                label="Games"
                value={prospect.stats.games.toString()}
                color="teal"
              />
            </div>
          </div>
        </div>

        {/* Comparisons Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">
                Historical Comparisons
              </h2>
              <p className="text-gray-600 mt-1">
                Similar players based on college statistics
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <TabButton
                active={activeTab === 'all'}
                onClick={() => setActiveTab('all')}
              >
                All Comps
              </TabButton>
              <TabButton
                active={activeTab === 'scoring'}
                onClick={() => setActiveTab('scoring')}
              >
                Scorers
              </TabButton>
              <TabButton
                active={activeTab === 'playmaking'}
                onClick={() => setActiveTab('playmaking')}
              >
                Playmakers
              </TabButton>
              <TabButton
                active={activeTab === 'defense'}
                onClick={() => setActiveTab('defense')}
              >
                Defenders
              </TabButton>
            </div>
          </div>

          {/* Comparisons Grid */}
          {comparisons.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <p className="text-gray-500">No comparisons available yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Run the data collection scripts to generate comparisons
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {comparisons.slice(0, 6).map((comparison, index) => (
                <ComparisonCard
                  key={comparison.historical_player.id}
                  comparison={comparison}
                  rank={index + 1}
                  showBreakdown={index < 3}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detailed Stats Table */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Complete Statistics
          </h2>
          <StatTable player={prospect} />
        </div>
      </main>
    </div>
  );
}

/**
 * StatBox - Individual stat display
 */
function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
    indigo: 'from-indigo-500 to-indigo-600',
    pink: 'from-pink-500 to-pink-600',
    cyan: 'from-cyan-500 to-cyan-600',
    gray: 'from-gray-500 to-gray-600',
    orange: 'from-orange-500 to-orange-600',
    teal: 'from-teal-500 to-teal-600',
  };

  return (
    <div className="relative group">
      <div
        className={`
        bg-gradient-to-br ${colorClasses[color]} 
        rounded-xl p-4 shadow-md
        group-hover:shadow-lg group-hover:scale-105
        transition-all duration-200
      `}
      >
        <p className="text-white/80 text-sm uppercase mb-1">{label}</p>
        <p className="text-white text-3xl font-bold">{value}</p>
      </div>
    </div>
  );
}

/**
 * TabButton - Filter tab component
 */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 rounded-lg font-medium text-sm transition-all
        ${
          active
            ? 'bg-blue-600 text-white shadow-md'
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
        }
      `}
    >
      {children}
    </button>
  );
}

/**
 * Loading Skeleton
 */
function ProspectDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 animate-pulse">
          <div className="h-64 bg-gray-300" />
          <div className="p-8">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-6" />
            <div className="grid grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-300 rounded" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6">
          <ComparisonCardSkeleton />
          <ComparisonCardSkeleton />
        </div>
      </div>
    </div>
  );
}

/**
 * Not Found Component
 */
function ProspectNotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Prospect not found</p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
