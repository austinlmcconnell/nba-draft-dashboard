// Server-side YouTube search for player highlight reels.
// Uses the YouTube Data API v3 to find the best highlight video
// for a given player. Results are cached in memory for 24 hours
// so we don't hammer the API quota.
//
// GET /api/highlights?name=Cooper+Flagg&school=Duke&season=2025-26

import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_API_KEY = process.env.GOOGLE_SHEETS_API_KEY; // same key, just needs YouTube Data API v3 enabled
const SEARCH_URL      = 'https://www.googleapis.com/youtube/v3/search';

// In-memory cache: slug → { videoId, cachedAt }
const cache = new Map<string, { videoId: string | null; cachedAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function buildQuery(name: string, school: string): string {
  // Prefer season-specific highlights for more relevant results
  const isInternational = !school || school.length <= 3 ||
    ['France', 'Australia', 'Spain', 'Canada', 'Serbia', 'Germany', 'Italy',
     'Nigeria', 'Turkey', 'Lithuania', 'Senegal', 'Slovenia', 'Denmark', 'Latvia'].includes(school);

  const schoolPart = isInternational ? school : `${school}`;
  return `${name} ${schoolPart} basketball highlights 2025 2026`;
}

async function searchYouTube(query: string): Promise<string | null> {
  if (!YOUTUBE_API_KEY) return null;

  const params = new URLSearchParams({
    part:       'id',
    q:          query,
    type:       'video',
    maxResults: '5',
    videoDuration: 'medium', // 4–20 min — avoids 30s clips and full games
    key:        YOUTUBE_API_KEY,
  });

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    next: { revalidate: 86400 }, // cache at the fetch layer too
  });

  if (!res.ok) return null;

  const data = await res.json();
  const items: Array<{ id: { videoId: string } }> = data.items ?? [];
  return items[0]?.id?.videoId ?? null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const name   = (searchParams.get('name')   ?? '').trim();
  const school = (searchParams.get('school') ?? '').trim();

  if (!name) {
    return NextResponse.json({ videoId: null, error: 'name is required' }, { status: 400 });
  }

  const cacheKey = `${name}::${school}`.toLowerCase();

  // Return cached result if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json({ videoId: cached.videoId, cached: true });
  }

  if (!YOUTUBE_API_KEY) {
    return NextResponse.json({
      videoId: null,
      error:   'GOOGLE_SHEETS_API_KEY not set, or YouTube Data API v3 not enabled on the key',
    });
  }

  try {
    const query   = buildQuery(name, school);
    const videoId = await searchYouTube(query);

    cache.set(cacheKey, { videoId, cachedAt: Date.now() });

    return NextResponse.json(
      { videoId, query },
      { headers: { 'Cache-Control': 'private, max-age=86400' } }
    );
  } catch (err) {
    return NextResponse.json(
      { videoId: null, error: String(err) },
      { status: 502 }
    );
  }
}
