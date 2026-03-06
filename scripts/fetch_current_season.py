#!/usr/bin/env python3
"""
Fetch Current Season (2025-26 / season=2026) Data + Team Metadata

1. Fetch CBBD /teams endpoint → ESPN source ID, primary/secondary colors per school
2. Fetch season=2026 player stats from CBBD
3. Apply per-36 enrichment + field renaming (same as fetch_nba_data.py)
4. Enrich player records with team metadata (ESPN ID, colors)
5. Append to historical_college_stats.json
6. Copy updated file to draft-dashboard/public/data/
"""

import json
import os
import shutil
import sys
import time
import requests
from typing import Dict, List, Any, Optional

API_KEY = os.environ.get('CBBD_API_KEY')
BASE_URL = 'https://api.collegebasketballdata.com'
CURRENT_SEASON = 2026
COLLEGE_DATA_FILE = '../data/historical_college_stats.json'
PUBLIC_DATA_DIR = '../draft-dashboard/public/data'

MAJOR_CONFERENCES = {
    'ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12',
    'Big East', 'American', 'Mountain West', 'Atlantic 10',
    'WCC', 'Conference USA'
}

MIN_GAMES = 10           # lower bar for current season (still in progress)
MIN_MINUTES_PER_GAME = 15.0


def get_headers() -> Dict[str, str]:
    return {'Authorization': f'Bearer {API_KEY}'}


# ---------------------------------------------------------------------------
# Step 1 — Team metadata: ESPN ID + colors
# ---------------------------------------------------------------------------
def fetch_team_metadata() -> Dict[str, dict]:
    """
    Returns: {team_name: {espn_source_id, primary_color, secondary_color}}
    """
    print('Fetching team metadata from CBBD /teams...')
    try:
        resp = requests.get(f'{BASE_URL}/teams', headers=get_headers(), timeout=30)
        resp.raise_for_status()
        teams = resp.json()
    except requests.RequestException as e:
        print(f'  ERROR fetching teams: {e}')
        return {}

    meta: Dict[str, dict] = {}
    for t in teams:
        name = t.get('school') or t.get('displayName') or ''
        if not name:
            continue
        espn_id = t.get('sourceId') or t.get('id')
        try:
            espn_id_int = int(espn_id) if espn_id else None
        except (ValueError, TypeError):
            espn_id_int = None
        meta[name] = {
            'espn_source_id': espn_id_int,
            'primary_color':   t.get('primaryColor'),
            'secondary_color': t.get('secondaryColor'),
        }

    print(f'  {len(meta)} teams loaded')
    return meta


# ---------------------------------------------------------------------------
# Step 2 — Fetch season stats
# ---------------------------------------------------------------------------
def fetch_season_stats(season: int) -> List[Dict]:
    url = f'{BASE_URL}/stats/player/season'
    print(f'Fetching season={season} stats...', end='', flush=True)
    try:
        resp = requests.get(url, params={'season': season}, headers=get_headers(), timeout=60)
        resp.raise_for_status()
        data = resp.json()
        print(f' {len(data)} raw records')
        return data
    except requests.RequestException as e:
        print(f' ERROR: {e}')
        return []


# ---------------------------------------------------------------------------
# Step 3 — Normalize raw CBBD record to per-game + rename to TS types
# ---------------------------------------------------------------------------
def normalize_player(raw: Dict, season: int, team_meta: Dict[str, dict]) -> Dict:
    games   = raw.get('games') or 1
    minutes = raw.get('minutes') or 0
    mpg     = round(minutes / games, 1)

    fg    = raw.get('fieldGoals') or {}
    three = raw.get('threePointFieldGoals') or {}
    ft    = raw.get('freeThrows') or {}
    reb   = raw.get('rebounds') or {}
    ws    = raw.get('winShares') or {}

    team_name = raw.get('team', 'Unknown')
    meta      = team_meta.get(team_name, {})

    # Per-36 scale
    scale = (36.0 / mpg) if mpg > 0 else 0

    def per36(base_stat: float) -> float:
        return round(base_stat * scale, 1) if scale > 0 else 0.0

    ppg  = round((raw.get('points') or 0) / games, 1)
    rpg  = round((reb.get('total') or 0) / games, 1)
    apg  = round((raw.get('assists') or 0) / games, 1)
    spg  = round((raw.get('steals') or 0) / games, 1)
    bpg  = round((raw.get('blocks') or 0) / games, 1)
    tpg  = round((raw.get('turnovers') or 0) / games, 1)

    return {
        # Identity
        # athleteSourceId is ESPN's athlete ID (for headshots + physical data API)
        # athleteId is CBBD's internal ID — not useful for ESPN
        'name':       raw.get('name', 'Unknown'),
        'team':       team_name,
        'season':     season,
        'conference': raw.get('conference', 'Unknown'),
        'position':   raw.get('position', 'Unknown'),
        'athlete_id': int(raw['athleteSourceId']) if raw.get('athleteSourceId') else raw.get('athleteId'),

        # Team metadata
        'espn_team_id':        meta.get('espn_source_id'),
        'team_primary_color':  meta.get('primary_color'),
        'team_secondary_color': meta.get('secondary_color'),

        # Per-game counting stats
        'games':               games,
        'minutes_per_game':    mpg,
        'points_per_game':     ppg,
        'rebounds_per_game':   rpg,
        'assists_per_game':    apg,
        'steals_per_game':     spg,
        'blocks_per_game':     bpg,
        'turnovers_per_game':  tpg,

        # Shooting percentages
        'field_goal_percentage':   fg.get('pct') or 0,
        'three_point_percentage':  three.get('pct') or 0,
        'free_throw_percentage':   ft.get('pct') or 0,

        # Per-36 stats (TypeScript field names)
        'pts_per36': per36(ppg),
        'reb_per36': per36(rpg),
        'ast_per36': per36(apg),
        'stl_per36': per36(spg),
        'blk_per36': per36(bpg),
        'tov_per36': per36(tpg),

        # Advanced metrics (TypeScript field names)
        'true_shooting_pct':        raw.get('trueShootingPct') or 0,
        'effective_fg_pct':         raw.get('effectiveFieldGoalPct') or 0,
        'usage_rate':               raw.get('usage') or 0,
        'offensive_rating':         raw.get('offensiveRating') or 0,
        'defensive_rating':         raw.get('defensiveRating') or 0,
        'net_rating':               raw.get('netRating') or 0,
        'win_shares_per40':         ws.get('totalPer40') or 0,
        'ast_tov_ratio':            raw.get('assistsTurnoverRatio') or 0,
        'oreb_pct':                 raw.get('offensiveReboundPct') or 0,
        'free_throw_rate':          raw.get('freeThrowRate') or 0,
        'porpag':                   raw.get('PORPAG') or 0,
        'three_pt_attempts_per_game': round((three.get('attempted') or 0) / games, 1),
    }


def filter_and_normalize(raw_list: List[Dict], season: int, team_meta: Dict[str, dict]) -> List[Dict]:
    results = []
    for raw in raw_list:
        conf  = raw.get('conference', '')
        games = raw.get('games') or 0
        mins  = raw.get('minutes') or 0
        mpg   = mins / games if games > 0 else 0

        if conf not in MAJOR_CONFERENCES:
            continue
        if games < MIN_GAMES or mpg < MIN_MINUTES_PER_GAME:
            continue

        results.append(normalize_player(raw, season, team_meta))
    return results


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    if not API_KEY:
        print('ERROR: CBBD_API_KEY not set.')
        print('  export CBBD_API_KEY="your_key"')
        sys.exit(1)

    print('=' * 60)
    print(f'CURRENT SEASON DATA COLLECTOR  (season={CURRENT_SEASON})')
    print('=' * 60)

    os.makedirs('../data', exist_ok=True)

    # --- Step 1: Team metadata ---
    team_meta = fetch_team_metadata()
    time.sleep(0.5)

    # Save team metadata separately for the frontend
    with open('../data/team_metadata.json', 'w') as f:
        json.dump(team_meta, f, indent=2)
    print(f'Saved team_metadata.json ({len(team_meta)} teams)')

    # --- Step 2: Fetch current season stats ---
    raw_data = fetch_season_stats(CURRENT_SEASON)
    if not raw_data:
        print('No data returned — aborting.')
        sys.exit(1)

    # --- Step 3: Normalize ---
    prospects = filter_and_normalize(raw_data, CURRENT_SEASON, team_meta)
    print(f'\n{len(prospects)} qualifying players from major conferences')

    if not prospects:
        print('Zero prospects after filtering — check conference names or thresholds.')
        sys.exit(1)

    # --- Step 4: Append to historical_college_stats.json ---
    try:
        with open(COLLEGE_DATA_FILE) as f:
            existing = json.load(f)
    except FileNotFoundError:
        existing = []

    # Remove any stale season=2026 records (re-run safety)
    existing = [r for r in existing if r.get('season') != CURRENT_SEASON]
    combined = existing + prospects

    with open(COLLEGE_DATA_FILE, 'w') as f:
        json.dump(combined, f, indent=2)
    print(f'Updated {COLLEGE_DATA_FILE}: {len(combined)} total records')

    # --- Step 5: Copy to public/data/ ---
    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    shutil.copy(COLLEGE_DATA_FILE, f'{PUBLIC_DATA_DIR}/historical_college_stats.json')
    shutil.copy('../data/team_metadata.json', f'{PUBLIC_DATA_DIR}/team_metadata.json')
    print(f'Copied to {PUBLIC_DATA_DIR}/')

    # Summary
    print('\n' + '=' * 60)
    print('DONE')
    print(f'  {len(prospects)} current prospects added (season={CURRENT_SEASON})')
    if prospects:
        s = prospects[0]
        print(f'  Sample: {s["name"]} | {s["team"]} | {s["conference"]}')
        print(f'    {s["points_per_game"]} PPG  {s["rebounds_per_game"]} RPG  {s["assists_per_game"]} APG')
        print(f'    athlete_id={s.get("athlete_id")}  espn_team_id={s.get("espn_team_id")}')
        print(f'    primary_color={s.get("team_primary_color")}')


if __name__ == '__main__':
    main()
