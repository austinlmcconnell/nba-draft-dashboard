// Server-side proxy for the Google Sheets API.
// Keeps the API key out of the browser bundle.
// Returns Austin's ranked big board data as JSON.

import { NextResponse } from 'next/server';
import type { BigBoardPlayer, BigBoardApiResponse, AthleticismRating } from '@/types/bigboard';

const ATHLETICISM_VALUES: Exclude<AthleticismRating, null>[] = [
  'Bad', 'Below Average', 'Average', 'Above Average', 'Great',
];
function parseAthleticism(raw: string | undefined): AthleticismRating {
  const v = (raw ?? '').trim();
  return (ATHLETICISM_VALUES as string[]).includes(v) ? (v as AthleticismRating) : null;
}

// Force dynamic so Next.js never pre-renders or ISR-caches this route.
// The client already polls every 60 s; server-side caching just adds lag.
export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.BIG_BOARD_SHEET_ID ?? '1X0l92tV3ZPAiWsJ_-NEINBtVv50kYix7s4EbKHK-XxM';
const RANGE    = 'Sheet1!A2:N200'; // skip header row; allow up to 200 prospects
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseRow(row: string[]): BigBoardPlayer | null {
  const name = (row[1] ?? '').trim();
  if (!name) return null; // skip empty rows

  return {
    rank:            parseInt(row[0]) || 0,
    name,
    slug:            slugify(name),
    draftAge:        parseFloat(row[2]) || 0,
    school:          (row[3] ?? '').trim(),
    position:        (row[4] ?? '').trim(),
    height:          (row[5] ?? '').trim(),
    weight:          parseInt(row[6]) || 0,
    wingspan:        (row[7] ?? '').trim(),
    nbaComparison:   (row[8] ?? '').trim(),
    biggestSkill:    (row[9] ?? '').trim(),
    biggestWeakness: (row[10] ?? '').trim(),
    mockPickNo:      row[11] ? parseInt(row[11]) || null : null,
    mockTeam:        (row[12] ?? '').trim() || null,
    athleticism:     parseAthleticism(row[13]),
  };
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json<BigBoardApiResponse>(
      { players: [], updatedAt: new Date().toISOString(), error: 'GOOGLE_SHEETS_API_KEY not set' },
      { status: 500 }
    );
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API ${res.status}: ${body}`);
    }

    const json = await res.json();
    const rows: string[][] = json.values ?? [];

    const players = rows
      .map(parseRow)
      .filter((p): p is BigBoardPlayer => p !== null)
      .sort((a, b) => a.rank - b.rank);

    return NextResponse.json<BigBoardApiResponse>(
      { players, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json<BigBoardApiResponse>(
      { players: [], updatedAt: new Date().toISOString(), error: message },
      { status: 502 }
    );
  }
}
