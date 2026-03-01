/**
 * Data loading and transformation utilities.
 *
 * Raw JSON (flat dicts from Python scraper) → TypeScript types.
 * Data files live in /public/data/ and are fetched at runtime.
 * Results are cached in module-level variables after first load.
 */

import type {
  CollegePlayer,
  CollegeStats,
  HistoricalPlayer,
  PhysicalAttributes,
  DatasetNorms,
} from '@/types/player';

import { buildDatasetNorms } from './comparison';

let historicalCache: HistoricalPlayer[] | null = null;
let prospectsCache: CollegePlayer[] | null = null;
let normsCache: DatasetNorms | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCollegeStats(raw: any): CollegeStats {
  const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
  return {
    games:                      n(raw.games),
    minutes_per_game:           n(raw.minutes_per_game),
    points_per_game:            n(raw.points_per_game),
    rebounds_per_game:          n(raw.rebounds_per_game),
    assists_per_game:           n(raw.assists_per_game),
    steals_per_game:            n(raw.steals_per_game),
    blocks_per_game:            n(raw.blocks_per_game),
    turnovers_per_game:         n(raw.turnovers_per_game),
    field_goal_percentage:      n(raw.field_goal_percentage),
    three_point_percentage:     n(raw.three_point_percentage),
    free_throw_percentage:      n(raw.free_throw_percentage),
    pts_per36:                  n(raw.pts_per36),
    reb_per36:                  n(raw.reb_per36),
    ast_per36:                  n(raw.ast_per36),
    stl_per36:                  n(raw.stl_per36),
    blk_per36:                  n(raw.blk_per36),
    tov_per36:                  n(raw.tov_per36),
    true_shooting_pct:          n(raw.true_shooting_pct),
    effective_fg_pct:           n(raw.effective_fg_pct),
    usage_rate:                 n(raw.usage_rate),
    free_throw_rate:            n(raw.free_throw_rate),
    three_pt_attempts_per_game: n(raw.three_pt_attempts_per_game),
    ast_tov_ratio:              n(raw.ast_tov_ratio),
    oreb_pct:                   n(raw.oreb_pct),
    net_rating:                 n(raw.net_rating),
    win_shares_per40:           n(raw.win_shares_per40),
    porpag:                     n(raw.porpag),
    offensive_rating:           n(raw.offensive_rating),
    defensive_rating:           n(raw.defensive_rating),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPhysical(raw: any): PhysicalAttributes {
  return {
    height_inches:       raw?.height_inches        ?? null,
    weight_pounds:       raw?.weight_pounds        ?? null,
    wingspan_inches:     raw?.wingspan_inches       ?? null,
    age_at_season_start: raw?.age_at_season_start  ?? null,
  };
}

export async function loadHistoricalPlayers(): Promise<HistoricalPlayer[]> {
  if (historicalCache) return historicalCache;
  try {
    const res = await fetch('/data/nba_career_stats.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await res.json();
    historicalCache = raw.map(r => ({
      id:             r.id ?? `hist_${r.name}_${r.college_season}`,
      name:           r.name,
      college_team:   r.college_team ?? '',
      college_season: r.college_season ?? 0,
      college_stats:  toCollegeStats(r.college_stats ?? r),
      physical:       toPhysical(r.physical),
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
    }));
    return historicalCache;
  } catch (e) {
    console.error('Failed to load historical player data:', e);
    return [];
  }
}

export async function loadProspects(season = 2024): Promise<CollegePlayer[]> {
  if (prospectsCache) return prospectsCache;
  try {
    const res = await fetch('/data/historical_college_stats.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = await res.json();
    prospectsCache = raw
      .filter(r => r.season === season)
      .map(r => ({
        id:         `prospect_${r.athlete_id ?? r.name.replace(/\s+/g, '_').toLowerCase()}_${r.season}`,
        name:       r.name,
        team:       r.team,
        season:     r.season,
        position:   r.position ?? 'G',
        conference: r.conference ?? '',
        athlete_id: r.athlete_id,
        stats:      toCollegeStats(r),
        physical:   undefined,
      }));
    return prospectsCache;
  } catch (e) {
    console.error('Failed to load prospect data:', e);
    return [];
  }
}

export async function getDatasetNorms(): Promise<DatasetNorms | null> {
  if (normsCache) return normsCache;
  const historical = await loadHistoricalPlayers();
  if (historical.length === 0) return null;
  normsCache = buildDatasetNorms(historical);
  return normsCache;
}

export async function getProspectById(id: string): Promise<CollegePlayer | null> {
  const prospects = await loadProspects();
  return prospects.find(p => p.id === id) ?? null;
}

export function clearDataCache() {
  historicalCache = null;
  prospectsCache  = null;
  normsCache      = null;
}
