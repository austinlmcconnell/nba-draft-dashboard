/**
 * ESPN auto-lookup route.
 * GET /api/espn-lookup?name=Cooper+Flagg&school=Duke
 *
 * Searches ESPN's unofficial college basketball athlete API to find
 * the ESPN athlete ID and team ID for a prospect. Results are cached
 * in-memory for 7 days so repeat renders are instant.
 */

import { NextRequest, NextResponse } from 'next/server';

interface ESPNResult {
  athleteId: number | null;
  teamId: number | null;
}

// ─── In-memory cache (7-day TTL) ─────────────────────────────────────────────
const cache = new Map<string, ESPNResult & { cachedAt: number }>();
const TTL   = 7 * 24 * 60 * 60 * 1000;

// ─── ESPN search ─────────────────────────────────────────────────────────────
async function searchESPN(name: string, school: string): Promise<ESPNResult> {
  const encoded = encodeURIComponent(name);

  // 1️⃣  Try college basketball first
  const cbUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/athletes?search=${encoded}&limit=10`;
  const cbRes  = await fetch(cbUrl, { next: { revalidate: 86400 } });

  if (cbRes.ok) {
    const data = await cbRes.json();
    const athletes: any[] = data.athletes ?? [];

    // Prefer exact name match; fall back to first result
    const nameLower   = name.toLowerCase();
    const schoolLower = school.toLowerCase();

    const match =
      athletes.find(a => a.fullName?.toLowerCase() === nameLower) ??
      athletes.find(a => {
        const teamName = a.team?.displayName?.toLowerCase() ?? '';
        return a.fullName?.toLowerCase().includes(nameLower.split(' ').pop()!) &&
               teamName.includes(schoolLower.split(' ')[0]);
      }) ??
      athletes[0];

    if (match) {
      return {
        athleteId: match.id   ? parseInt(match.id)      : null,
        teamId:    match.team?.id ? parseInt(match.team.id) : null,
      };
    }
  }

  // 2️⃣  Fallback: ESPN site search (broader)
  const siteUrl = `https://site.api.espn.com/apis/common/v3/search?query=${encoded}&limit=5&type=athlete&sport=basketball`;
  const siteRes  = await fetch(siteUrl, { next: { revalidate: 86400 } });

  if (siteRes.ok) {
    const data = await siteRes.json();
    const hits  = (data.results ?? []).flatMap((r: any) => r.contents ?? []);
    const hit   = hits.find((h: any) => h.type === 'athlete');
    if (hit) {
      return { athleteId: hit.id ? parseInt(hit.id) : null, teamId: null };
    }
  }

  return { athleteId: null, teamId: null };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name   = (searchParams.get('name')   ?? '').trim();
  const school = (searchParams.get('school') ?? '').trim();

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const key    = `${name.toLowerCase()}::${school.toLowerCase()}`;
  const cached = cache.get(key);

  if (cached && Date.now() - cached.cachedAt < TTL) {
    return NextResponse.json<ESPNResult>(
      { athleteId: cached.athleteId, teamId: cached.teamId },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } }
    );
  }

  try {
    const result = await searchESPN(name, school);
    cache.set(key, { ...result, cachedAt: Date.now() });

    return NextResponse.json<ESPNResult>(result, {
      headers: { 'Cache-Control': 'public, s-maxage=86400' },
    });
  } catch (err) {
    console.error('[espn-lookup]', err);
    return NextResponse.json<ESPNResult>({ athleteId: null, teamId: null });
  }
}
