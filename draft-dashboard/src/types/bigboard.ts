// ─── Big Board Types ─────────────────────────────────────────────────────────
// These types represent data read from Austin's Google Sheet Big Board.
// Columns: Rank | Name | Draft Age | School/Country | Position | Height |
//          Weight | Wingspan | NBA Comparison | Biggest Skill |
//          Biggest Weakness | My Mock Pick No. | My Mock Team

export interface BigBoardPlayer {
  rank: number;
  name: string;
  slug: string; // URL-safe version of name
  draftAge: number;
  school: string;
  position: string;
  height: string; // e.g. "6'9""
  weight: number; // lbs
  wingspan: string; // e.g. "6'11""
  nbaComparison: string;
  biggestSkill: string;
  biggestWeakness: string;
  mockPickNo: number | null;
  mockTeam: string | null;
}

// Supplementary config stored in /public/data/big-board-config.json
// Austin fills this in as he scouts players
export interface ProspectConfig {
  espnAthleteId?: number; // for headshot from ESPN CDN
  youtubeVideoId?: string; // highlight reel video ID
}

export interface BigBoardConfig {
  players: Record<string, ProspectConfig>; // keyed by player name (exact match)
}

export interface BigBoardApiResponse {
  players: BigBoardPlayer[];
  updatedAt: string; // ISO timestamp
  error?: string;
}
