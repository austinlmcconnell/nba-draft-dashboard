/**
 * Player stats proxy route.
 * GET /api/player-stats?athleteId=5105253
 *
 * Fetches per-game season stats from ESPN's unofficial athlete API.
 * Cached in-memory for 1 hour so it stays fresh during the season.
 */

import { NextRequest, NextResponse } from 'next/server';

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':          'https://www.espn.com',
  'Referer':         'https://www.espn.com/',
};

export interface StatItem {
  label: string;  // e.g. "PPG"
  value: string;  // e.g. "19.2"
}

export interface PlayerStatsResult {
  stats: StatItem[];
  error?: string;
}

// ─── In-memory cache (1-hour TTL) ─────────────────────────────────────────────
const cache = new Map<number, PlayerStatsResult & { cachedAt: number }>();
const TTL   = 60 * 60 * 1000;

// ─── Stat keys we care about (in display order) ───────────────────────────────
const WANTED: Record<string, string> = {
  gamesPlayed:          'GP',
  avgMinutes:           'MPG',
  avgPoints:            'PPG',
  avgRebounds:          'RPG',
  avgAssists:           'APG',
  avgSteals:            'SPG',
  avgBlocks:            'BPG',
  fieldGoalPct:         'FG%',
  threePointFieldGoalPct: '3P%',
  freeThrowPct:         'FT%',
  // fallback name variants ESPN sometimes uses
  points:               'PPG',
  rebounds:             'RPG',
  assists:              'APG',
  steals:               'SPG',
  blocks:               'BPG',
  fieldGoalsMadePct:    'FG%',
  threePointPct:        '3P%',
  freeThrowsMadePct:    'FT%',
  minutesPerGame:       'MPG',
};

// Format a raw stat value nicely
function fmt(name: string, raw: string): string {
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  if (name.endsWith('Pct') || name.endsWith('pct') || name.includes('Percent')) {
    return `${(num * (num <= 1 ? 100 : 1)).toFixed(1)}%`;
  }
  if (name === 'gamesPlayed') return String(Math.round(num));
  return num % 1 === 0 ? String(num) : num.toFixed(1);
}

// Extract wanted stats from a flat array of ESPN stat objects
function extractStats(statArr: any[]): StatItem[] {
  const seen  = new Set<string>();
  const items: StatItem[] = [];

  // Preserve display order from WANTED keys
  const orderedKeys = Array.from(new Set(Object.keys(WANTED)));

  for (const key of orderedKeys) {
    const label = WANTED[key];
    if (seen.has(label)) continue;

    const found = statArr.find(
      (s: any) => s.name === key || s.abbreviation?.toUpperCase() === label
    );
    if (found) {
      const raw = found.displayValue ?? found.value ?? '';
      if (raw === '' || raw === '0' || raw === '0.0' || raw === '0.0%') continue;
      items.push({ label, value: fmt(key, raw) });
      seen.add(label);
    }
  }

  return items;
}

async function fetchStats(athleteId: number): Promise<PlayerStatsResult> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/athletes/${athleteId}/statistics`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    return { stats: [], error: `ESPN returned ${res.status}` };
  }

  const data = await res.json();

  // ESPN returns stats in several possible shapes — handle all of them
  let statArr: any[] = [];

  // Shape 1: data.statistics[].stats[]  (most common)
  if (Array.isArray(data.statistics)) {
    for (const group of data.statistics) {
      if (Array.isArray(group.stats)) statArr.push(...group.stats);
    }
  }

  // Shape 2: data.splits.categories[].stats[]
  if (!statArr.length && data.splits?.categories) {
    for (const cat of data.splits.categories) {
      if (Array.isArray(cat.stats)) statArr.push(...cat.stats);
    }
  }

  // Shape 3: data.stats[] (flat)
  if (!statArr.length && Array.isArray(data.stats)) {
    statArr = data.stats;
  }

  if (!statArr.length) {
    console.log(`[player-stats] No stats found for athleteId=${athleteId}. Keys:`, Object.keys(data));
    return { stats: [], error: 'No stats data found' };
  }

  const stats = extractStats(statArr);
  console.log(`[player-stats] athleteId=${athleteId} → ${stats.length} stats`);
  return { stats };
}

// ─── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get('athleteId');
  if (!raw) return NextResponse.json({ stats: [], error: 'athleteId required' }, { status: 400 });

  const athleteId = parseInt(raw);
  if (isNaN(athleteId)) return NextResponse.json({ stats: [], error: 'invalid athleteId' }, { status: 400 });

  const cached = cache.get(athleteId);
  if (cached && Date.now() - cached.cachedAt < TTL) {
    return NextResponse.json<PlayerStatsResult>(
      { stats: cached.stats },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } }
    );
  }

  try {
    const result = await fetchStats(athleteId);
    cache.set(athleteId, { ...result, cachedAt: Date.now() });
    return NextResponse.json<PlayerStatsResult>(result, {
      headers: { 'Cache-Control': 'public, s-maxage=3600' },
    });
  } catch (err) {
    console.error('[player-stats]', err);
    return NextResponse.json<PlayerStatsResult>({ stats: [], error: String(err) });
  }
}
