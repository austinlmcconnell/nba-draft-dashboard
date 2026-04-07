/**
 * ESPN auto-lookup route.
 * GET /api/espn-lookup?name=Darius+Acuff+Jr&school=Arkansas
 * GET /api/espn-lookup?name=Jalen+Brunson&sport=nba
 *
 * Uses ESPN's public search API (site.web.api.espn.com/apis/search/v2).
 * Athlete ID is extracted from the `uid` field (format: s:40~l:41~a:{id}).
 * Results cached in-memory for 7 days.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ESPNResult {
  athleteId:   number | null;
  headshotUrl: string | null;
  teamName:    string | null; // e.g. "New York Knicks" or "Arkansas Razorbacks"
}

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Origin':          'https://www.espn.com',
  'Referer':         'https://www.espn.com/',
};

// ─── In-memory cache (7-day TTL) ─────────────────────────────────────────────
const cache = new Map<string, ESPNResult & { cachedAt: number }>();
const TTL   = 7 * 24 * 60 * 60 * 1000;

// ─── Name scoring ─────────────────────────────────────────────────────────────
function scoreMatch(displayName: string, subtitle: string, name: string, school: string): number {
  let score = 0;
  const nameLower  = name.toLowerCase().trim();
  const candLower  = displayName.toLowerCase();
  const parts      = nameLower.split(/\s+/);
  const lastName   = parts[parts.length - 1];
  const firstName  = parts[0];

  if (candLower === nameLower)              score += 100;
  else if (candLower.includes(nameLower))  score +=  80;
  else {
    if (candLower.endsWith(lastName))      score +=  50;
    else if (candLower.includes(lastName)) score +=  35;
    if (candLower.startsWith(firstName))   score +=  20;
  }

  if (school) {
    const subLower    = subtitle.toLowerCase();
    const schoolWords = school.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of schoolWords) {
      if (subLower.includes(word)) { score += 30; break; }
    }
  }

  return score;
}

// ─── Main search ──────────────────────────────────────────────────────────────
async function searchESPN(name: string, school: string, sport: string): Promise<ESPNResult> {
  const league = sport === 'nba' ? 'nba' : 'mens-college-basketball';
  const url    = `https://site.web.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=10&type=player&sport=basketball&league=${league}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    console.warn(`[espn-lookup] search returned ${res.status} for "${name}"`);
    return { athleteId: null, headshotUrl: null, teamName: null };
  }

  const data = await res.json();
  const playerResults = (data.results ?? []).find((r: any) => r.type === 'player');
  const contents: any[] = playerResults?.contents ?? [];

  let best: any  = null;
  let bestScore  = 0;

  for (const c of contents) {
    const s = scoreMatch(c.displayName ?? '', c.subtitle ?? '', name, school);
    if (s > bestScore) { bestScore = s; best = c; }
  }

  if (!best || bestScore === 0) {
    console.warn(`[espn-lookup] no match for "${name}" (${school}), candidates: ${contents.map((c: any) => c.displayName).join(', ')}`);
    return { athleteId: null, headshotUrl: null, teamName: null };
  }

  // Extract numeric athlete ID from uid: "s:40~l:41~a:5142620"
  const uidMatch = (best.uid ?? '').match(/a:(\d+)/);
  const athleteId = uidMatch ? parseInt(uidMatch[1]) : null;

  const result: ESPNResult = {
    athleteId,
    headshotUrl: best.image?.default ?? null,
    teamName:    best.subtitle       ?? null,
  };

  console.log(`[espn-lookup] "${name}" → id=${result.athleteId} team="${result.teamName}" score=${bestScore}`);
  return result;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name   = (searchParams.get('name')   ?? '').trim();
  const school = (searchParams.get('school') ?? '').trim();
  const sport  = (searchParams.get('sport')  ?? 'mens-college-basketball').trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const key    = `${sport}::${name.toLowerCase()}::${school.toLowerCase()}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.cachedAt < TTL) {
    return NextResponse.json<ESPNResult>(
      { athleteId: cached.athleteId, headshotUrl: cached.headshotUrl, teamName: cached.teamName },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } }
    );
  }

  const result = await searchESPN(name, school, sport);
  cache.set(key, { ...result, cachedAt: Date.now() });

  return NextResponse.json<ESPNResult>(result, {
    headers: { 'Cache-Control': 'public, s-maxage=86400' },
  });
}
