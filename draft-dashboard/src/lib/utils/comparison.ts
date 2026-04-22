/**
 * Player Comparison Algorithm
 *
 * Two comparison lenses per prospect:
 *
 *   statistical — Who produced the most similarly on the court?
 *
 *     Primary (65%): BartTorvik PRPG! similarity
 *       PRPG! (Points per Replacement Per Game) is a per-possession, tempo-
 *       and competition-adjusted single-number player value that captures
 *       both offensive and defensive impact. It's the single best freely-
 *       available college metric and does the heavy lifting here.
 *
 *     Secondary (35%): raw statistical archetype facets
 *       These keep comps tethered to the right play style after PRPG!
 *       filters for quality. Total 35% split proportionally:
 *         Scoring & Shooting (9.1%)  — FG%, FT%, FT rate, 3P%, usage, off_rtg (0.5×)
 *         Scoring Volume    (3.85%)  — Pts/36
 *         Playmaking        (6.3%)   — Ast/36, AST/TOV, TOV/36
 *         Rebounding        (7.0%)   — Reb/36, ORB/36, DRB/36
 *         Defense           (8.75%)  — Stl/36, Blk/36, def_rtg (0.5×)
 *
 *     When PRPG! is unavailable (missing BartTorvik match), the raw facets
 *     are used at their original weights as a fallback.
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

function safeDiv(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/** Derive the stats that are not pre-computed in the dataset. */
function derivedStats(s: CollegeStats) {
  return {
    orb_per36:   safeDiv(s.offensive_rebounds_per_game, s.minutes_per_game) * 36,
    drb_per36:   safeDiv(s.defensive_rebounds_per_game, s.minutes_per_game) * 36,
    ast_tov:     safeDiv(s.ast_per36, Math.max(s.tov_per36, 0.1)),
  };
}

export function buildDatasetNorms(players: HistoricalPlayer[]): DatasetNorms {
  const get = (fn: (s: CollegeStats) => number) =>
    makeParams(players.map(p => fn(p.college_stats)).filter(v => isFinite(v) && v != null));

  const getDerived = (fn: (s: CollegeStats) => number) =>
    makeParams(players.map(p => fn(p.college_stats)).filter(v => isFinite(v) && v != null && v > 0));

  const heights = players.map(p => p.physical?.height_inches).filter((v): v is number => v != null && v > 0);
  const weights = players.map(p => p.physical?.weight_pounds).filter((v): v is number => v != null && v > 0);
  const ages    = players.map(p => p.physical?.age_at_season_start).filter((v): v is number => v != null && v > 10);
  const prpgs   = players.map(p => p.barttorvik?.prpg).filter((v): v is number => typeof v === 'number' && isFinite(v));

  return {
    pts_per36:        get(s => s.pts_per36),
    reb_per36:        get(s => s.reb_per36),
    ast_per36:        get(s => s.ast_per36),
    stl_per36:        get(s => s.stl_per36),
    blk_per36:        get(s => s.blk_per36),
    tov_per36:        get(s => s.tov_per36),
    orb_per36:        getDerived(s => safeDiv(s.offensive_rebounds_per_game, s.minutes_per_game) * 36),
    drb_per36:        getDerived(s => safeDiv(s.defensive_rebounds_per_game, s.minutes_per_game) * 36),
    field_goal_pct:   get(s => s.field_goal_percentage),
    free_throw_pct:   get(s => s.free_throw_percentage),
    three_point_pct:  get(s => s.three_point_percentage),
    usage_rate:       get(s => s.usage_rate),
    free_throw_rate:  get(s => s.free_throw_rate),
    ast_tov_ratio:    getDerived(s => safeDiv(s.ast_per36, Math.max(s.tov_per36, 0.1))),
    offensive_rating: get(s => s.offensive_rating),
    defensive_rating: get(s => s.defensive_rating),
    height_inches:    makeParams(heights),
    weight_pounds:    makeParams(weights),
    age_at_season_start: makeParams(ages),
    prpg:             makeParams(prpgs),
  };
}

// ---------------------------------------------------------------------------
// Statistical distance
// ---------------------------------------------------------------------------

interface StatVec {
  // Scoring & Shooting Efficiency
  fg_pct:    number;
  ft_pct:    number;
  ft_rate:   number;
  three_pct: number;
  usage:     number;
  off_rtg:   number;
  // Scoring Volume
  pts36:     number;
  // Playmaking
  ast36:     number;
  ast_tov:   number;
  tov36:     number;
  // Rebounding
  reb36:     number;
  orb36:     number;
  drb36:     number;
  // Defense
  stl36:     number;
  blk36:     number;
  def_rtg:   number;
}

function toStatVec(s: CollegeStats, n: DatasetNorms): StatVec {
  const d = derivedStats(s);
  return {
    fg_pct:    zScore(s.field_goal_percentage,       n.field_goal_pct),
    ft_pct:    zScore(s.free_throw_percentage,       n.free_throw_pct),
    ft_rate:   zScore(s.free_throw_rate,             n.free_throw_rate),
    three_pct: zScore(s.three_point_percentage,      n.three_point_pct),
    usage:     zScore(s.usage_rate,                  n.usage_rate),
    off_rtg:   zScore(s.offensive_rating,            n.offensive_rating),
    pts36:     zScore(s.pts_per36,                   n.pts_per36),
    ast36:     zScore(s.ast_per36,                   n.ast_per36),
    ast_tov:   zScore(d.ast_tov,                     n.ast_tov_ratio),
    tov36:     zScore(s.tov_per36,                   n.tov_per36),
    reb36:     zScore(s.reb_per36,                   n.reb_per36),
    orb36:     zScore(d.orb_per36,                   n.orb_per36),
    drb36:     zScore(d.drb_per36,                   n.drb_per36),
    stl36:     zScore(s.stl_per36,                   n.stl_per36),
    blk36:     zScore(s.blk_per36,                   n.blk_per36),
    def_rtg:   zScore(s.defensive_rating,            n.defensive_rating),
  };
}

function sq(a: number, b: number) { return (a - b) ** 2; }

function statDistance(a: StatVec, b: StatVec) {
  // Scoring & Shooting Efficiency (26%)
  // off_rtg gets 0.5× weight — useful signal but team-context dependent
  const eff = Math.sqrt(
    sq(a.fg_pct, b.fg_pct) + sq(a.ft_pct, b.ft_pct) + sq(a.ft_rate, b.ft_rate) +
    sq(a.three_pct, b.three_pct) + sq(a.usage, b.usage) + 0.5 * sq(a.off_rtg, b.off_rtg)
  );

  // Scoring Volume (11%)
  const vol = Math.abs(a.pts36 - b.pts36);

  // Playmaking (18%)
  const play = Math.sqrt(sq(a.ast36, b.ast36) + sq(a.ast_tov, b.ast_tov) + sq(a.tov36, b.tov36));

  // Rebounding (20%) — total + split into ORB / DRB components
  const reb = Math.sqrt(sq(a.reb36, b.reb36) + sq(a.orb36, b.orb36) + sq(a.drb36, b.drb36));

  // Defense (25%)
  // def_rtg gets 0.5× weight — captures team defensive context but is noisy
  const def = Math.sqrt(
    sq(a.stl36, b.stl36) + sq(a.blk36, b.blk36) + 0.5 * sq(a.def_rtg, b.def_rtg)
  );

  const total = eff * 0.26 + vol * 0.11 + play * 0.18 + reb * 0.20 + def * 0.25;

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
//   K_STAT  = 5.0  statistical facets
//   K_VOL   = 3.0  scoring volume sub-component
//   K_PHYS  = 2.0  physical distance
//   K_AGE   = 1.5  age distance
// ---------------------------------------------------------------------------
const K_STAT = 5.0;
const K_VOL  = 3.0;
const K_PHYS = 2.0;

function sim(dist: number, k = K_STAT): number {
  return Math.max(0, Math.min(100, 100 * Math.exp(-dist / k)));
}

// ---------------------------------------------------------------------------
// Age resolution
//
// Only ~18% of historical players have an explicit age_at_season_start.
// BartTorvik class_year (Fr/So/Jr/Sr), present on every pool member by
// construction, provides a reliable fallback mapping to a typical age:
//   Fr → 19, So → 20, Jr → 21, Sr → 22
// ---------------------------------------------------------------------------
const CLASS_YEAR_AGE: Record<string, number> = { Fr: 19, So: 20, Jr: 21, Sr: 22 };

export function resolveAge(
  physicalAge: number | null | undefined,
  classYear: string | undefined,
): number | null {
  if (typeof physicalAge === 'number' && physicalAge > 10) return physicalAge;
  if (classYear && classYear in CLASS_YEAR_AGE) return CLASS_YEAR_AGE[classYear];
  return null;
}

/**
 * Returns true if the historical player is within ±1 year of the prospect's age.
 * Returns `true` if either age can't be resolved (filter disabled fallback).
 */
export function ageCompatible(prospectAge: number | null, histAge: number | null, maxDiff = 1): boolean {
  if (prospectAge === null || histAge === null) return true;
  return Math.abs(prospectAge - histAge) <= maxDiff;
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

// ---------------------------------------------------------------------------
// PRPG! similarity
//
// PRPG! is BartTorvik's single-number per-possession value metric. We
// compare prospect vs historical player by absolute PRPG! distance and
// convert to a 0-100 similarity with an exponential decay.
//
// K_PRPG = 1.5 — a PRPG! gap of 1.5 maps to ~37 similarity, 3.0 to ~14.
// Calibrated so near-identical PRPG! (within ~0.3) scores ≥ 80.
// ---------------------------------------------------------------------------
const K_PRPG = 1.5;

function prpgSim(prospectPrpg: number | undefined, histPrpg: number | undefined): number | null {
  if (typeof prospectPrpg !== 'number' || typeof histPrpg !== 'number') return null;
  return sim(Math.abs(prospectPrpg - histPrpg), K_PRPG);
}

// PRPG! is the primary driver (65%); raw stat archetype fills in the remainder (35%).
// Within the 35% archetype budget, the original facet weights (0.26/0.11/0.18/0.20/0.25)
// are preserved proportionally — so facet contributions become 0.091, 0.0385, 0.063, 0.070, 0.0875.
const W_PRPG        = 0.65;
const W_ARCHETYPE   = 1 - W_PRPG;        // 0.35
const FACET_EFF     = 0.26 * W_ARCHETYPE;  // 0.0910
const FACET_VOL     = 0.11 * W_ARCHETYPE;  // 0.0385
const FACET_PLAY    = 0.18 * W_ARCHETYPE;  // 0.0630
const FACET_REB     = 0.20 * W_ARCHETYPE;  // 0.0700
const FACET_DEF     = 0.25 * W_ARCHETYPE;  // 0.0875

/**
 * Return the top N statistical comparisons from a pre-filtered pool.
 * Used by the Draft Board: pool is already restricted to drafted players
 * with career NBA metric data, and we want 10 comps instead of 5.
 *
 * Ranking priority: PRPG! similarity (65%) > raw archetype facets (35%).
 */
export function getTopStatComps(
  prospectStats: CollegeStats,
  prospectPrpg: number | undefined,
  prospectAge: number | null,
  pool: HistoricalPlayer[],
  norms: DatasetNorms,
  prospectPosition?: string,
  topN = 10,
): PlayerComparison[] {
  const MIN_POSITION_POOL = 50;
  const MIN_AGE_POOL = 30;
  const posFiltered = pool.filter(h => positionCompatible(prospectPosition, h.position));
  const effectivePool = posFiltered.length >= MIN_POSITION_POOL ? posFiltered : pool;

  // Age ±1 filter — drop to position-filtered pool if age filter is too aggressive
  const ageFiltered = prospectAge !== null
    ? effectivePool.filter(h =>
        ageCompatible(
          prospectAge,
          resolveAge(h.physical?.age_at_season_start, h.barttorvik?.class_year),
        ),
      )
    : effectivePool;
  const finalPool = ageFiltered.length >= MIN_AGE_POOL ? ageFiltered : effectivePool;

  const pVec = toStatVec(prospectStats, norms);

  return finalPool
    .map(hist => {
      const hVec = toStatVec(hist.college_stats, norms);
      const s = statDistance(pVec, hVec);

      const sEff  = sim(s.eff,  K_STAT);
      const sVol  = sim(s.vol,  K_VOL);
      const sPlay = sim(s.play, K_STAT);
      const sReb  = sim(s.reb,  K_STAT);
      const sDef  = sim(s.def,  K_STAT);

      const archetypeAvg =
        sEff * 0.26 + sVol * 0.11 + sPlay * 0.18 + sReb * 0.20 + sDef * 0.25;

      const sPrpg = prpgSim(prospectPrpg, hist.barttorvik?.prpg);
      const blendedSim = sPrpg != null
        ? sPrpg * W_PRPG + archetypeAvg * W_ARCHETYPE
        : archetypeAvg;  // fallback when PRPG! unavailable

      return { hist, s, sEff, sVol, sPlay, sReb, sDef, sPrpg, blendedSim };
    })
    .sort((a, b) => b.blendedSim - a.blendedSim)
    .slice(0, topN)
    .map(r => ({
      historical_player: r.hist,
      comparison_type: 'statistical' as const,
      similarity_score: Math.round(r.blendedSim * 10) / 10,
      breakdown: {
        scoring_efficiency: Math.round(r.sEff),
        scoring_volume:     Math.round(r.sVol),
        playmaking:         Math.round(r.sPlay),
        rebounding:         Math.round(r.sReb),
        defense:            Math.round(r.sDef),
        physical:           0,
      },
    }));
}

export function getProspectComparisons(
  prospectStats: CollegeStats,
  prospectPhysical: PhysicalAttributes | undefined | null,
  prospectPrpg: number | undefined,
  prospectAge: number | null,
  pool: HistoricalPlayer[],
  norms: DatasetNorms,
  prospectPosition?: string,
): ProspectComparisons {
  const MIN_POSITION_POOL = 50;
  const MIN_AGE_POOL = 30;
  const posFiltered = pool.filter(h => positionCompatible(prospectPosition, h.position));
  const effectivePool = posFiltered.length >= MIN_POSITION_POOL ? posFiltered : pool;

  const ageFiltered = prospectAge !== null
    ? effectivePool.filter(h =>
        ageCompatible(
          prospectAge,
          resolveAge(h.physical?.age_at_season_start, h.barttorvik?.class_year),
        ),
      )
    : effectivePool;
  const finalPool = ageFiltered.length >= MIN_AGE_POOL ? ageFiltered : effectivePool;

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
        scoring_efficiency: Math.round(sEff),
        scoring_volume:     Math.round(sVol),
        playmaking:         Math.round(sPlay),
        rebounding:         Math.round(sReb),
        defense:            Math.round(sDef),
        physical:           pDist != null ? Math.round(pSim) : 0,
      },
    };
  }

  const statRows = finalPool
    .map(hist => {
      const hVec = toStatVec(hist.college_stats, norms);
      const s = statDistance(pVec, hVec);

      const sEff  = sim(s.eff,  K_STAT);
      const sVol  = sim(s.vol,  K_VOL);
      const sPlay = sim(s.play, K_STAT);
      const sReb  = sim(s.reb,  K_STAT);
      const sDef  = sim(s.def,  K_STAT);

      const archetypeAvg =
        sEff * 0.26 + sVol * 0.11 + sPlay * 0.18 + sReb * 0.20 + sDef * 0.25;

      const sPrpg = prpgSim(prospectPrpg, hist.barttorvik?.prpg);
      const blendedSim = sPrpg != null
        ? sPrpg * W_PRPG + archetypeAvg * W_ARCHETYPE
        : archetypeAvg;

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
    make(r.hist, 'statistical', r.blendedSim,
         r.sEff, r.sVol, r.sPlay, r.sReb, r.sDef, r.pDist, r.pSimVal)
  );

  let physical: PlayerComparison[] = [];
  if (hasPhys(prospectPhysical)) {
    const physRows = effectivePool
      .filter(hist => hasPhys(hist.physical))
      .map(hist => {
        const hVec = toStatVec(hist.college_stats, norms);
        const s = statDistance(pVec, hVec);
        const sEff  = sim(s.eff,  K_STAT);
        const sVol  = sim(s.vol,  K_VOL);
        const sPlay = sim(s.play, K_STAT);
        const sReb  = sim(s.reb,  K_STAT);
        const sDef  = sim(s.def,  K_STAT);
        const pDist = physDistance(prospectPhysical, hist.physical, norms);
        const pSimVal = sim(pDist, K_PHYS);
        return { hist, sEff, sVol, sPlay, sReb, sDef, pDist, pSimVal };
      })
      .sort((a, b) => a.pDist - b.pDist);

    physical = physRows.slice(0, 5).map(r =>
      make(r.hist, 'physical', r.pSimVal,
           r.sEff, r.sVol, r.sPlay, r.sReb, r.sDef, r.pDist, r.pSimVal)
    );
  }

  return { statistical, physical };
}
