/**
 * Player Comparison Algorithm
 * Matches current prospects to historical players using weighted Euclidean distance
 */

import type {
  CollegePlayer,
  HistoricalPlayer,
  PlayerComparison,
  ComparisonWeights,
  NormalizedStats,
  DatasetStats,
  Position,
} from '../types/player';

import { normalizePlayerStats } from './normalize';

/**
 * Default weights for comparison categories
 * Adjust these to emphasize different aspects of player comparison
 */
export const DEFAULT_WEIGHTS: ComparisonWeights = {
  scoring: 1.5,      // PPG, FG%, 3P%, FT%
  rebounding: 1.0,   // RPG
  playmaking: 1.2,   // APG, TOV
  defense: 1.1,      // SPG, BPG
  physical: 0.8,     // Height, Weight, Age
  efficiency: 1.3,   // Advanced metrics (if available)
};

/**
 * Position compatibility matrix
 * Determines which positions can be compared to each other
 */
const POSITION_COMPATIBILITY: Record<Position, Position[]> = {
  'PG': ['PG', 'G'],
  'SG': ['SG', 'G', 'SF'],
  'SF': ['SF', 'SG', 'PF', 'F'],
  'PF': ['PF', 'SF', 'C', 'F'],
  'C': ['C', 'PF'],
  'G': ['PG', 'SG', 'G'],
  'F': ['SF', 'PF', 'F'],
};

/**
 * Check if two positions are compatible for comparison
 */
export function arePositionsCompatible(pos1: Position, pos2: Position): boolean {
  return POSITION_COMPATIBILITY[pos1]?.includes(pos2) ?? false;
}

/**
 * Calculate weighted Euclidean distance between two normalized stat sets
 */
function calculateDistance(
  prospect: NormalizedStats,
  historical: NormalizedStats,
  weights: ComparisonWeights
): number {
  // Scoring distance (PPG, FG%, 3P%, FT%)
  const scoringDist = Math.sqrt(
    Math.pow(prospect.points_per_game - historical.points_per_game, 2) +
    Math.pow(prospect.field_goal_percentage - historical.field_goal_percentage, 2) +
    Math.pow(prospect.three_point_percentage - historical.three_point_percentage, 2) +
    Math.pow(prospect.free_throw_percentage - historical.free_throw_percentage, 2)
  ) * weights.scoring;

  // Rebounding distance
  const reboundingDist = Math.abs(prospect.rebounds_per_game - historical.rebounds_per_game) * weights.rebounding;

  // Playmaking distance (APG and turnovers)
  const playmakingDist = Math.sqrt(
    Math.pow(prospect.assists_per_game - historical.assists_per_game, 2) +
    Math.pow(prospect.turnovers_per_game - historical.turnovers_per_game, 2)
  ) * weights.playmaking;

  // Defense distance
  const defenseDist = Math.sqrt(
    Math.pow(prospect.steals_per_game - historical.steals_per_game, 2) +
    Math.pow(prospect.blocks_per_game - historical.blocks_per_game, 2)
  ) * weights.defense;

  // Physical distance
  const physicalDist = Math.sqrt(
    Math.pow(prospect.height_inches - historical.height_inches, 2) +
    Math.pow(prospect.weight_pounds - historical.weight_pounds, 2) +
    Math.pow(prospect.age_at_season_start - historical.age_at_season_start, 2)
  ) * weights.physical;

  // Advanced metrics distance (if available)
  let efficiencyDist = 0;
  if (prospect.true_shooting_percentage && historical.true_shooting_percentage) {
    efficiencyDist = Math.abs(prospect.true_shooting_percentage - historical.true_shooting_percentage) * weights.efficiency;
  }

  // Total weighted distance
  return scoringDist + reboundingDist + playmakingDist + defenseDist + physicalDist + efficiencyDist;
}

/**
 * Calculate category-specific similarity scores (0-100)
 */
function calculateCategorySimilarities(
  prospect: NormalizedStats,
  historical: NormalizedStats
): PlayerComparison['stat_breakdown'] {
  // Helper: convert distance to similarity percentage (0-100)
  const distanceToSimilarity = (distance: number): number => {
    // Smaller distance = higher similarity
    // Using exponential decay: similarity = 100 * e^(-distance)
    return Math.max(0, Math.min(100, 100 * Math.exp(-distance)));
  };

  const scoringSimilarity = distanceToSimilarity(
    Math.sqrt(
      Math.pow(prospect.points_per_game - historical.points_per_game, 2) +
      Math.pow(prospect.field_goal_percentage - historical.field_goal_percentage, 2)
    )
  );

  const reboundingSimilarity = distanceToSimilarity(
    Math.abs(prospect.rebounds_per_game - historical.rebounds_per_game)
  );

  const playmakingSimilarity = distanceToSimilarity(
    Math.abs(prospect.assists_per_game - historical.assists_per_game)
  );

  const defenseSimilarity = distanceToSimilarity(
    Math.sqrt(
      Math.pow(prospect.steals_per_game - historical.steals_per_game, 2) +
      Math.pow(prospect.blocks_per_game - historical.blocks_per_game, 2)
    )
  );

  const physicalSimilarity = distanceToSimilarity(
    Math.sqrt(
      Math.pow(prospect.height_inches - historical.height_inches, 2) / 100 +
      Math.pow(prospect.weight_pounds - historical.weight_pounds, 2) / 1000
    )
  );

  const efficiencySimilarity = distanceToSimilarity(
    Math.abs((prospect.field_goal_percentage - historical.field_goal_percentage))
  );

  return {
    scoring_similarity: Math.round(scoringSimilarity),
    rebounding_similarity: Math.round(reboundingSimilarity),
    playmaking_similarity: Math.round(playmakingSimilarity),
    defense_similarity: Math.round(defenseSimilarity),
    physical_similarity: Math.round(physicalSimilarity),
    efficiency_similarity: Math.round(efficiencySimilarity),
  };
}

/**
 * Find the most similar historical players for a given prospect
 */
export function findSimilarPlayers(
  prospect: CollegePlayer,
  historicalPlayers: HistoricalPlayer[],
  datasetStats: DatasetStats,
  options: {
    topN?: number;
    weights?: ComparisonWeights;
    requireSamePosition?: boolean;
  } = {}
): PlayerComparison[] {
  const {
    topN = 10,
    weights = DEFAULT_WEIGHTS,
    requireSamePosition = false,
  } = options;

  // Normalize prospect stats
  const prospectNormalized = normalizePlayerStats(prospect, datasetStats);

  // Calculate distances to all historical players
  const comparisons: PlayerComparison[] = [];

  for (const historical of historicalPlayers) {
    // Position filter
    if (requireSamePosition && !arePositionsCompatible(prospect.position, historical.college_profile.position)) {
      continue;
    }

    // Normalize historical player stats
    const historicalNormalized = normalizePlayerStats(historical.college_profile, datasetStats);

    // Calculate distance
    const distance = calculateDistance(prospectNormalized, historicalNormalized, weights);

    // Convert distance to similarity score (0-100)
    // Using: similarity = 100 * e^(-distance/10)
    const similarityScore = Math.max(0, Math.min(100, 100 * Math.exp(-distance / 10)));

    // Calculate category breakdowns
    const statBreakdown = calculateCategorySimilarities(prospectNormalized, historicalNormalized);

    comparisons.push({
      historical_player: historical,
      similarity_score: Math.round(similarityScore * 10) / 10, // Round to 1 decimal
      distance,
      stat_breakdown: statBreakdown,
    });
  }

  // Sort by similarity (highest first) and return top N
  return comparisons
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, topN);
}

/**
 * Get a single best match for a prospect
 */
export function getBestMatch(
  prospect: CollegePlayer,
  historicalPlayers: HistoricalPlayer[],
  datasetStats: DatasetStats,
  weights?: ComparisonWeights
): PlayerComparison | null {
  const matches = findSimilarPlayers(prospect, historicalPlayers, datasetStats, {
    topN: 1,
    weights,
  });

  return matches[0] ?? null;
}

/**
 * Find players similar in a specific category
 */
export function findSimilarByCategory(
  prospect: CollegePlayer,
  historicalPlayers: HistoricalPlayer[],
  datasetStats: DatasetStats,
  category: keyof ComparisonWeights,
  topN: number = 5
): PlayerComparison[] {
  // Create weights that heavily favor the specified category
  const categoryWeights: ComparisonWeights = {
    scoring: category === 'scoring' ? 3.0 : 0.3,
    rebounding: category === 'rebounding' ? 3.0 : 0.3,
    playmaking: category === 'playmaking' ? 3.0 : 0.3,
    defense: category === 'defense' ? 3.0 : 0.3,
    physical: category === 'physical' ? 3.0 : 0.3,
    efficiency: category === 'efficiency' ? 3.0 : 0.3,
  };

  return findSimilarPlayers(prospect, historicalPlayers, datasetStats, {
    topN,
    weights: categoryWeights,
  });
}
