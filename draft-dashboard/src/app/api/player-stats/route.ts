/**
 * Player stats proxy route.
 * GET /api/player-stats?athleteId=5142620
 *
 * Fetches per-game season averages from ESPN's public athlete stats API:
 * site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/{id}/stats
 *
 * Cached 1 hour so stats stay fresh during the season.
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
  label: string; // e.g. "PPG"
  value: string; // e.g. "23.5"
}

export interface PlayerStatsResult {
  stats: StatItem[];
  error?: string;
}

// Stats to show and their display order (FG/FT captured for TS% calc but not displayed)
const SHOW_LABELS = ['GP', 'MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%', 'FT%'];
const CAPTURE_LABELS = [...SHOW_LABELS, 'FG', 'FT'];

// ─── In-memory cache (1-hour TTL) ─────────────────────────────────────────────
const cache = new Map<number, PlayerStatsResult & { cachedAt: number }>();
const TTL   = 60 * 60 * 1000;

async function fetchStats(athleteId: number): Promise<PlayerStatsResult> {
  const url = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/${athleteId}/stats`;
  const res = await fetch(url, { headers: HEADERS });

  if (!res.ok) {
    return { stats: [], error: `ESPN returned ${res.status}` };
  }

  const data = await res.json();

  // Find the averages category — it has labels like ["GP","GS","MIN",...]
  const averages = (data.categories ?? []).find(
    (c: any) => c.name === 'averages' || c.sortKey === 'averages'
  );

  if (!averages) {
    console.log(`[player-stats] no averages category for ${athleteId}, keys:`, Object.keys(data));
    return { stats: [], error: 'No averages data' };
  }

  const labels: string[]  = averages.labels ?? [];
  // ESPN returns statistics in chronological order (oldest season first).
  // Always pick the row with the highest season.year to get the current season.
  const statistics: any[] = averages.statistics ?? [];
  const mostRecent = statistics.reduce((best: any, row: any) => {
    const year = row?.season?.year ?? 0;
    return !best || year > (best?.season?.year ?? 0) ? row : best;
  }, null);
  const statsRow: string[] = mostRecent?.stats ?? averages.totals ?? [];

  // Zip labels with values, filter to what we want, preserve order
  const mapped = new Map<string, string>();
  labels.forEach((lbl: string, i: number) => {
    if (CAPTURE_LABELS.includes(lbl)) mapped.set(lbl, statsRow[i] ?? '—');
  });

  // Calculate TS% = PTS / (2 × (FGA + 0.44 × FTA))
  // FG and FT are "made-attempted" strings like "8.0-16.5"
  let tsPercent: StatItem | null = null;
  try {
    const pts = parseFloat(mapped.get('PTS') ?? '');
    const fga = parseFloat((mapped.get('FG') ?? '').split('-')[1] ?? '');
    const fta = parseFloat((mapped.get('FT') ?? '').split('-')[1] ?? '');
    if (!isNaN(pts) && !isNaN(fga) && !isNaN(fta) && (fga + fta) > 0) {
      const ts = pts / (2 * (fga + 0.44 * fta));
      tsPercent = { label: 'TS%', value: (ts * 100).toFixed(1) };
    }
  } catch { /* skip */ }

  const stats: StatItem[] = SHOW_LABELS
    .filter(lbl => mapped.has(lbl))
    .map(lbl => ({ label: lbl, value: mapped.get(lbl)! }))
    .filter(({ value }) => value !== '—' && value !== '0' && value !== '0.0');

  if (tsPercent) stats.push(tsPercent);

  console.log(`[player-stats] athleteId=${athleteId} → ${stats.map(s => `${s.label}:${s.value}`).join(' ')}`);
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
