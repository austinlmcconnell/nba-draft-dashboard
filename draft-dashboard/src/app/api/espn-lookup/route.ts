/**
 * ESPN auto-lookup route.
 * GET /api/espn-lookup?name=Cooper+Flagg&school=Duke
 * GET /api/espn-lookup?name=LeBron+James&sport=nba
 *
 * Searches ESPN's unofficial athlete API to find the ESPN athlete ID
 * and team ID for a prospect or NBA player. Uses a scoring algorithm
 * to find the best match by name + school. Results are cached in-memory
 * for 7 days so repeat renders are instant.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ESPNResult {
  athleteId: number | null;
  teamId:    number | null;
}

// ─── In-memory cache (7-day TTL) ─────────────────────────────────────────────
const cache = new Map<string, ESPNResult & { cachedAt: number }>();
const TTL   = 7 * 24 * 60 * 60 * 1000;

// ─── Scoring helper ───────────────────────────────────────────────────────────
function scoreMatch(athlete: any, name: string, school: string): number {
  let score = 0;
  const fullName  = (athlete.fullName  ?? '').toLowerCase();
  const teamName  = (athlete.team?.displayName ?? athlete.team?.name ?? '').toLowerCase();
  const nameLower = name.toLowerCase();

  const parts     = nameLower.trim().split(/\s+/);
  const lastName  = parts[parts.length - 1];
  const firstName = parts[0];

  // ── Name scoring ──
  if (fullName === nameLower)                      score += 100; // exact match
  else if (fullName.includes(nameLower))           score +=  80; // full name substring
  else {
    if (fullName.endsWith(lastName))               score +=  50; // last name exact end
    else if (fullName.includes(lastName))          score +=  30; // last name anywhere
    if (fullName.startsWith(firstName))            score +=  20; // first name
  }

  // ── School scoring (college only) ──
  if (school) {
    const schoolWords = school.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    for (const word of schoolWords) {
      if (teamName.includes(word)) score += 25;
    }
  }

  return score;
}

// ─── ESPN search ──────────────────────────────────────────────────────────────
async function searchESPN(name: string, school: string, sport: string): Promise<ESPNResult> {
  const parts    = name.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];

  // Try multiple query strategies: full name first, then last name only
  const queries = Array.from(new Set([name, lastName])).map(encodeURIComponent);

  let bestMatch: any    = null;
  let bestScore: number = 0;

  for (const encoded of queries) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/${sport}/athletes?search=${encoded}&limit=15`;

    try {
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) continue;

      const data       = await res.json();
      const athletes: any[] = data.athletes ?? [];

      for (const athlete of athletes) {
        const score = scoreMatch(athlete, name, school);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = athlete;
        }
      }
    } catch { /* continue to next query */ }

    // If we found a high-confidence match, stop searching
    if (bestScore >= 80) break;
  }

  if (bestMatch && bestScore > 0) {
    return {
      athleteId: bestMatch.id       ? parseInt(bestMatch.id)       : null,
      teamId:    bestMatch.team?.id ? parseInt(bestMatch.team.id)  : null,
    };
  }

  // ── Fallback: ESPN site-wide search ──────────────────────────────────────
  try {
    const siteUrl = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(name)}&limit=5&type=athlete&sport=basketball`;
    const siteRes = await fetch(siteUrl, { next: { revalidate: 86400 } });

    if (siteRes.ok) {
      const data = await siteRes.json();
      const hits = (data.results ?? []).flatMap((r: any) => r.contents ?? []);
      const hit  = hits.find((h: any) => h.type === 'athlete');
      if (hit) return { athleteId: hit.id ? parseInt(hit.id) : null, teamId: null };
    }
  } catch { /* ignore */ }

  return { athleteId: null, teamId: null };
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

  try {
    const result = await searchESPN(name, school, sport);
    cache.set(key, { ...result, cachedAt: Date.now() });

    return NextResponse.json<ESPNResult>(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400' },
    });
  } catch (err) {
    console.error('[espn-lookup]', err);
    return NextResponse.json<ESPNResult>({ athleteId: null, teamId: null });
  }
}
