/**
 * Example Usage of the Comparison Algorithm
 * This file demonstrates how to use the player comparison system
 */

import type { CollegePlayer, HistoricalPlayer } from '../types/player';
import { buildDatasetStats } from './normalize';
import { findSimilarPlayers, getBestMatch, DEFAULT_WEIGHTS } from './comparison';

/**
 * Example: Create sample data for testing
 * In production, you'll load this from your JSON files
 */

// Sample current prospect (e.g., Cooper Flagg - Duke 2025)
const sampleProspect: CollegePlayer = {
  id: 'flagg-2025',
  name: 'Cooper Flagg',
  team: 'Duke',
  season: 2025,
  position: 'SF',
  year: 'FR',
  conference: 'ACC',
  physical: {
    height_inches: 81, // 6'9"
    weight_pounds: 205,
    age_at_season_start: 18,
  },
  stats: {
    games: 35,
    minutes_per_game: 32.5,
    points_per_game: 18.2,
    rebounds_per_game: 8.5,
    assists_per_game: 4.1,
    steals_per_game: 1.5,
    blocks_per_game: 1.3,
    turnovers_per_game: 2.8,
    field_goal_percentage: 47.5,
    three_point_percentage: 35.8,
    free_throw_percentage: 74.2,
  },
};

// Sample historical player (e.g., Jayson Tatum - Duke 2017)
const sampleHistorical: HistoricalPlayer = {
  id: 'tatum-2017',
  name: 'Jayson Tatum',
  college_profile: {
    id: 'tatum-duke-2017',
    name: 'Jayson Tatum',
    team: 'Duke',
    season: 2017,
    position: 'SF',
    year: 'FR',
    conference: 'ACC',
    physical: {
      height_inches: 80, // 6'8"
      weight_pounds: 208,
      age_at_season_start: 18,
    },
    stats: {
      games: 29,
      minutes_per_game: 33.0,
      points_per_game: 16.8,
      rebounds_per_game: 7.3,
      assists_per_game: 2.1,
      steals_per_game: 1.3,
      blocks_per_game: 1.1,
      turnovers_per_game: 2.5,
      field_goal_percentage: 45.2,
      three_point_percentage: 34.2,
      free_throw_percentage: 84.8,
    },
  },
  nba_career: {
    seasons_played: 7,
    games_played: 565,
    career_ppg: 23.1,
    career_rpg: 7.2,
    career_apg: 3.5,
    career_spg: 1.1,
    career_bpg: 0.7,
    career_fg_percentage: 45.8,
    career_three_point_percentage: 38.0,
    career_ft_percentage: 85.4,
    all_star_selections: 6,
    all_nba_selections: 4,
    championships: 1,
    current_team: 'Boston Celtics',
    is_active: true,
  },
  draft_year: 2017,
  draft_pick: 3,
  draft_round: 1,
};

/**
 * Example 1: Find similar players for a prospect
 */
export function exampleFindSimilarPlayers() {
  console.log('=== Example 1: Find Similar Players ===\n');

  // In production, you'd load all historical players from your data file
  // For this example, we'll just use one
  const allHistoricalPlayers: HistoricalPlayer[] = [
    sampleHistorical,
    // ... load more from data/nba_career_stats_lite.json
  ];

  // Step 1: Build dataset statistics for normalization
  const allCollegePlayers = allHistoricalPlayers.map(h => h.college_profile);
  const datasetStats = buildDatasetStats(allCollegePlayers);

  // Step 2: Find similar players
  const similarPlayers = findSimilarPlayers(
    sampleProspect,
    allHistoricalPlayers,
    datasetStats,
    {
      topN: 5,
      weights: DEFAULT_WEIGHTS,
    }
  );

  // Step 3: Display results
  console.log(`Similar players to ${sampleProspect.name}:\n`);
  
  similarPlayers.forEach((comparison, index) => {
    const { historical_player, similarity_score, stat_breakdown } = comparison;
    const { name } = historical_player;
    const { career_ppg, seasons_played } = historical_player.nba_career;

    console.log(`${index + 1}. ${name}`);
    console.log(`   Overall Similarity: ${similarity_score}%`);
    console.log(`   NBA Career: ${career_ppg} PPG over ${seasons_played} seasons`);
    console.log(`   Category Breakdown:`);
    console.log(`     Scoring: ${stat_breakdown.scoring_similarity}%`);
    console.log(`     Rebounding: ${stat_breakdown.rebounding_similarity}%`);
    console.log(`     Playmaking: ${stat_breakdown.playmaking_similarity}%`);
    console.log(`     Defense: ${stat_breakdown.defense_similarity}%`);
    console.log('');
  });
}

/**
 * Example 2: Get best match only
 */
export function exampleGetBestMatch() {
  console.log('=== Example 2: Get Best Match ===\n');

  const allHistoricalPlayers: HistoricalPlayer[] = [sampleHistorical];
  const allCollegePlayers = allHistoricalPlayers.map(h => h.college_profile);
  const datasetStats = buildDatasetStats(allCollegePlayers);

  const bestMatch = getBestMatch(
    sampleProspect,
    allHistoricalPlayers,
    datasetStats
  );

  if (bestMatch) {
    console.log(`Best match for ${sampleProspect.name}:`);
    console.log(`  ${bestMatch.historical_player.name}`);
    console.log(`  Similarity: ${bestMatch.similarity_score}%`);
    console.log(`  NBA Translation: ${bestMatch.historical_player.nba_career.career_ppg} PPG`);
  }
}

/**
 * Example 3: Load data from JSON files (production usage)
 */
export async function exampleWithRealData() {
  console.log('=== Example 3: Using Real Data ===\n');

  // Load historical data
  const historicalData = await import('../../data/nba_career_stats_lite.json');
  const historicalPlayers: HistoricalPlayer[] = historicalData.default;

  // Load current prospects
  const prospectData = await import('../../data/current_prospects.json');
  const prospects: CollegePlayer[] = prospectData.default;

  // Build dataset stats
  const allCollegePlayers = historicalPlayers.map(h => h.college_profile);
  const datasetStats = buildDatasetStats(allCollegePlayers);

  // Find comparisons for each prospect
  prospects.forEach(prospect => {
    const matches = findSimilarPlayers(
      prospect,
      historicalPlayers,
      datasetStats,
      { topN: 3 }
    );

    console.log(`\n${prospect.name} (${prospect.team}):`);
    console.log(`Best comp: ${matches[0]?.historical_player.name} (${matches[0]?.similarity_score}%)`);
  });
}

/**
 * Example 4: Custom weights for different comparison styles
 */
export function exampleCustomWeights() {
  console.log('=== Example 4: Custom Weights ===\n');

  const allHistoricalPlayers: HistoricalPlayer[] = [sampleHistorical];
  const allCollegePlayers = allHistoricalPlayers.map(h => h.college_profile);
  const datasetStats = buildDatasetStats(allCollegePlayers);

  // Emphasize scoring and shooting
  const shooterWeights = {
    scoring: 3.0,      // Heavy emphasis on scoring
    rebounding: 0.5,   // Less important
    playmaking: 0.8,   // Somewhat important
    defense: 0.6,      // Less important
    physical: 0.7,
    efficiency: 2.0,   // Important for shooters
  };

  const shooterComps = findSimilarPlayers(
    sampleProspect,
    allHistoricalPlayers,
    datasetStats,
    { weights: shooterWeights, topN: 5 }
  );

  console.log('Shooter-focused comparisons:');
  shooterComps.forEach((comp, i) => {
    console.log(`${i + 1}. ${comp.historical_player.name} (${comp.similarity_score}%)`);
  });
}

/**
 * Helper: Format comparison for display
 */
export function formatComparison(comparison: typeof similarPlayers[0]) {
  const { historical_player, similarity_score, stat_breakdown } = comparison;
  const college = historical_player.college_profile;
  const nba = historical_player.nba_career;

  return {
    name: historical_player.name,
    similarity: `${similarity_score}%`,
    college_stats: {
      team: `${college.team} (${college.season})`,
      ppg: college.stats.points_per_game,
      rpg: college.stats.rebounds_per_game,
      apg: college.stats.assists_per_game,
    },
    nba_career: {
      ppg: nba.career_ppg,
      rpg: nba.career_rpg,
      apg: nba.career_apg,
      seasons: nba.seasons_played,
      all_stars: nba.all_star_selections,
    },
    breakdown: stat_breakdown,
  };
}

// Run examples (uncomment to test)
// exampleFindSimilarPlayers();
// exampleGetBestMatch();
// exampleCustomWeights();
