/**
 * Player Comparison Algorithm
 *
 * Three comparison lenses per prospect:
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
 *   overall — Best single comparable blending both dimensions.
 *     Scored as: 70% × stat_sim + 25% × phys_sim + 5% × age_sim
 *     Searched by maximising this blended score so that no single dimension
 *     (e.g. a physically-identical but statistically-dissimilar player) can
 *     dominate the result.
 *     Falls back to statistical-only when prospect has no physical data.
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

  // Weighted total — defence and rebounding raised to better discriminate
  // positional roles; scoring efficiency reduced slightly (sums to 1.0)
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
    const ws1 = zScore(a.wingspan_inches, n.height_inches); // same scale as height
    const ws2 = zScore(b.wingspan_inches, n.height_inches);
    return Math.sqrt(0.40 * sq(h1, h2) + 0.30 * sq(w1, w2) + 0.20 * sq(ws1, ws2));
  }

  return Math.sqrt(0.55 * sq(h1, h2) + 0.45 * sq(w1, w2));
}

// ---------------------------------------------------------------------------
// Distance → 0-100 similarity score
// similarity = 100 × e^(−dist / k)
// ---------------------------------------------------------------------------
function sim(dist: number, k = 3): number {
  return Math.max(0, Math.min(100, 100 * Math.exp(-dist / k)));
}

// ---------------------------------------------------------------------------
// Public: compute all three comparisons for a prospect
// ---------------------------------------------------------------------------

export function getProspectComparisons(
  prospectStats: CollegeStats,
  prospectPhysical: PhysicalAttributes | undefined | null,
  pool: HistoricalPlayer[],
  norms: DatasetNorms
): ProspectComparisons {
  const pVec = toStatVec(prospectStats, norms);
  const hasPhys = (p: PhysicalAttributes | undefined | null): p is PhysicalAttributes =>
    !!p && (p.height_inches != null || p.weight_pounds != null);

  const prospectAge = prospectPhysical?.age_at_season_start;

  type Row = {
    player: HistoricalPlayer;
    // Statistical facets
    sDist: number; sEff: number; sVol: number; sPlay: number; sReb: number; sDef: number;
    sSim: number;   // 0-100 statistical similarity (sim(sDist))
    // Physical
    pDist: number | null;
    pSim:  number;  // 0-100 physical similarity, 0 when unavailable
    // Age
    ageSim: number; // 0-100, defaults to 100 when age data is missing (neutral)
    // Overall blended score (used for search AND as displayed score)
    oSim: number;
  };

  const rows: Row[] = pool.map(hist => {
    const hVec = toStatVec(hist.college_stats, norms);
    const s    = statDistance(pVec, hVec);
    const sSim = sim(s.total);

    let pDist: number | null = null;
    let pSim  = 0;
    if (hasPhys(prospectPhysical) && hasPhys(hist.physical)) {
      pDist = physDistance(prospectPhysical, hist.physical, norms);
      pSim  = sim(pDist, 1.5);
    }

    // Age similarity — only meaningful when both players have the field.
    // When missing, default to 100 (no penalty) so existing age data still
    // helps distinguish comps without penalising players with no data.
    let ageSim = 100;
    const histAge = hist.physical?.age_at_season_start;
    if (
      prospectAge != null && histAge != null &&
      norms.age_at_season_start && norms.age_at_season_start.std_dev > 0
    ) {
      const zA = zScore(prospectAge, norms.age_at_season_start);
      const zB = zScore(histAge,     norms.age_at_season_start);
      ageSim = sim(Math.abs(zA - zB), 1.5); // 1 year apart ≈ notable difference
    }

    // Overall blended similarity: maximising this is fairer than minimising a
    // blended distance because each dimension's exponential decay is applied
    // before combining — a physically-perfect-but-statistically-different
    // player can no longer beat a well-rounded match.
    const oSim = pDist != null
      ? 0.70 * sSim + 0.25 * pSim + 0.05 * ageSim
      : sSim;

    return {
      player: hist,
      sDist: s.total, sEff: s.eff, sVol: s.vol, sPlay: s.play, sReb: s.reb, sDef: s.def,
      sSim, pDist, pSim, ageSim, oSim,
    };
  });

  function make(row: Row, type: ComparisonType, score: number): PlayerComparison {
    return {
      historical_player: row.player,
      comparison_type: type,
      similarity_score: Math.round(score * 10) / 10,
      breakdown: {
        scoring_efficiency: Math.round(sim(row.sEff)),
        scoring_volume:     Math.round(sim(row.sVol, 2)),
        playmaking:         Math.round(sim(row.sPlay)),
        rebounding:         Math.round(sim(row.sReb)),
        defense:            Math.round(sim(row.sDef)),
        physical:           row.pDist != null ? Math.round(row.pSim) : 0,
      },
    };
  }

  // Statistical: minimum stat distance
  const byStat = [...rows].sort((a, b) => a.sDist - b.sDist)[0];

  let physical: PlayerComparison | null = null;
  let byOverall: Row;

  // Per-facet similarity helper — used for the floor check and tie-break logic.
  const facetSims = (r: Row) => ({
    eff:  sim(r.sEff),
    vol:  sim(r.sVol, 2),
    play: sim(r.sPlay),
    reb:  sim(r.sReb),
    def:  sim(r.sDef),
  });
  const minFacetSim = (r: Row): number => {
    const f = facetSims(r);
    return Math.min(f.eff, f.vol, f.play, f.reb, f.def);
  };

  // Physical comp: restricted to players who have physical measurements.
  if (hasPhys(prospectPhysical)) {
    const withPhys = rows.filter(r => r.pDist != null);
    if (withPhys.length > 0) {
      const sortedPhys = withPhys.slice().sort((a, b) => a.pDist! - b.pDist!);
      physical = make(sortedPhys[0], 'physical', sortedPhys[0].pSim);
    }
  }

  // Overall comp — facet-floor enforcement with progressive relaxation.
  //
  // Goal: the displayed comp should have no individual facet below 70%.
  // If no player in the 6 800+ pool clears all five floors simultaneously
  // (very unusual — typically means an extreme statistical outlier prospect),
  // we relax the floor in 5-point steps until we find qualifying candidates.
  // The last-resort fallback picks the most *balanced* match (player with the
  // highest minimum facet score) rather than the highest raw oSim, minimising
  // the chance of showing a wildly lopsided comp.
  const FLOORS = [70, 65, 60, 55, 50];
  let overallPool: Row[] = [];
  for (const floor of FLOORS) {
    const filtered = rows.filter(r => minFacetSim(r) >= floor);
    if (filtered.length > 0) {
      overallPool = filtered;
      break;
    }
  }
  // True last resort: no player hit even the 50% floor — pick most balanced.
  if (overallPool.length === 0) {
    // Sort by minFacetSim desc so the "least bad" facet gap wins.
    overallPool = rows.slice().sort((a, b) => minFacetSim(b) - minFacetSim(a)).slice(0, 50);
  }
  byOverall = overallPool.slice().sort((a, b) => b.oSim - a.oSim)[0];

  return {
    statistical: make(byStat,    'statistical', byStat.sSim),
    physical,
    overall:     make(byOverall, 'overall',     byOverall.oSim),
  };
}
