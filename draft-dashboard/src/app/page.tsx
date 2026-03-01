'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PlayerCard, PlayerCardSkeleton } from '@/components/PlayerCard';
import type { CollegePlayer, DraftRanking } from '@/types/player';
import { loadProspects, loadDraftRankings } from '@/lib/utils/dataLoader';

// ---------------------------------------------------------------------------
// Name-matching helpers
// Tankathon names may differ slightly from the DB:
//   "Darius Acuff" vs "Darius Acuff Jr."
//   "Johann Grünloh" vs "Johann Grunloh"
// ---------------------------------------------------------------------------
const ACCENT_MAP: Record<string, string> = {
  à:'a',á:'a',â:'a',ã:'a',ä:'a',å:'a',
  è:'e',é:'e',ê:'e',ë:'e',
  ì:'i',í:'i',î:'i',ï:'i',
  ò:'o',ó:'o',ô:'o',õ:'o',ö:'o',ø:'o',
  ù:'u',ú:'u',û:'u',ü:'u',
  ñ:'n',ç:'c',ý:'y',
};
const SUFFIX_RE = /\s+\b(jr|sr|ii|iii|iv|v)\b\.?\s*$/i;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâãäåèéêëìíîïòóôõöøùúûüñçý]/g, c => ACCENT_MAP[c] ?? c)
    .replace(SUFFIX_RE, '')       // strip Jr./Sr./II suffixes
    .replace(/[^a-z\s]/g, '')     // strip remaining punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function nameSimilar(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const partsA = na.split(' ');
  const partsB = nb.split(' ');
  if (partsA.length >= 2 && partsB.length >= 2) {
    // Last name + first 3 chars of first name
    if (partsA.at(-1) === partsB.at(-1) && partsA[0].slice(0, 3) === partsB[0].slice(0, 3)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Merge rankings with full player database
// ---------------------------------------------------------------------------
interface RankedPlayer {
  player: CollegePlayer;
  rank: number | undefined;
}

function mergeRankings(
  prospects: CollegePlayer[],
  rankings: DraftRanking[],
): { ranked: RankedPlayer[]; all: RankedPlayer[] } {
  // Build a map from ranking school name → prospects at that school
  const bySchool = new Map<string, CollegePlayer[]>();
  for (const p of prospects) {
    const key = normalizeName(p.team);
    if (!bySchool.has(key)) bySchool.set(key, []);
    bySchool.get(key)!.push(p);
  }

  const ranked: RankedPlayer[] = [];
  const matchedIds = new Set<string>();

  for (const r of rankings) {
    // Try exact name match first
    let match = prospects.find(p => nameSimilar(p.name, r.name));

    // If no exact name match, try matching by school + last name
    if (!match) {
      const schoolKey = normalizeName(r.school);
      const schoolProspects = bySchool.get(schoolKey) ?? [];
      const rankLastName = normalizeName(r.name).split(' ').pop() ?? '';
      match = schoolProspects.find(p =>
        normalizeName(p.name).split(' ').pop() === rankLastName,
      );
    }

    if (match && !matchedIds.has(match.id)) {
      matchedIds.add(match.id);
      ranked.push({ player: match, rank: r.rank });
    } else {
      // Include as an unmatched placeholder (will be shown at bottom of ranked list)
      // We still want to show ranked players even without DB data
    }
  }

  // Unranked prospects (not in Tankathon list)
  const unranked: RankedPlayer[] = prospects
    .filter(p => !matchedIds.has(p.id))
    .map(p => ({ player: p, rank: undefined }));

  // Full list for search mode: ranked first (by rank), then unranked (by name)
  const all: RankedPlayer[] = [
    ...ranked,
    ...unranked.sort((a, b) => a.player.name.localeCompare(b.player.name)),
  ];

  return { ranked, all };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DashboardPage() {
  const [prospects, setProspects]   = useState<CollegePlayer[]>([]);
  const [rankings, setRankings]     = useState<DraftRanking[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [conferenceFilter, setConferenceFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadProspects(2026), loadDraftRankings()]).then(([data, ranks]) => {
      setProspects(data);
      setRankings(ranks);
      setIsLoading(false);
    });
  }, []);

  const { ranked, all } = useMemo(
    () => mergeRankings(prospects, rankings),
    [prospects, rankings],
  );

  const isSearching = searchTerm.trim().length > 0 || positionFilter !== 'all' || conferenceFilter !== 'all';

  const displayList = useMemo(() => {
    const pool = isSearching ? all : ranked;
    const q = searchTerm.toLowerCase().trim();
    return pool.filter(({ player: p }) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.conference.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q);
      const matchesPosition   = positionFilter   === 'all' || p.position === positionFilter;
      const matchesConference = conferenceFilter === 'all' || p.conference === conferenceFilter;
      return matchesSearch && matchesPosition && matchesConference;
    });
  }, [isSearching, all, ranked, searchTerm, positionFilter, conferenceFilter]);

  const positions   = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.position))).sort()], [prospects]);
  const conferences = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.conference))).sort()], [prospects]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">NBA Draft Dashboard</h1>
              <p className="mt-1 text-gray-600">Compare prospects to their closest historical NBA player matches</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">2025–26 Season</p>
              <p className="text-2xl font-bold text-blue-600">{prospects.length} Prospects</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search + filters */}
        <div className="mb-8 bg-white rounded-xl shadow-md p-6">
          {/* Big search bar */}
          <div className="relative mb-4">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name, school, conference, or position…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Position + conference dropdowns */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Position</label>
              <select
                value={positionFilter}
                onChange={e => setPositionFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {positions.map(p => <option key={p} value={p}>{p === 'all' ? 'All' : p}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Conference</label>
              <select
                value={conferenceFilter}
                onChange={e => setConferenceFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {conferences.map(c => <option key={c} value={c}>{c === 'all' ? 'All' : c}</option>)}
              </select>
            </div>

            {isSearching && (
              <button
                onClick={() => { setSearchTerm(''); setPositionFilter('all'); setConferenceFilter('all'); }}
                className="ml-auto text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear filters
              </button>
            )}

            <span className="ml-auto text-sm text-gray-500">
              {isSearching
                ? <><span className="font-semibold text-gray-800">{displayList.length}</span> results</>
                : <><span className="font-semibold text-gray-800">{ranked.length}</span> ranked prospects</>
              }
            </span>
          </div>
        </div>

        {/* Section header */}
        {!isSearching && !isLoading && (
          <div className="flex items-center gap-3 mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Tankathon Big Board — 2026 NBA Draft
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Rankings from <span className="font-medium">tankathon.com</span> · click any card to view comparisons
              </p>
            </div>
          </div>
        )}

        {isSearching && !isLoading && (
          <div className="flex items-center gap-2 mb-5">
            <h2 className="text-xl font-bold text-gray-900">Search Results</h2>
            <span className="text-sm text-gray-500">— searching full database of {prospects.length} prospects</span>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <PlayerCardSkeleton key={i} />)}
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-gray-500 text-lg">No prospects found.</p>
            <button
              onClick={() => { setSearchTerm(''); setPositionFilter('all'); setConferenceFilter('all'); }}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayList.map(({ player, rank }) => (
              <PlayerCard key={player.id} player={player} rank={rank} />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            Stats from CollegeBasketballData.com · Basketball Reference · Rankings from Tankathon
          </p>
        </div>
      </footer>
    </div>
  );
}
