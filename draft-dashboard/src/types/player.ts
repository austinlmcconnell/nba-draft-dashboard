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
  offensive_rebounds_per_game: number;
  defensive_rebounds_per_game: number;
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
// BartTorvik advanced metrics — primary signal for player quality in college.
// Sourced from barttorvik.com via build_barttorvik_lookup.py.
//   prpg      — Points per Replacement Player per Game (overall impact)
//   adj_ortg  — adjusted offensive rating, points per 100 possessions
//   adj_drtg  — adjusted defensive rating, points per 100 possessions allowed
// ---------------------------------------------------------------------------
export interface BartTorvikStats {
  prpg: number;
  adj_ortg: number | null;
  adj_drtg: number | null;
  class_year?: string;  // "Fr" | "So" | "Jr" | "Sr" — used as age-filter fallback
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
  espn_team_id?: number;
  team_primary_color?: string;
  team_secondary_color?: string;
  stats: CollegeStats;
  physical?: PhysicalAttributes;   // only populated when data is available
  barttorvik?: BartTorvikStats;    // present for players with a BartTorvik match
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
  position?: string;            // G | F | C | G-F | F-C — used for position-group filtering
  // School branding — sourced from ESPN via college stats record
  athlete_id?: number;
  espn_team_id?: number;
  team_primary_color?: string;
  team_secondary_color?: string;
  // BartTorvik advanced metrics — present for seasons 2008+ with a name match
  barttorvik?: BartTorvikStats;
}

// ---------------------------------------------------------------------------
// Comparison Types
// Two distinct comparison lenses per prospect:
//   statistical — how similarly did this player produce on the court
//   physical    — how similar are body dimensions
// ---------------------------------------------------------------------------
export type ComparisonType = 'statistical' | 'physical';

export interface ComparisonBreakdown {
  // Statistical facets (0-100)
  scoring_efficiency: number;  // FG%, FT%, FT rate, 3P%, usage, off_rtg
  scoring_volume: number;      // Pts/36
  playmaking: number;          // Ast/36, AST/TOV (derived), TOV/36
  rebounding: number;          // Reb/36, ORB/36 (derived), DRB/36 (derived)
  defense: number;             // Stl/36, Blk/36, def_rtg
  // Physical facets (0-100, only meaningful for physical comparisons)
  physical: number;
}

export interface PlayerComparison {
  historical_player: HistoricalPlayer;
  comparison_type: ComparisonType;
  similarity_score: number;       // 0-100, higher = more similar
  breakdown: ComparisonBreakdown;
}

export interface ProspectComparisons {
  statistical: PlayerComparison[];  // top 5, index 0 is best
  physical: PlayerComparison[];     // top 5, empty when prospect has no physical data
}

// ---------------------------------------------------------------------------
// NBA career metric types (Basketball-Reference BPM)
//
// BPM (Box Plus-Minus) is an impact metric measured in points per 100
// possessions above league average. It is position-neutral and is updated
// through the current NBA season, unlike RAPTOR which stops at 2022.
//
// Career BPM = minutes-weighted average across all seasons in the dataset.
// ---------------------------------------------------------------------------

export interface BpmEntry {
  bpm: number;      // career avg BPM (pts per 100 possessions, MP-weighted)
  mp: number;       // total minutes in BPM dataset (coverage indicator)
  seasons: number;  // seasons with BPM data
  display: string;  // original display name
}

export type BpmLookup = Record<string, BpmEntry>;  // keyed by normalized name

export interface DraftComp {
  name: string;
  collegeSeason: number;
  collegeTeam: string;
  position: string;
  similarity: number;     // 0-100 statistical similarity score
  bpm: number | null;     // career avg BPM (pts per 100 possessions)
  bpmMp: number | null;   // minutes covered in BPM data
  bpmSeasons: number | null;
}

export interface DraftBoardEntry {
  name: string;
  slug: string;
  school: string;
  position: string;
  bigBoardRank: number;
  mockPickNo: number | null;
  mockTeam: string | null;
  comps: DraftComp[];
  avgBpm: number | null;   // similarity-weighted avg of comp career BPMs
  bpmCoverage: number;     // how many comps have BPM data
}

export interface DraftBoardApiResponse {
  entries: DraftBoardEntry[];
  updatedAt: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Draft Rankings (scraped from Tankathon)
// ---------------------------------------------------------------------------
export interface DraftRanking {
  rank: number;
  name: string;
  position: string;
  school: string;
  height: string | null;
  weight: number | null;
  class: string | null;
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
  // Derived per-36 rebound splits (computed from per-game / mpg * 36)
  orb_per36: NormParams;
  drb_per36: NormParams;
  // Shooting percentages
  field_goal_pct: NormParams;
  free_throw_pct: NormParams;
  three_point_pct: NormParams;
  // Rate stats
  usage_rate: NormParams;
  free_throw_rate: NormParams;
  // Derived playmaking ratio (ast_per36 / tov_per36)
  ast_tov_ratio: NormParams;
  // Per-possession team-context ratings
  offensive_rating: NormParams;
  defensive_rating: NormParams;
  // Physical
  height_inches: NormParams;
  weight_pounds: NormParams;
  age_at_season_start: NormParams;
  // BartTorvik — primary comparison dimension (only present when lookup joined)
  prpg: NormParams;
}
