/**
 * Player Comparison Algorithm
 *
 * Two comparison lenses per prospect:
 *
 *   statistical — Who produced the most similarly on the court?
 *     Per-36 stats + efficiency rates, z-score normalised across the dataset.
 *     Five basketball-analytics facets (evidence-based weights):
 *       Scoring efficiency  (TS%, usage, FT rate, 3P%)               25%
 *       Scoring volume      (Pts/36)                                  16%
 *       Playmaking          (Ast/36, AST/TOV, TOV/36)                 20%
 *       Rebounding          (Reb/36, ORB%)                            19%
 *       Defense             (Stl/36, Blk/36)                          20%
 *
 *   physical — Who shared the most similar physical profile?
 *     Height 55%, weight 45% (wingspan redistributes: h 40%, w 30%, ws 20%
 *     when available from NBA Draft Combine).
 *
 * Returns top 5 matches for each lens. Index 0 is the best match.
 */

import type {
  CollegeStats,
  HistoricalPlayer,
  PhysicalAttributes,
  PlayerComparison,
  ProspectComparisons,
  DatasetNorms,
  NormParams,
  ComparisonType,
} from '../../types/player';

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function zScore(value: number, p: NormParams): number {
  return p.std_dev === 0 ? 0 : (value - p.mean) / p.std_dev;
}

function makeParams(vals: number[]): NormParams {
  if (vals.length === 0) return { mean: 0, std_dev: 1 };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std_dev = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
  return { mean, std_dev };
}

export function buildDatasetNorms(players: HistoricalPlayer[]): DatasetNorms {
  const get = (fn: (s: CollegeStats) => number) =>
    makeParams(players.map(p => fn(p.college_stats)).filter(v => isFinite(v) && v != null));

  const heights = players.map(p => p.physical?.height_inches).filter((v): v is number => v != null && v > 0);
  const weights = players.map(p => p.physical?.weight_pounds).filter((v): v is number => v != null && v > 0);
  const ages    = players.map(p => p.physical?.age_at_season_start).filter((v): v is number => v != null && v > 10);

  return {
    pts_per36:              get(s => s.pts_per36),
    reb_per36:              get(s => s.reb_per36),
    ast_per36:              get(s => s.ast_per36),
    stl_per36:              get(s => s.stl_per36),
    blk_per36:              get(s => s.blk_per36),
    tov_per36:              get(s => s.tov_per36),
    true_shooting_pct:      get(s => s.true_shooting_pct),
    usage_rate:             get(s => s.usage_rate),
    free_throw_rate:        get(s => s.free_throw_rate),
    three_point_pct:        get(s => s.three_point_percentage),
    ast_tov_ratio:          get(s => s.ast_tov_ratio),
    oreb_pct:               get(s => s.oreb_pct),
    win_shares_per40:       get(s => s.win_shares_per40),
    net_rating:             get(s => s.net_rating),
    height_inches:          makeParams(heights),
    weight_pounds:          makeParams(weights),
    age_at_season_start:    makeParams(ages),
  };
}

// ---------------------------------------------------------------------------
// Statistical distance
// ---------------------------------------------------------------------------

interface StatVec {
  ts_pct: number; usage: number; ft_rate: number; three_pct: number;
  pts36: number;
  ast36: number; ast_tov: number; tov36: number;
  reb36: number; oreb_pct: number;
  stl36: number; blk36: number;
}

function toStatVec(s: CollegeStats, n: DatasetNorms): StatVec {
  return {
    ts_pct:    zScore(s.true_shooting_pct,      n.true_shooting_pct),
    usage:     zScore(s.usage_rate,             n.usage_rate),
    ft_rate:   zScore(s.free_throw_rate,        n.free_throw_rate),
    three_pct: zScore(s.three_point_percentage, n.three_point_pct),
    pts36:     zScore(s.pts_per36,              n.pts_per36),
    ast36:     zScore(s.ast_per36,              n.ast_per36),
    ast_tov:   zScore(s.ast_tov_ratio,          n.ast_tov_ratio),
    tov36:     zScore(s.tov_per36,              n.tov_per36),
    reb36:     zScore(s.reb_per36,              n.reb_per36),
    oreb_pct:  zScore(s.oreb_pct,               n.oreb_pct),
    stl36:     zScore(s.stl_per36,              n.stl_per36),
    blk36:     zScore(s.blk_per36,              n.blk_per36),
  };
}

function sq(a: number, b: number) { return (a - b) ** 2; }

function statDistance(a: StatVec, b: StatVec) {
  const eff  = Math.sqrt(sq(a.ts_pct, b.ts_pct) + sq(a.usage, b.usage) + sq(a.ft_rate, b.ft_rate) + sq(a.three_pct, b.three_pct));
  const vol  = Math.abs(a.pts36 - b.pts36);
  const play = Math.sqrt(sq(a.ast36, b.ast36) + sq(a.ast_tov, b.ast_tov) + sq(a.tov36, b.tov36));
  const reb  = Math.sqrt(sq(a.reb36, b.reb36) + sq(a.oreb_pct, b.oreb_pct));
  const def  = Math.sqrt(sq(a.stl36, b.stl36) + sq(a.blk36, b.blk36));

  const total = eff * 0.25 + vol * 0.16 + play * 0.20 + reb * 0.19 + def * 0.20;

  return { total, eff, vol, play, reb, def };
}

// ---------------------------------------------------------------------------
// Physical distance
// ---------------------------------------------------------------------------

function physDistance(a: PhysicalAttributes, b: PhysicalAttributes, n: DatasetNorms) {
  const h1 = a.height_inches != null ? zScore(a.height_inches, n.height_inches) : 0;
  const h2 = b.height_inches != null ? zScore(b.height_inches, n.height_inches) : 0;
  const w1 = a.weight_pounds != null ? zScore(a.weight_pounds, n.weight_pounds) : 0;
  const w2 = b.weight_pounds != null ? zScore(b.weight_pounds, n.weight_pounds) : 0;

  if (a.wingspan_inches != null && b.wingspan_inches != null) {
    const ws1 = zScore(a.wingspan_inches, n.height_inches);
    const ws2 = zScore(b.wingspan_inches, n.height_inches);
    return Math.sqrt(0.40 * sq(h1, h2) + 0.30 * sq(w1, w2) + 0.20 * sq(ws1, ws2));
  }

  return Math.sqrt(0.55 * sq(h1, h2) + 0.45 * sq(w1, w2));
}

// ---------------------------------------------------------------------------
// Distance → 0-100 similarity score
// similarity = 100 × e^(−dist / k)
//
// k constants — larger k = gentler decay = higher scores for close matches:
//   K_STAT  = 5.0  statistical facets (broad tolerance; was 3.0)
//   K_VOL   = 3.0  scoring volume sub-component (was 2.0)
//   K_PHYS  = 2.0  physical distance (was 1.5)
//   K_AGE   = 1.5  age distance (unchanged)
// ---------------------------------------------------------------------------
const K_STAT = 5.0;
const K_VOL  = 3.0;
const K_PHYS = 2.0;
const K_AGE  = 1.5;

function sim(dist: number, k = K_STAT): number {
  return Math.max(0, Math.min(100, 100 * Math.exp(-dist / k)));
}

// ---------------------------------------------------------------------------
// Position grouping — used to restrict the comparison pool so guards aren't
// compared against forwards/centres and vice-versa.
//
// Group map:
//   G  ← G, PG, SG
//   F  ← F, SF, PF, ATH
//   C  ← C
//   G  or F ← G-F (wing; included in both)
//   F  or C ← F-C (stretch big; included in both)
// ---------------------------------------------------------------------------
export function posGroup(pos: string | undefined): 'G' | 'F' | 'C' | 'G-F' | 'F-C' | null {
  if (!pos) return null;
  const p = pos.trim().toUpperCase();
  if (p === 'G-F') return 'G-F';
  if (p === 'F-C') return 'F-C';
  if (['G', 'PG', 'SG'].includes(p)) return 'G';
  if (['F', 'SF', 'PF', 'ATH'].includes(p)) return 'F';
  if (p === 'C') return 'C';
  return null;
}

/** Returns true if the historical player's position group is compatible with the prospect's. */
function positionCompatible(prospectPos: string | undefined, histPos: string | undefined): boolean {
  const pg = posGroup(prospectPos);
  const hg = posGroup(histPos);
  if (pg === null || hg === null) return true; // missing data → don't restrict
  if (pg === hg) return true;
  // Hybrid positions are included in adjacent groups
  if (pg === 'G' && hg === 'G-F') return true;
  if (pg === 'F' && (hg === 'G-F' || hg === 'F-C')) return true;
  if (pg === 'C' && hg === 'F-C') return true;
  if (pg === 'G-F' && (hg === 'G' || hg === 'F')) return true;
  if (pg === 'F-C' && (hg === 'F' || hg === 'C')) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Public: compute statistical and physical comparisons for a prospect
// ---------------------------------------------------------------------------

export function getProspectComparisons(
  prospectStats: CollegeStats,
  prospectPhysical: PhysicalAttributes | undefined | null,
  pool: HistoricalPlayer[],
  norms: DatasetNorms,
  prospectPosition?: string,
): ProspectComparisons {
  // Filter pool to same position group. If too few players pass the filter,
  // fall back to the full pool so we always have enough comps.
  const MIN_POSITION_POOL = 50;
  const posFiltered = pool.filter(h => positionCompatible(prospectPosition, h.position));
  const effectivePool = posFiltered.length >= MIN_POSITION_POOL ? posFiltered : pool;
  const pVec = toStatVec(prospectStats, norms);
  const hasPhys = (p: PhysicalAttributes | undefined | null): p is PhysicalAttributes =>
    !!p && (p.height_inches != null || p.weight_pounds != null);

  function make(
    player: HistoricalPlayer,
    type: ComparisonType,
    score: number,
    sEff: number, sVol: number, sPlay: number, sReb: number, sDef: number,
    pDist: number | null,
    pSim: number
  ): PlayerComparison {
    return {
      historical_player: player,
      comparison_type: type,
      similarity_score: Math.round(score * 10) / 10,
      breakdown: {
        scoring_efficiency: Math.round(sim(sEff,  K_STAT)),
        scoring_volume:     Math.round(sim(sVol,  K_VOL)),
        playmaking:         Math.round(sim(sPlay, K_STAT)),
        rebounding:         Math.round(sim(sReb,  K_STAT)),
        defense:            Math.round(sim(sDef,  K_STAT)),
        physical:           pDist != null ? Math.round(pSim) : 0,
      },
    };
  }

  // Compute statistical distances for all players in the pool.
  // Sort key: blend of weighted-average facet similarity and minimum facet
  // similarity (70/30). This penalises lopsided comps while keeping the
  // weighted average dominant — a player who is wildly dissimilar in one
  // facet is still penalised, but not as harshly as in the old 50/50 split.
  //   blended_sim = 0.7 × weighted_avg + 0.3 × min_facet
  const statRows = effectivePool
    .map(hist => {
      const hVec = toStatVec(hist.college_stats, norms);
      const s = statDistance(pVec, hVec);

      const sEff  = sim(s.eff,  K_STAT);
      const sVol  = sim(s.vol,  K_VOL);
      const sPlay = sim(s.play, K_STAT);
      const sReb  = sim(s.reb,  K_STAT);
      const sDef  = sim(s.def,  K_STAT);

      const weightedAvg = sEff * 0.25 + sVol * 0.16 + sPlay * 0.20 + sReb * 0.19 + sDef * 0.20;
      const minFacet    = Math.min(sEff, sVol, sPlay, sReb, sDef);
      const blendedSim  = 0.7 * weightedAvg + 0.3 * minFacet;

      let pDist: number | null = null;
      let pSimVal = 0;
      if (hasPhys(prospectPhysical) && hasPhys(hist.physical)) {
        pDist = physDistance(prospectPhysical, hist.physical, norms);
        pSimVal = sim(pDist, K_PHYS);
      }

      return { hist, s, sEff, sVol, sPlay, sReb, sDef, blendedSim, pDist, pSimVal };
    })
    .sort((a, b) => b.blendedSim - a.blendedSim);

  const statistical: PlayerComparison[] = statRows.slice(0, 5).map(r =>
    make(r.hist, 'statistical', r.blendedSim, r.s.eff, r.s.vol, r.s.play, r.s.reb, r.s.def, r.pDist, r.pSimVal)
  );

  // Physical comparisons — only players with physical data, sorted by physical distance
  let physical: PlayerComparison[] = [];
  if (hasPhys(prospectPhysical)) {
    const physRows = effectivePool
      .filter(hist => hasPhys(hist.physical))
      .map(hist => {
        const hVec = toStatVec(hist.college_stats, norms);
        const s = statDistance(pVec, hVec);
        const pDist = physDistance(prospectPhysical, hist.physical, norms);
        const pSimVal = sim(pDist, K_PHYS);
        return { hist, s, pDist, pSimVal };
      })
      .sort((a, b) => a.pDist - b.pDist);

    physical = physRows.slice(0, 5).map(r =>
      make(r.hist, 'physical', r.pSimVal, r.s.eff, r.s.vol, r.s.play, r.s.reb, r.s.def, r.pDist, r.pSimVal)
    );
  }

  return { statistical, physical };
}
