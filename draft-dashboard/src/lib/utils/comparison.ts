/**
 * Player Comparison Algorithm
 *
 * Three comparison lenses per prospect:
 *
 *   statistical — Who produced the most similarly on the court?
 *     Per-36 stats + efficiency rates, z-score normalised across the dataset.
 *     Five basketball-analytics facets (evidence-based weights):
 *       Scoring efficiency  (TS%, usage, FT rate, 3P%)               28%
 *       Scoring volume      (Pts/36)                                  18%
 *       Playmaking          (Ast/36, AST/TOV, TOV/36)                 22%
 *       Rebounding          (Reb/36, ORB%)                            16%
 *       Defense             (Stl/36, Blk/36)                          16%
 *
 *   physical — Who shared the most similar physical profile?
 *     Height 55%, weight 45% (wingspan 20% when available, redistributed).
 *
 *   overall — Best single comparable blending both dimensions.
 *     Statistical 70% + physical 30%.
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

  return {
    pts_per36:                  get(s => s.pts_per36),
    reb_per36:                  get(s => s.reb_per36),
    ast_per36:                  get(s => s.ast_per36),
    stl_per36:                  get(s => s.stl_per36),
    blk_per36:                  get(s => s.blk_per36),
    tov_per36:                  get(s => s.tov_per36),
    true_shooting_pct:          get(s => s.true_shooting_pct),
    usage_rate:                 get(s => s.usage_rate),
    free_throw_rate:            get(s => s.free_throw_rate),
    three_point_pct:            get(s => s.three_point_percentage),
    ast_tov_ratio:              get(s => s.ast_tov_ratio),
    oreb_pct:                   get(s => s.oreb_pct),
    win_shares_per40:           get(s => s.win_shares_per40),
    net_rating:                 get(s => s.net_rating),
    height_inches:              makeParams(heights),
    weight_pounds:              makeParams(weights),
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
    ts_pct:    zScore(s.true_shooting_pct,    n.true_shooting_pct),
    usage:     zScore(s.usage_rate,           n.usage_rate),
    ft_rate:   zScore(s.free_throw_rate,      n.free_throw_rate),
    three_pct: zScore(s.three_point_percentage, n.three_point_pct),
    pts36:      zScore(s.pts_per36,                  n.pts_per36),
    ast36:      zScore(s.ast_per36,                  n.ast_per36),
    ast_tov:    zScore(s.ast_tov_ratio,              n.ast_tov_ratio),
    tov36:      zScore(s.tov_per36,                  n.tov_per36),
    reb36:      zScore(s.reb_per36,                  n.reb_per36),
    oreb_pct:   zScore(s.oreb_pct,                   n.oreb_pct),
    stl36:      zScore(s.stl_per36,                  n.stl_per36),
    blk36:      zScore(s.blk_per36,                  n.blk_per36),
  };
}

function sq(a: number, b: number) { return (a - b) ** 2; }

function statDistance(a: StatVec, b: StatVec) {
  const eff  = Math.sqrt(sq(a.ts_pct, b.ts_pct) + sq(a.usage, b.usage) + sq(a.ft_rate, b.ft_rate) + sq(a.three_pct, b.three_pct));
  const vol  = Math.abs(a.pts36 - b.pts36);
  const play = Math.sqrt(sq(a.ast36, b.ast36) + sq(a.ast_tov, b.ast_tov) + sq(a.tov36, b.tov36));
  const reb  = Math.sqrt(sq(a.reb36, b.reb36) + sq(a.oreb_pct, b.oreb_pct));
  const def  = Math.sqrt(sq(a.stl36, b.stl36) + sq(a.blk36, b.blk36));

  // Weighted total (analytics-informed, sums to 1.0)
  const total = eff * 0.28 + vol * 0.18 + play * 0.22 + reb * 0.16 + def * 0.16;

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

  type Row = {
    player: HistoricalPlayer;
    sDist: number; sEff: number; sVol: number; sPlay: number; sReb: number; sDef: number;
    pDist: number | null;
    oDist: number;
  };

  const rows: Row[] = pool.map(hist => {
    const hVec = toStatVec(hist.college_stats, norms);
    const s = statDistance(pVec, hVec);

    let pDist: number | null = null;
    if (hasPhys(prospectPhysical) && hasPhys(hist.physical)) {
      pDist = physDistance(prospectPhysical, hist.physical, norms);
    }

    const oDist = pDist != null ? s.total * 0.70 + pDist * 0.30 : s.total;

    return {
      player: hist,
      sDist: s.total, sEff: s.eff, sVol: s.vol, sPlay: s.play, sReb: s.reb, sDef: s.def,
      pDist,
      oDist,
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
        physical:           row.pDist != null ? Math.round(sim(row.pDist, 1.5)) : 0,
      },
    };
  }

  const byStat = [...rows].sort((a, b) => a.sDist - b.sDist)[0];

  let physical: PlayerComparison | null = null;
  let byOverall: Row;

  if (hasPhys(prospectPhysical)) {
    // Restrict physical and overall searches to historical players that ALSO
    // have physical data.  Without this, overall collapses into statistical
    // because players lacking measurements all get oDist = sDist.
    const withPhys = rows.filter(r => r.pDist != null);

    if (withPhys.length > 0) {
      const sortedPhys = withPhys.slice().sort((a, b) => a.pDist! - b.pDist!);
      physical = make(sortedPhys[0], 'physical', sim(sortedPhys[0].pDist!, 1.5));
      byOverall = withPhys.slice().sort((a, b) => a.oDist - b.oDist)[0];
    } else {
      byOverall = [...rows].sort((a, b) => a.oDist - b.oDist)[0];
    }
  } else {
    byOverall = [...rows].sort((a, b) => a.oDist - b.oDist)[0];
  }

  return {
    statistical: make(byStat,    'statistical', sim(byStat.sDist)),
    physical,
    overall:     make(byOverall, 'overall',     sim(byOverall.oDist)),
  };
}
