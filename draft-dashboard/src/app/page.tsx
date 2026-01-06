/**
 * Main Dashboard Page
 * Displays all current prospects in a searchable grid
 */

'use client';

import React, { useState, useMemo } from 'react';
import { PlayerCard, PlayerCardSkeleton } from '@/components/PlayerCard';
import type { CollegePlayer } from '@/types/player';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [conferenceFilter, setConferenceFilter] = useState<string>('all');

  // In production, load this from your data file
  // For now, we'll use a placeholder
  const prospects: CollegePlayer[] = []; // Load from data/current_prospects.json
  const isLoading = prospects.length === 0;

  // Filter prospects based on search and filters
  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      const matchesSearch = prospect.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
        prospect.team.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesPosition =
        positionFilter === 'all' || prospect.position === positionFilter;

      const matchesConference =
        conferenceFilter === 'all' || prospect.conference === conferenceFilter;

      return matchesSearch && matchesPosition && matchesConference;
    });
  }, [prospects, searchTerm, positionFilter, conferenceFilter]);

  // Get unique positions and conferences for filters
  const positions = useMemo(
    () => ['all', ...new Set(prospects.map(p => p.position))],
    [prospects]
  );

  const conferences = useMemo(
    () => ['all', ...new Set(prospects.map(p => p.conference))],
    [prospects]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                NBA Draft Dashboard
              </h1>
              <p className="mt-1 text-gray-600">
                Compare prospects to historical NBA players
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">2024-25 Season</p>
              <p className="text-2xl font-bold text-blue-600">
                {prospects.length} Prospects
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="md:col-span-1">
              <label
                htmlFor="search"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Search Players
              </label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  placeholder="Name or school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Position Filter */}
            <div>
              <label
                htmlFor="position"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Position
              </label>
              <select
                id="position"
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {positions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos === 'all' ? 'All Positions' : pos}
                  </option>
                ))}
              </select>
            </div>

            {/* Conference Filter */}
            <div>
              <label
                htmlFor="conference"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Conference
              </label>
              <select
                id="conference"
                value={conferenceFilter}
                onChange={(e) => setConferenceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {conferences.map((conf) => (
                  <option key={conf} value={conf}>
                    {conf === 'all' ? 'All Conferences' : conf}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Showing{' '}
              <span className="font-semibold text-gray-900">
                {filteredProspects.length}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-900">
                {prospects.length}
              </span>{' '}
              prospects
            </p>
          </div>
        </div>

        {/* Prospects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <PlayerCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProspects.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No prospects found
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProspects.map((prospect) => (
              <PlayerCard key={prospect.id} player={prospect} />
            ))}
          </div>
        )}

        {/* Info Box */}
        {prospects.length === 0 && !isLoading && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-blue-600 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900">
                  No data loaded yet
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>To get started:</p>
                  <ol className="list-decimal list-inside mt-2 space-y-1">
                    <li>Run the data collection scripts</li>
                    <li>Load prospect data into the app</li>
                    <li>Prospects will appear here automatically</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Data sourced from CollegeBasketballData.com and NBA.com
          </p>
        </div>
      </footer>
    </div>
  );
}
