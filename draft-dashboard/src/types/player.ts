/**
 * Type definitions for NBA Draft Dashboard
 */

// Position types
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F';

// College player statistics (per game)
export interface CollegeStats {
  // Basic stats
  games: number;
  minutes_per_game: number;
  points_per_game: number;
  rebounds_per_game: number;
  assists_per_game: number;
  steals_per_game: number;
  blocks_per_game: number;
  turnovers_per_game: number;
  
  // Shooting percentages
  field_goal_percentage: number;
  three_point_percentage: number;
  free_throw_percentage: number;
  
  // Advanced metrics (if available)
  true_shooting_percentage?: number;
  effective_field_goal_percentage?: number;
  player_efficiency_rating?: number;
  usage_rate?: number;
  offensive_rating?: number;
  defensive_rating?: number;
  win_shares?: number;
  box_plus_minus?: number;
}

// Physical attributes
export interface PhysicalAttributes {
  height_inches: number;
  weight_pounds: number;
  wingspan_inches?: number;
  age_at_season_start: number;
}

// College player profile
export interface CollegePlayer {
  id: string;
  name: string;
  team: string;
  season: number;
  position: Position;
  year: 'FR' | 'SO' | 'JR' | 'SR'; // Freshman, Sophomore, Junior, Senior
  conference: string;
  physical: PhysicalAttributes;
  stats: CollegeStats;
}

// NBA career statistics
export interface NBACareerStats {
  seasons_played: number;
  games_played: number;
  career_ppg: number;
  career_rpg: number;
  career_apg: number;
  career_spg: number;
  career_bpg: number;
  career_fg_percentage: number;
  career_three_point_percentage: number;
  career_ft_percentage: number;
  all_star_selections: number;
  all_nba_selections: number;
  championships: number;
  current_team?: string;
  is_active: boolean;
}

// Historical player (college stats + NBA career)
export interface HistoricalPlayer {
  id: string;
  name: string;
  college_profile: CollegePlayer;
  nba_career: NBACareerStats;
  draft_year: number;
  draft_pick?: number;
  draft_round?: number;
}

// Normalized statistics (z-scores)
export interface NormalizedStats {
  points_per_game: number;
  rebounds_per_game: number;
  assists_per_game: number;
  steals_per_game: number;
  blocks_per_game: number;
  turnovers_per_game: number;
  field_goal_percentage: number;
  three_point_percentage: number;
  free_throw_percentage: number;
  height_inches: number;
  weight_pounds: number;
  age_at_season_start: number;
  
  // Advanced (if available)
  true_shooting_percentage?: number;
  player_efficiency_rating?: number;
  usage_rate?: number;
}

// Comparison result
export interface PlayerComparison {
  historical_player: HistoricalPlayer;
  similarity_score: number; // 0-100, higher is more similar
  distance: number; // Euclidean distance (lower is more similar)
  stat_breakdown: {
    scoring_similarity: number;
    rebounding_similarity: number;
    playmaking_similarity: number;
    defense_similarity: number;
    physical_similarity: number;
    efficiency_similarity: number;
  };
}

// Statistical normalization parameters
export interface NormalizationParams {
  mean: number;
  std_dev: number;
}

// Dataset statistics for normalization
export interface DatasetStats {
  points_per_game: NormalizationParams;
  rebounds_per_game: NormalizationParams;
  assists_per_game: NormalizationParams;
  steals_per_game: NormalizationParams;
  blocks_per_game: NormalizationParams;
  turnovers_per_game: NormalizationParams;
  field_goal_percentage: NormalizationParams;
  three_point_percentage: NormalizationParams;
  free_throw_percentage: NormalizationParams;
  height_inches: NormalizationParams;
  weight_pounds: NormalizationParams;
  age_at_season_start: NormalizationParams;
  
  // Advanced
  true_shooting_percentage?: NormalizationParams;
  player_efficiency_rating?: NormalizationParams;
  usage_rate?: NormalizationParams;
}

// Comparison weights
export interface ComparisonWeights {
  scoring: number;      // PPG, TS%, FG%
  rebounding: number;   // RPG
  playmaking: number;   // APG, TOV
  defense: number;      // SPG, BPG
  physical: number;     // Height, Weight, Age
  efficiency: number;   // Advanced metrics
}
