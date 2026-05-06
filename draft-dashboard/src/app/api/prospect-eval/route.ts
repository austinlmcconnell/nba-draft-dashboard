// Server-side route: per-prospect evaluation breakdown for the 2026 Big Board.
//
// For each player on the Big Board, joins the Google Sheet entry to their
// 2025-26 BartTorvik stats (prospect_stats_2026.json) and surfaces:
//   - Offense: pts/40 from rim, mid, three; ast%; orb%
//   - Defense: stl%, blk%, drb%
//   - Physical: height_in, weight_lb, wingspan_in, athleticism
//   - Age
// Plus the per-location FG% and shot share, so the UI can show both.

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type { BigBoardPlayer, AthleticismRating } from '@/types/bigboard';

export const dynamic = 'force-dynamic';

const SHEET_ID = process.env.BIG_BOARD_SHEET_ID ?? '1X0l92tV3ZPAiWsJ_-NEINBtVv50kYix7s4EbKHK-XxM';
const RANGE    = 'Sheet1!A2:N200';
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY;

let cache: { data: ProspectEvalApiResponse; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// ─── Source row from prospect_stats_2026.json ────────────────────────────────
type ProspectStatsRow = {
  name: string; team: string; conference: string;
  class_year: string | null; height: string | null; position: string | null;
  games: number; min_pct: number; mp_total: number | null;
  prpg: number;
  adj_ortg: number | null; adj_drtg: number | null;
  usage: number | null; ts_pct: number | null; efg_pct: number | null;
  orb_pct: number | null; drb_pct: number | null;
  ast_pct: number | null; tov_pct: number | null;
  blk_pct: number | null; stl_pct: number | null; ft_rate: number | null;
  ftm: number; fta: number; ft_pct: number | null;
  two_pm: number; two_pa: number; two_pct: number | null;
  three_pm: number; three_pa: number; three_pct: number | null;
  rim_made: number; rim_att: number;
  mid_made: number; mid_att: number;
  rim_pct: number | null; mid_pct: number | null;
};

// ─── Output shape ────────────────────────────────────────────────────────────
export interface ProspectEvalEntry {
  // Identity
  rank: number;
  name: string;
  slug: string;
  school: string;
  position: string;
  // Sheet-sourced
  draftAge: number | null;
  heightInches: number | null;
  weightPounds: number | null;
  wingspanInches: number | null;
  athleticism: AthleticismRating;
  // Stat coverage
  hasStats: boolean;
  games: number | null;
  // Offense — points/40 by location (combines volume + efficiency)
  rimPts40: number | null;
  midPts40: number | null;
  threePts40: number | null;
  rimFgPct: number | null;
  midFgPct: number | null;
  threeFgPct: number | null;
  rimShare: number | null;       // % of FGA at rim
  midShare: number | null;       // % of FGA on 2pt jumpers
  threeShare: number | null;     // % of FGA from three
  // Passing + offensive boards
  astPct: number | null;
  astTov: number | null;
  orbPct: number | null;
  // Defense
  stlPct: number | null;
  blkPct: number | null;
  drbPct: number | null;
}

export interface ProspectEvalApiResponse {
  entries: ProspectEvalEntry[];
  updatedAt: string;
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function slugify(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "6'9\"" or "6-9" → 81
function parseHeightInches(s: string): number | null {
  const m = s.match(/(\d+)\s*[-'](\d+)/);
  if (!m) return null;
  return parseInt(m[1]) * 12 + parseInt(m[2]);
}

function parseBigBoardRow(row: string[]): BigBoardPlayer | null {
  const name = (row[1] ?? '').trim();
  if (!name) return null;
  const athVals = ['Bad', 'Below Average', 'Average', 'Above Average', 'Great'] as const;
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
    athleticism:     athVals.find(v => v === (row[13] ?? '').trim()) ?? null,
  };
}

function readJson<T>(filename: string): T {
  const p = path.join(process.cwd(), 'public', 'data', filename);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

// ─── Compute per-40-min points from a shot bucket ─────────────────────────────
// Uses (FGM × point_value × 40) / minutes_played. Combines volume + efficiency.
function ptsPer40(made: number, value: number, totalMin: number | null): number | null {
  if (!totalMin || totalMin <= 0) return null;
  return Math.round(((made * value * 40) / totalMin) * 100) / 100;
}

// Total minutes played: prefer mp_total, fall back to games × inferred mpg.
function totalMinutes(s: ProspectStatsRow): number | null {
  if (s.mp_total && s.mp_total > 0) return s.mp_total;
  // min_pct is % of available team mins played (0-100). Each game = 40 team mins
  // per player slot × 5 slots = 200 player-mins available. min_pct alone gives
  // approximate fraction but without team game count we can't precisely back
  // into minutes. Approximation: min_pct% of (games × 40) ≈ player minutes.
  if (s.games > 0 && s.min_pct > 0) {
    return Math.round(s.games * 40 * (s.min_pct / 100));
  }
  return null;
}

function shotShare(att: number, totalFga: number): number | null {
  if (totalFga <= 0) return null;
  return Math.round((att / totalFga) * 1000) / 10; // %, 1 dp
}

function pct1(v: number | null): number | null {
  if (v == null) return null;
  // BartTorvik returns FG% as decimals (0.4283) — convert to %
  return Math.round(v * 1000) / 10;
}

// ─── Main ────────────────────────────────────────────────────────────────────
export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json<ProspectEvalApiResponse>(cache.data);
  }

  if (!API_KEY) {
    return NextResponse.json<ProspectEvalApiResponse>(
      { entries: [], updatedAt: new Date().toISOString(), error: 'GOOGLE_SHEETS_API_KEY not set' },
      { status: 500 },
    );
  }

  try {
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    const sheetsRes = await fetch(sheetsUrl, { cache: 'no-store' });
    if (!sheetsRes.ok) throw new Error(`Sheets API ${sheetsRes.status}`);
    const sheetsJson = await sheetsRes.json();
    const board: BigBoardPlayer[] = ((sheetsJson.values ?? []) as string[][])
      .map(parseBigBoardRow)
      .filter((p): p is BigBoardPlayer => p !== null)
      .sort((a, b) => a.rank - b.rank);

    const stats = readJson<Record<string, ProspectStatsRow>>('prospect_stats_2026.json');

    const entries: ProspectEvalEntry[] = board.map(bb => {
      const s = stats[normalize(bb.name)] ?? null;
      const heightIn  = parseHeightInches(bb.height);
      const wingspanIn = parseHeightInches(bb.wingspan);

      if (!s) {
        return {
          rank: bb.rank, name: bb.name, slug: bb.slug,
          school: bb.school, position: bb.position,
          draftAge: bb.draftAge || null,
          heightInches: heightIn, weightPounds: bb.weight || null, wingspanInches: wingspanIn,
          athleticism: bb.athleticism,
          hasStats: false, games: null,
          rimPts40: null, midPts40: null, threePts40: null,
          rimFgPct: null, midFgPct: null, threeFgPct: null,
          rimShare: null, midShare: null, threeShare: null,
          astPct: null, astTov: null, orbPct: null,
          stlPct: null, blkPct: null, drbPct: null,
        };
      }

      const totalMin = totalMinutes(s);
      const totalFga = s.two_pa + s.three_pa;
      const tov_per100 = s.tov_pct ?? 0;       // turnover rate
      const ast_per100 = s.ast_pct ?? 0;       // assist rate
      const astTov     = tov_per100 > 0 ? Math.round((ast_per100 / tov_per100) * 100) / 100 : null;

      return {
        rank: bb.rank, name: bb.name, slug: bb.slug,
        school: bb.school, position: bb.position,
        draftAge: bb.draftAge || null,
        heightInches: heightIn, weightPounds: bb.weight || null, wingspanInches: wingspanIn,
        athleticism: bb.athleticism,
        hasStats: true,
        games: s.games || null,
        // Points from each location, per 40 min played
        rimPts40:   ptsPer40(s.rim_made, 2, totalMin),
        midPts40:   ptsPer40(s.mid_made, 2, totalMin),
        threePts40: ptsPer40(s.three_pm, 3, totalMin),
        // FG% in each zone (display-friendly %)
        rimFgPct:   pct1(s.rim_pct),
        midFgPct:   pct1(s.mid_pct),
        threeFgPct: pct1(s.three_pct),
        // Shot diet shares (% of all FGA)
        rimShare:   shotShare(s.rim_att, totalFga),
        midShare:   shotShare(s.mid_att, totalFga),
        threeShare: shotShare(s.three_pa, totalFga),
        // Passing + ORB
        astPct: s.ast_pct,
        astTov,
        orbPct: s.orb_pct,
        // Defense
        stlPct: s.stl_pct,
        blkPct: s.blk_pct,
        drbPct: s.drb_pct,
      };
    });

    const result: ProspectEvalApiResponse = { entries, updatedAt: new Date().toISOString() };
    cache = { data: result, ts: Date.now() };
    return NextResponse.json<ProspectEvalApiResponse>(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ProspectEvalApiResponse>(
      { entries: [], updatedAt: new Date().toISOString(), error: message },
      { status: 502 },
    );
  }
}
