'use client';

/**
 * /draft — 2026 NBA Draft Board
 * Full prospect search, filter, and ranked grid.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PlayerCard, PlayerCardSkeleton } from '@/components/PlayerCard';
import type { CollegePlayer, DraftRanking } from '@/types/player';
import { loadProspects, loadDraftRankings } from '@/lib/utils/dataLoader';

// ─── Name-matching helpers ────────────────────────────────────────────────────
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
    .replace(SUFFIX_RE, '')
    .replace(/[^a-z\s]/g, '')
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
    if (partsA.at(-1) === partsB.at(-1) && partsA[0].slice(0, 3) === partsB[0].slice(0, 3)) return true;
  }
  return false;
}

// ─── Merge rankings ───────────────────────────────────────────────────────────
interface RankedPlayer { player: CollegePlayer; rank: number | undefined; }

function mergeRankings(
  prospects: CollegePlayer[],
  rankings: DraftRanking[],
): { ranked: RankedPlayer[]; all: RankedPlayer[] } {
  const bySchool = new Map<string, CollegePlayer[]>();
  for (const p of prospects) {
    const key = normalizeName(p.team);
    if (!bySchool.has(key)) bySchool.set(key, []);
    bySchool.get(key)!.push(p);
  }

  const ranked: RankedPlayer[] = [];
  const matchedIds = new Set<string>();

  for (const r of rankings) {
    let match = prospects.find(p => nameSimilar(p.name, r.name));
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
    }
  }

  const unranked: RankedPlayer[] = prospects
    .filter(p => !matchedIds.has(p.id))
    .map(p => ({ player: p, rank: undefined }));

  const all: RankedPlayer[] = [
    ...ranked,
    ...unranked.sort((a, b) => a.player.name.localeCompare(b.player.name)),
  ];

  return { ranked, all };
}

// ─── Filter select ────────────────────────────────────────────────────────────
function FilterSelect({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-[#9ca3af] whitespace-nowrap">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm bg-[#1a2332] border border-[#1f2937] text-[#d1d5db] rounded-lg
                   focus:ring-2 focus:ring-[#1a7a3f] focus:border-[#1a7a3f] outline-none cursor-pointer"
      >
        {options.map(o => (
          <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DraftBoardPage() {
  const [prospects, setProspects]   = useState<CollegePlayer[]>([]);
  const [rankings, setRankings]     = useState<DraftRanking[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter]   = useState('all');
  const [conferenceFilter, setConferenceFilter] = useState('all');
  const [schoolFilter, setSchoolFilter]       = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const school = params.get('school');
    if (school) setSchoolFilter(school);

    Promise.all([loadProspects(2026), loadDraftRankings()]).then(([data, ranks]) => {
      setProspects(data);
      setRankings(ranks);
      setIsLoading(false);
    });
  }, []);

  const { ranked, all } = useMemo(() => mergeRankings(prospects, rankings), [prospects, rankings]);

  const isSearching = searchTerm.trim().length > 0
    || positionFilter   !== 'all'
    || conferenceFilter !== 'all'
    || schoolFilter     !== 'all';

  const displayList = useMemo(() => {
    const pool = isSearching ? all : ranked;
    const q = searchTerm.toLowerCase().trim();
    return pool.filter(({ player: p }) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q)       ||
        p.team.toLowerCase().includes(q)       ||
        p.conference.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q);
      return (
        matchesSearch &&
        (positionFilter   === 'all' || p.position   === positionFilter) &&
        (conferenceFilter === 'all' || p.conference === conferenceFilter) &&
        (schoolFilter     === 'all' || p.team       === schoolFilter)
      );
    });
  }, [isSearching, all, ranked, searchTerm, positionFilter, conferenceFilter, schoolFilter]);

  const positions   = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.position))).sort()], [prospects]);
  const conferences = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.conference))).sort()], [prospects]);
  const schools     = useMemo(() => ['all', ...Array.from(new Set(prospects.map(p => p.team))).sort()], [prospects]);

  const clearFilters = () => {
    setSearchTerm('');
    setPositionFilter('all');
    setConferenceFilter('all');
    setSchoolFilter('all');
  };

  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* Page hero */}
      <div className="relative bg-[#111827] border-b border-[#1f2937] overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{ background: 'radial-gradient(ellipse 60% 80% at 0% 50%, rgba(26,122,63,0.12) 0%, transparent 70%)' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-2">
                2026 NBA Draft
              </p>
              <h1 className="text-3xl sm:text-4xl font-black text-[#f9fafb]">Draft Board</h1>
              <p className="text-[#9ca3af] mt-1.5 text-sm">
                Powered by Tankathon Big Board · click any card for full comparisons
              </p>
            </div>
            <div className="flex items-center gap-4">
              {!isLoading && (
                <div className="text-right">
                  <div className="text-2xl font-black text-[#4ade80]">{prospects.length}</div>
                  <div className="text-xs text-[#9ca3af]">Prospects in database</div>
                </div>
              )}
              <Link href="/methodology" className="btn-secondary text-sm py-2 px-4 whitespace-nowrap">
                How comps work →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search + filters */}
        <div className="cb-panel p-5 mb-8">
          {/* Search bar */}
          <div className="relative mb-4">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280] pointer-events-none"
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
              className="w-full pl-12 pr-10 py-3 text-base bg-[#1a2332] border border-[#1f2937] text-[#f9fafb]
                         placeholder:text-[#6b7280] rounded-xl focus:ring-2 focus:ring-[#1a7a3f]
                         focus:border-[#1a7a3f] outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); searchRef.current?.focus(); }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6b7280] hover:text-[#f9fafb]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap gap-3 items-center">
            <FilterSelect label="Position"   value={positionFilter}   options={positions}   onChange={setPositionFilter} />
            <FilterSelect label="Conference" value={conferenceFilter} options={conferences} onChange={setConferenceFilter} />
            <FilterSelect label="School"     value={schoolFilter}     options={schools}     onChange={setSchoolFilter} />

            {isSearching && (
              <button
                onClick={clearFilters}
                className="ml-auto text-sm text-[#1a7a3f] hover:text-[#4ade80] font-semibold transition-colors"
              >
                Clear filters
              </button>
            )}

            <span className={`${isSearching ? '' : 'ml-auto'} text-sm text-[#6b7280]`}>
              {isSearching
                ? <><span className="font-bold text-[#d1d5db]">{displayList.length}</span> results</>
                : <><span className="font-bold text-[#d1d5db]">{ranked.length}</span> ranked prospects</>
              }
            </span>
          </div>
        </div>

        {/* Section header */}
        {!isSearching && !isLoading && (
          <div className="flex items-center gap-3 mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#f9fafb]">
                Tankathon Big Board — 2026 NBA Draft
              </h2>
              <p className="text-sm text-[#6b7280] mt-0.5">
                Rankings from <span className="font-medium text-[#9ca3af]">tankathon.com</span>
              </p>
            </div>
          </div>
        )}

        {isSearching && !isLoading && (
          <div className="flex items-center gap-2 mb-6">
            <h2 className="text-xl font-bold text-[#f9fafb]">Search Results</h2>
            <span className="text-sm text-[#6b7280]">
              — searching full database of {prospects.length} prospects
            </span>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <PlayerCardSkeleton key={i} />)}
          </div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20">
            <svg className="w-12 h-12 text-[#374151] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-[#6b7280] text-lg">No prospects found.</p>
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-[#1a7a3f] hover:text-[#4ade80] underline transition-colors"
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
      </div>
    </div>
  );
}
