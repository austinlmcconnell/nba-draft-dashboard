/**
 * Type definitions for NBA Draft Dashboard
 */

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | 'G' | 'F';

// ---------------------------------------------------------------------------
// College Stats
// All per-game and per-36 stats, plus advanced efficiency metrics.
// Per-36 stats are the primary input for statistical comparison because they
// normalize for playing-time differences across players and eras.
// ---------------------------------------------------------------------------
export interface CollegeStats {
  // Basic counting stats (per game)
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

  // Per-36 minute stats (normalized for playing time — preferred for comparison)
  pts_per36: number;
  reb_per36: number;
  ast_per36: number;
  stl_per36: number;
  blk_per36: number;
  tov_per36: number;

  // Efficiency / rate metrics (no per-36 conversion needed — already rates)
  true_shooting_pct: number;       // Best single scoring efficiency metric
  effective_fg_pct: number;        // FG% accounting for 3-point value
  usage_rate: number;              // % of team possessions used while on court
  free_throw_rate: number;         // FTA/FGA — measures drawing fouls
  three_pt_attempts_per_game: number; // Raw 3PA/game for shot-profile context
  ast_tov_ratio: number;           // Playmaking efficiency
  oreb_pct: number;                // Offensive rebound rate

  // Team-context / composite metrics
  net_rating: number;              // Point differential per 100 possessions
  win_shares_per40: number;        // Wins produced per 40 minutes
  porpag: number;                  // Points over replacement (CBBD-specific)
  offensive_rating: number;
  defensive_rating: number;
}

// ---------------------------------------------------------------------------
// Physical Attributes
// Optional — not always available for current prospects from CBBD.
// Historical NBA players have these from NBA player profiles.
// ---------------------------------------------------------------------------
export interface PhysicalAttributes {
  height_inches: number | null;
  weight_pounds: number | null;
  wingspan_inches: number | null;
  age_at_season_start: number | null;
}

// ---------------------------------------------------------------------------
// College Player (current prospect or historical)
// ---------------------------------------------------------------------------
export interface CollegePlayer {
  id: string;
  name: string;
  team: string;
  season: number;
  position: Position;
  conference: string;
  athlete_id?: number;
  stats: CollegeStats;
  physical?: PhysicalAttributes; // only populated when data is available
}

// ---------------------------------------------------------------------------
// NBA Career Outcome
// ---------------------------------------------------------------------------
export interface NBACareerStats {
  seasons_played: number;
  games_played: number;
  career_ppg: number;
  career_rpg: number;
  career_apg: number;
  career_spg: number;
  career_bpg: number;
  career_tov: number;
  career_fg_pct: number;
  career_3p_pct: number;
  career_ft_pct: number;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Historical Player — college record + physical + NBA career
// ---------------------------------------------------------------------------
export interface HistoricalPlayer {
  id: string;
  name: string;
  college_team: string;
  college_season: number;
  college_stats: CollegeStats;
  physical: PhysicalAttributes;
  nba_career: NBACareerStats;
  draft_year: number | null;
  draft_round: number | null;
  draft_pick: number | null;
}

// ---------------------------------------------------------------------------
// Comparison Types
// Three distinct comparison lenses per prospect:
//   statistical — how similarly did this player produce on the court
//   physical    — how similar are body dimensions
//   overall     — blended statistical + physical
// ---------------------------------------------------------------------------
export type ComparisonType = 'statistical' | 'physical' | 'overall';

export interface ComparisonBreakdown {
  // Statistical facets (0-100)
  scoring_efficiency: number;  // TS%, usage, FT rate, shot profile
  scoring_volume: number;      // Pts/36
  playmaking: number;          // Ast/36, AST/TOV ratio
  rebounding: number;          // Reb/36, ORB%
  defense: number;             // Stl/36, Blk/36
  // Physical facets (0-100, only meaningful for physical/overall comparisons)
  physical: number;
}

export interface PlayerComparison {
  historical_player: HistoricalPlayer;
  comparison_type: ComparisonType;
  similarity_score: number;       // 0-100, higher = more similar
  breakdown: ComparisonBreakdown;
}

export interface ProspectComparisons {
  statistical: PlayerComparison;
  physical: PlayerComparison | null;   // null when prospect has no physical data
  overall: PlayerComparison;
}

// ---------------------------------------------------------------------------
// Normalization helpers (used internally by the comparison algorithm)
// ---------------------------------------------------------------------------
export interface NormParams {
  mean: number;
  std_dev: number;
}

export interface DatasetNorms {
  // Per-36 stats
  pts_per36: NormParams;
  reb_per36: NormParams;
  ast_per36: NormParams;
  stl_per36: NormParams;
  blk_per36: NormParams;
  tov_per36: NormParams;
  // Rate / efficiency stats
  true_shooting_pct: NormParams;
  usage_rate: NormParams;
  free_throw_rate: NormParams;
  three_pt_attempts_per_game: NormParams;
  ast_tov_ratio: NormParams;
  oreb_pct: NormParams;
  win_shares_per40: NormParams;
  net_rating: NormParams;
  // Physical
  height_inches: NormParams;
  weight_pounds: NormParams;
}
