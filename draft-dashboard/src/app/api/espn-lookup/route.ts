/**
 * ESPN auto-lookup route.
 * GET /api/espn-lookup?name=Cooper+Flagg&school=Duke
 * GET /api/espn-lookup?name=LeBron+James&sport=nba
 *
 * Tries multiple ESPN API strategies to find the best athlete match.
 * Results cached in-memory for 7 days.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ESPNResult {
  athleteId: number | null;
  teamId:    number | null;
}

// Mimic a browser so ESPN doesn't reject the request
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
function scoreMatch(candidate: any, name: string, school: string): number {
  let score = 0;
  const nameLower  = name.toLowerCase().trim();
  const parts      = nameLower.split(/\s+/);
  const lastName   = parts[parts.length - 1];
  const firstName  = parts[0];

  // Try multiple name fields ESPN uses
  const fullName = (
    candidate.fullName     ??
    candidate.displayName  ??
    candidate.name         ?? ''
  ).toLowerCase();

  const teamName = (
    candidate.team?.displayName ??
    candidate.team?.name        ??
    candidate.college?.name     ?? ''
  ).toLowerCase();

  // Name scoring
  if (fullName === nameLower)             score += 100;
  else if (fullName.includes(nameLower))  score +=  80;
  else {
    if (fullName.endsWith(lastName))      score +=  50;
    else if (fullName.includes(lastName)) score +=  35;
    if (fullName.startsWith(firstName))   score +=  20;
  }

  // School scoring
  if (school && teamName) {
    const schoolWords = school.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of schoolWords) {
      if (teamName.includes(word)) { score += 30; break; }
    }
  }

  return score;
}

function extractResult(athlete: any): ESPNResult {
  const rawId     = athlete.id     ?? athlete.athleteId ?? null;
  const rawTeamId = athlete.team?.id ?? null;
  return {
    athleteId: rawId     ? parseInt(String(rawId))     : null,
    teamId:    rawTeamId ? parseInt(String(rawTeamId)) : null,
  };
}

// ─── Strategy 1: sport-specific athlete search ────────────────────────────────
async function tryAthleteSearch(name: string, school: string, sport: string): Promise<ESPNResult | null> {
  const queries = Array.from(new Set([name, name.split(' ').pop()!]));

  let best: any    = null;
  let bestScore    = 0;

  for (const q of queries) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${sport}/athletes?search=${encodeURIComponent(q)}&limit=15`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;

      const data = await res.json();
      // ESPN may return athletes under different keys
      const athletes: any[] = data.athletes ?? data.items ?? data.data ?? [];

      for (const a of athletes) {
        const s = scoreMatch(a, name, school);
        if (s > bestScore) { bestScore = s; best = a; }
      }
      if (bestScore >= 80) break;
    } catch { /* next */ }
  }

  if (best && bestScore > 0) return extractResult(best);
  return null;
}

// ─── Strategy 2: ESPN common search (works across all sports) ─────────────────
async function tryCommonSearch(name: string, school: string): Promise<ESPNResult | null> {
  try {
    const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&limit=10&type=athlete`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;

    const data = await res.json();
    const hits: any[] = (data.results ?? []).flatMap((r: any) => r.contents ?? []);

    let best: any  = null;
    let bestScore  = 0;

    for (const hit of hits) {
      if (hit.type !== 'athlete') continue;
      const s = scoreMatch({ fullName: hit.displayName ?? hit.name, team: hit.team }, name, school);
      if (s > bestScore) { bestScore = s; best = hit; }
    }

    if (best && bestScore > 0) {
      return {
        athleteId: best.id ? parseInt(String(best.id)) : null,
        teamId:    best.team?.id ? parseInt(String(best.team.id)) : null,
      };
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Strategy 3: ESPN suggest/autocomplete ───────────────────────────────────
async function trySuggest(name: string, school: string): Promise<ESPNResult | null> {
  try {
    const url = `https://ac.espn.com/now/ac?query=${encodeURIComponent(name)}&limit=5&type=player&sport=basketball`;
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;

    const data = await res.json();
    const items: any[] = data.items ?? data.results ?? [];

    let best: any  = null;
    let bestScore  = 0;

    for (const item of items) {
      const s = scoreMatch({ fullName: item.displayName ?? item.name, team: { displayName: item.teamName } }, name, school);
      if (s > bestScore) { bestScore = s; best = item; }
    }

    if (best && bestScore > 0) {
      return { athleteId: best.id ? parseInt(String(best.id)) : null, teamId: null };
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Main search (tries all strategies in order) ──────────────────────────────
async function searchESPN(name: string, school: string, sport: string): Promise<ESPNResult> {
  const result =
    await tryAthleteSearch(name, school, sport) ??
    await tryCommonSearch(name, school)          ??
    await trySuggest(name, school)               ??
    { athleteId: null, teamId: null };

  console.log(`[espn-lookup] "${name}" (${school}) → athleteId=${result.athleteId} teamId=${result.teamId}`);
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
      { athleteId: cached.athleteId, teamId: cached.teamId },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } }
    );
  }

  const result = await searchESPN(name, school, sport);
  cache.set(key, { ...result, cachedAt: Date.now() });

  return NextResponse.json<ESPNResult>(result, {
    headers: { 'Cache-Control': 'public, s-maxage=86400' },
  });
}
