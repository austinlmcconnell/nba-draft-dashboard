'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { PlayerCard, PlayerCardSkeleton } from '@/components/PlayerCard';
import type { CollegePlayer } from '@/types/player';
import { loadProspects } from '@/lib/utils/dataLoader';

export default function DashboardPage() {
  const [prospects, setProspects] = useState<CollegePlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [conferenceFilter, setConferenceFilter] = useState('all');

  useEffect(() => {
    loadProspects(2024).then(data => {
      setProspects(data);
      setIsLoading(false);
    });
  }, []);

  const filteredProspects = useMemo(() => {
    return prospects.filter(p => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q);
      const matchesPosition = positionFilter === 'all' || p.position === positionFilter;
      const matchesConference = conferenceFilter === 'all' || p.conference === conferenceFilter;
      return matchesSearch && matchesPosition && matchesConference;
    });
  }, [prospects, searchTerm, positionFilter, conferenceFilter]);

  const positions = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.position))).sort()], [prospects]);
  const conferences = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.conference))).sort()], [prospects]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">NBA Draft Dashboard</h1>
              <p className="mt-1 text-gray-600">Compare prospects to their closest historical NBA player matches</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">2023-24 Season</p>
              <p className="text-2xl font-bold text-blue-600">{prospects.length} Prospects</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
              <input
                type="text"
                placeholder="Name or school..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {positions.map(p => <option key={p} value={p}>{p === 'all' ? 'All Positions' : p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Conference</label>
              <select
                value={conferenceFilter}
                onChange={e => setConferenceFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {conferences.map(c => <option key={c} value={c}>{c === 'all' ? 'All Conferences' : c}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-900">{filteredProspects.length}</span> of{' '}
              <span className="font-semibold text-gray-900">{prospects.length}</span> prospects
            </p>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <PlayerCardSkeleton key={i} />)}
          </div>
        ) : filteredProspects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No prospects found matching your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProspects.map(p => <PlayerCard key={p.id} player={p} />)}
          </div>
        )}
      </main>

      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Data sourced from CollegeBasketballData.com · Basketball Reference
          </p>
        </div>
      </footer>
    </div>
  );
}
