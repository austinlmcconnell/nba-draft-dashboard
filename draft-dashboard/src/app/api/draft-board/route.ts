// Server-side route: ranks Big Board prospects by average career VORP
// of their 10 closest historical college statistical comparisons.
//
// Flow:
//   1. Fetch Big Board from Google Sheets
//   2. Read historical college stats + VORP lookup + BartTorvik lookup from disk
//   3. For each Big Board player, find their current-season college stats
//   4. Run top-10 stat comparison against drafted players 2008+ with BartTorvik
//      data AND a minimum 1,500 career NBA minutes (filters out noise from
//      cup-of-coffee NBA careers), PRPG! primary similarity
//   5. Average the career VORP of the comps → ranking signal
//   6. Return sorted list (best avg VORP first)

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type {
  HistoricalPlayer, DraftBoardEntry, DraftBoardApiResponse, VorpLookup,
  BartTorvikStats,
} from '@/types/player';
import { buildDatasetNorms, getTopStatComps, resolveAge } from '@/lib/utils/comparison';
import type { BigBoardPlayer } from '@/types/bigboard';

// Minimum career NBA minutes required for a historical player to appear as
// a comp. Roughly one season of rotation-level play. Filters out draftees
// who never established themselves in the league (Cameron Bairstow, etc.)
// whose sample-sized career metrics would distort the avg-VORP ranking.
const MIN_NBA_MP = 1500;

type BartTorvikEntry = {
  name: string;
  team: string;
  season: number;
  class_year?: string;
  prpg: number;
  adj_ortg: number | null;
  adj_drtg: number | null;
};
type BartTorvikLookup = Record<string, BartTorvikEntry>;

export const dynamic = 'force-dynamic';

// ─── Google Sheets config (mirrors /api/big-board) ───────────────────────────
const SHEET_ID = process.env.BIG_BOARD_SHEET_ID ?? '1X0l92tV3ZPAiWsJ_-NEINBtVv50kYix7s4EbKHK-XxM';
const RANGE    = 'Sheet1!A2:M200';
const API_KEY  = process.env.GOOGLE_SHEETS_API_KEY;

// ─── In-memory cache (5-minute TTL) ──────────────────────────────────────────
let cache: { data: DraftBoardApiResponse; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// ─── Name normalization (must match build_vorp_lookup.py) ────────────────────
function normalizeForVorp(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv|v)\.?\s*$/i, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Name normalization (must match build_barttorvik_lookup.py) ──────────────
function normalizeForBart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip diacritics
    .toLowerCase()
    .replace(/['`'']/g, '')
    .replace(/\b(jr\.?|sr\.?|ii|iii|iv)\b/g, '')
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Fuzzy name matching (for finding Big Board players in prospects DB) ──────
const SUFFIX_RE = /\s+\b(jr|sr|ii|iii|iv|v)\b\.?\s*$/i;
function normName(n: string) {
  return n.toLowerCase().replace(SUFFIX_RE, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
}
function nameSimilar(a: string, b: string): boolean {
  const na = normName(a), nb = normName(b);
  if (na === nb) return true;
  const pa = na.split(' '), pb = nb.split(' ');
  if (pa.length >= 2 && pb.length >= 2) {
    if (pa.at(-1) === pb.at(-1) && pa[0].slice(0, 3) === pb[0].slice(0, 3)) return true;
  }
  return false;
}

// ─── Parse Big Board row ──────────────────────────────────────────────────────
function parseBigBoardRow(row: string[]): BigBoardPlayer | null {
  const name = (row[1] ?? '').trim();
  if (!name) return null;
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
  };
}

// ─── Data loading helpers (server-side fs) ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readJson(filename: string): any {
  const p = path.join(process.cwd(), 'public', 'data', filename);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function computeTS(raw: Record<string, number>): number {
  const ppg = raw.points_per_game ?? 0;
  const fgPct = (raw.field_goal_percentage ?? 0) / 100;
  const ftPct = (raw.free_throw_percentage ?? 0) / 100;
  const ftr = (raw.free_throw_rate ?? 0) / 100;
  if (ppg <= 0 || fgPct <= 0) return 0;
  const denom = 2 * fgPct + ftPct * ftr;
  if (denom <= 0) return 0;
  const fgaEst = ppg / denom;
  return (ppg / (2 * (fgaEst + 0.44 * ftr * fgaEst))) * 100;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStats(raw: any) {
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  const apg = n(raw.assists_per_game), tpg = n(raw.turnovers_per_game);
  const ts  = n(raw.true_shooting_pct) || computeTS(raw);
  return {
    games: n(raw.games), minutes_per_game: n(raw.minutes_per_game),
    points_per_game: n(raw.points_per_game), rebounds_per_game: n(raw.rebounds_per_game),
    offensive_rebounds_per_game: n(raw.offensive_rebounds_per_game),
    defensive_rebounds_per_game: n(raw.defensive_rebounds_per_game),
    assists_per_game: apg, steals_per_game: n(raw.steals_per_game),
    blocks_per_game: n(raw.blocks_per_game), turnovers_per_game: tpg,
    field_goal_percentage: n(raw.field_goal_percentage),
    three_point_percentage: n(raw.three_point_percentage),
    free_throw_percentage: n(raw.free_throw_percentage),
    pts_per36: n(raw.pts_per36), reb_per36: n(raw.reb_per36), ast_per36: n(raw.ast_per36),
    stl_per36: n(raw.stl_per36), blk_per36: n(raw.blk_per36), tov_per36: n(raw.tov_per36),
    true_shooting_pct: ts, effective_fg_pct: n(raw.effective_fg_pct),
    usage_rate: n(raw.usage_rate), free_throw_rate: n(raw.free_throw_rate),
    three_pt_attempts_per_game: 0,
    ast_tov_ratio: n(raw.ast_tov_ratio) || (tpg > 0 ? apg / tpg : 0),
    oreb_pct: n(raw.oreb_pct), net_rating: n(raw.net_rating),
    win_shares_per40: n(raw.win_shares_per40), porpag: n(raw.porpag),
    offensive_rating: n(raw.offensive_rating), defensive_rating: n(raw.defensive_rating),
  };
}

function toBartStats(entry: BartTorvikEntry | undefined): BartTorvikStats | undefined {
  if (!entry || typeof entry.prpg !== 'number') return undefined;
  return {
    prpg: entry.prpg,
    adj_ortg: entry.adj_ortg,
    adj_drtg: entry.adj_drtg,
    class_year: entry.class_year,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toHistoricalPlayer(r: any, bart?: BartTorvikLookup): HistoricalPlayer {
  const bartEntry = bart
    ? bart[`${normalizeForBart(r.name)}|${r.college_season}`]
    : undefined;
  return {
    id:           r.id ?? `hist_${r.name}_${r.college_season}`,
    name:         r.name,
    college_team: r.college_team ?? '',
    college_season: r.college_season ?? 0,
    college_stats:  toStats(r.college_stats ?? r),
    physical: {
      height_inches:       r.physical?.height_inches       ?? null,
      weight_pounds:       r.physical?.weight_pounds       ?? null,
      wingspan_inches:     r.physical?.wingspan_inches     ?? null,
      age_at_season_start: r.physical?.age_at_season_start ?? null,
    },
    nba_career: {
      seasons_played: r.nba_career?.seasons_played ?? 0,
      games_played:   r.nba_career?.games_played   ?? 0,
      career_ppg:     r.nba_career?.career_ppg     ?? 0,
      career_rpg:     r.nba_career?.career_rpg     ?? 0,
      career_apg:     r.nba_career?.career_apg     ?? 0,
      career_spg:     r.nba_career?.career_spg     ?? null,
      career_bpg:     r.nba_career?.career_bpg     ?? null,
      career_tov:     r.nba_career?.career_tov     ?? null,
      career_fg_pct:  r.nba_career?.career_fg_pct  ?? 0,
      career_3p_pct:  r.nba_career?.career_3p_pct  ?? 0,
      career_ft_pct:  r.nba_career?.career_ft_pct  ?? 0,
      is_active:      r.nba_career?.is_active       ?? false,
    },
    draft_year:  r.draft_year  ?? null,
    draft_round: r.draft_round ?? null,
    draft_pick:  r.draft_pick  ?? null,
    position:    r.college_stats?.position ?? undefined,
    barttorvik:  toBartStats(bartEntry),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json<DraftBoardApiResponse>(cache.data);
  }

  if (!API_KEY) {
    return NextResponse.json<DraftBoardApiResponse>(
      { entries: [], updatedAt: new Date().toISOString(), error: 'GOOGLE_SHEETS_API_KEY not set' },
      { status: 500 },
    );
  }

  try {
    // 1. Fetch Big Board
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}?key=${API_KEY}`;
    const sheetsRes = await fetch(sheetsUrl, { cache: 'no-store' });
    if (!sheetsRes.ok) throw new Error(`Sheets API ${sheetsRes.status}`);
    const sheetsJson = await sheetsRes.json();
    const bigBoard: BigBoardPlayer[] = ((sheetsJson.values ?? []) as string[][])
      .map(parseBigBoardRow)
      .filter((p): p is BigBoardPlayer => p !== null)
      .sort((a, b) => a.rank - b.rank);

    if (bigBoard.length === 0) {
      const resp = { entries: [], updatedAt: new Date().toISOString() };
      cache = { data: resp, ts: Date.now() };
      return NextResponse.json<DraftBoardApiResponse>(resp);
    }

    // 2. Load data files
    const vorpLookup: VorpLookup = readJson('vorp_lookup.json');
    const bartLookup: BartTorvikLookup = readJson('barttorvik_lookup.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historicalRaw: any[] = readJson('nba_career_stats.json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prospectsRaw: any[]  = readJson('historical_college_stats.json');

    // 3. Build comparison pool: drafted players 2008-present with BartTorvik
    //    data AND at least MIN_NBA_MP career minutes in the VORP lookup.
    //    2008 is the earliest BartTorvik season (matches PRPG! coverage).
    //    Restricting to drafted players removes mid-major statistical
    //    doppelgangers whose careers diverged from scouted prospects, and the
    //    MP floor filters out draftees who never established NBA rotation roles.
    const pool: HistoricalPlayer[] = historicalRaw
      .filter(r => {
        if (r.draft_pick == null) return false;
        if (r.college_season < 2008 || r.college_season >= 2026) return false;
        if (!(`${normalizeForBart(r.name)}|${r.college_season}` in bartLookup)) return false;
        const vorp = vorpLookup[normalizeForVorp(r.name)];
        return vorp != null && vorp.mp >= MIN_NBA_MP;
      })
      .map(r => toHistoricalPlayer(r, bartLookup));

    // 4. Build norms from the full historical pool (not just the pool subset)
    //    so z-scores stay calibrated across the whole dataset
    const fullPool: HistoricalPlayer[] = historicalRaw
      .filter(r => r.college_season < 2026)
      .map(r => toHistoricalPlayer(r, bartLookup));
    const norms = buildDatasetNorms(fullPool);

    // 5. Current-season prospects (for finding Big Board players' stats)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentProspects: any[] = prospectsRaw.filter((r: any) => r.season === 2026);

    // 6. Build entries
    const entries: DraftBoardEntry[] = bigBoard.map(bb => {
      // Find this Big Board player in the current prospects dataset
      const match = currentProspects.find(p =>
        nameSimilar(p.name, bb.name) &&
        (normName(p.team) === normName(bb.school) || normName(bb.school) === ''),
      ) ?? currentProspects.find(p => nameSimilar(p.name, bb.name));

      if (!match) {
        return {
          name: bb.name, slug: bb.slug, school: bb.school,
          position: bb.position, bigBoardRank: bb.rank,
          mockPickNo: bb.mockPickNo, mockTeam: bb.mockTeam,
          comps: [], avgVorp: null, vorpCoverage: 0,
        };
      }

      const prospectStats = toStats(match);
      const prospectBart  = bartLookup[`${normalizeForBart(match.name)}|${match.season}`];
      const prospectPrpg  = prospectBart?.prpg;
      const prospectAge   = resolveAge(match.age_at_season_start, prospectBart?.class_year);
      const topComps = getTopStatComps(
        prospectStats, prospectPrpg, prospectAge,
        pool, norms, match.position ?? bb.position, 10,
      );

      const comps = topComps.map(c => {
        const key   = normalizeForVorp(c.historical_player.name);
        const entry = vorpLookup[key] ?? null;
        return {
          name:         c.historical_player.name,
          collegeSeason: c.historical_player.college_season,
          collegeTeam:  c.historical_player.college_team,
          position:     c.historical_player.position ?? '',
          similarity:   c.similarity_score,
          vorp:        entry?.vorp    ?? null,
          vorpMp:      entry?.mp      ?? null,
          vorpSeasons: entry?.seasons ?? null,
        };
      });

      const vorpComps = comps.filter(c => c.vorp !== null);
      const avgVorp = vorpComps.length > 0
        ? vorpComps.reduce((s, c) => s + c.vorp!, 0) / vorpComps.length
        : null;

      return {
        name: bb.name, slug: bb.slug, school: bb.school,
        position: bb.position, bigBoardRank: bb.rank,
        mockPickNo: bb.mockPickNo, mockTeam: bb.mockTeam,
        comps,
        avgVorp: avgVorp !== null ? Math.round(avgVorp * 100) / 100 : null,
        vorpCoverage: vorpComps.length,
      };
    });

    // 7. Sort by avg VORP descending (nulls last)
    entries.sort((a, b) => {
      if (a.avgVorp === null && b.avgVorp === null) return 0;
      if (a.avgVorp === null) return 1;
      if (b.avgVorp === null) return -1;
      return b.avgVorp - a.avgVorp;
    });

    const result: DraftBoardApiResponse = { entries, updatedAt: new Date().toISOString() };
    cache = { data: result, ts: Date.now() };

    return NextResponse.json<DraftBoardApiResponse>(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json<DraftBoardApiResponse>(
      { entries: [], updatedAt: new Date().toISOString(), error: message },
      { status: 502 },
    );
  }
}
