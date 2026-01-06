/**
 * Statistical Normalization Utilities
 * Converts raw statistics to z-scores for fair comparison across eras
 */

import type {
  CollegePlayer,
  NormalizedStats,
  DatasetStats,
  NormalizationParams,
} from '../types/player';

/**
 * Calculate mean of an array of numbers
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
export function calculateStdDev(values: number[], mean?: number): number {
  if (values.length === 0) return 1;
  
  const avg = mean ?? calculateMean(values);
  const squaredDiffs = values.map(value => Math.pow(value - avg, 2));
  const variance = calculateMean(squaredDiffs);
  
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 1 : stdDev; // Avoid division by zero
}

/**
 * Calculate z-score for a single value
 * Formula: (value - mean) / standard_deviation
 */
export function calculateZScore(
  value: number,
  params: NormalizationParams
): number {
  if (params.std_dev === 0) return 0;
  return (value - params.mean) / params.std_dev;
}

/**
 * Build dataset statistics from historical player data
 * Call this once with all historical data to get normalization parameters
 */
export function buildDatasetStats(players: CollegePlayer[]): DatasetStats {
  // Helper to extract stat values safely
  const extractStat = (getter: (p: CollegePlayer) => number | undefined): number[] => {
    return players
      .map(getter)
      .filter((val): val is number => val !== undefined && !isNaN(val) && val !== null);
  };

  // Helper to create normalization params
  const createParams = (values: number[]): NormalizationParams => {
    const mean = calculateMean(values);
    const std_dev = calculateStdDev(values, mean);
    return { mean, std_dev };
  };

  // Build normalization parameters for each stat
  return {
    points_per_game: createParams(extractStat(p => p.stats.points_per_game)),
    rebounds_per_game: createParams(extractStat(p => p.stats.rebounds_per_game)),
    assists_per_game: createParams(extractStat(p => p.stats.assists_per_game)),
    steals_per_game: createParams(extractStat(p => p.stats.steals_per_game)),
    blocks_per_game: createParams(extractStat(p => p.stats.blocks_per_game)),
    turnovers_per_game: createParams(extractStat(p => p.stats.turnovers_per_game)),
    field_goal_percentage: createParams(extractStat(p => p.stats.field_goal_percentage)),
    three_point_percentage: createParams(extractStat(p => p.stats.three_point_percentage)),
    free_throw_percentage: createParams(extractStat(p => p.stats.free_throw_percentage)),
    height_inches: createParams(extractStat(p => p.physical.height_inches)),
    weight_pounds: createParams(extractStat(p => p.physical.weight_pounds)),
    age_at_season_start: createParams(extractStat(p => p.physical.age_at_season_start)),
    
    // Advanced metrics (if available)
    true_shooting_percentage: createParams(extractStat(p => p.stats.true_shooting_percentage)),
    player_efficiency_rating: createParams(extractStat(p => p.stats.player_efficiency_rating)),
    usage_rate: createParams(extractStat(p => p.stats.usage_rate)),
  };
}

/**
 * Normalize a player's statistics using dataset parameters
 */
export function normalizePlayerStats(
  player: CollegePlayer,
  datasetStats: DatasetStats
): NormalizedStats {
  const { stats, physical } = player;

  return {
    points_per_game: calculateZScore(stats.points_per_game, datasetStats.points_per_game),
    rebounds_per_game: calculateZScore(stats.rebounds_per_game, datasetStats.rebounds_per_game),
    assists_per_game: calculateZScore(stats.assists_per_game, datasetStats.assists_per_game),
    steals_per_game: calculateZScore(stats.steals_per_game, datasetStats.steals_per_game),
    blocks_per_game: calculateZScore(stats.blocks_per_game, datasetStats.blocks_per_game),
    turnovers_per_game: calculateZScore(stats.turnovers_per_game, datasetStats.turnovers_per_game),
    field_goal_percentage: calculateZScore(stats.field_goal_percentage, datasetStats.field_goal_percentage),
    three_point_percentage: calculateZScore(stats.three_point_percentage, datasetStats.three_point_percentage),
    free_throw_percentage: calculateZScore(stats.free_throw_percentage, datasetStats.free_throw_percentage),
    height_inches: calculateZScore(physical.height_inches, datasetStats.height_inches),
    weight_pounds: calculateZScore(physical.weight_pounds, datasetStats.weight_pounds),
    age_at_season_start: calculateZScore(physical.age_at_season_start, datasetStats.age_at_season_start),
    
    // Advanced metrics (if available)
    true_shooting_percentage: stats.true_shooting_percentage !== undefined
      ? calculateZScore(stats.true_shooting_percentage, datasetStats.true_shooting_percentage!)
      : undefined,
    player_efficiency_rating: stats.player_efficiency_rating !== undefined
      ? calculateZScore(stats.player_efficiency_rating, datasetStats.player_efficiency_rating!)
      : undefined,
    usage_rate: stats.usage_rate !== undefined
      ? calculateZScore(stats.usage_rate, datasetStats.usage_rate!)
      : undefined,
  };
}

/**
 * Denormalize a z-score back to original value (for display purposes)
 */
export function denormalizeValue(
  zScore: number,
  params: NormalizationParams
): number {
  return (zScore * params.std_dev) + params.mean;
}

/**
 * Get human-readable interpretation of z-score
 */
export function interpretZScore(zScore: number): string {
  const abs = Math.abs(zScore);
  
  if (abs > 2.5) return 'Elite';
  if (abs > 1.5) return 'Very Good';
  if (abs > 0.5) return 'Above Average';
  if (abs > -0.5) return 'Average';
  if (abs > -1.5) return 'Below Average';
  return 'Poor';
}
