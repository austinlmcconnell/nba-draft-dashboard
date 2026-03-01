#!/usr/bin/env python3
"""
Fetch Historical College Basketball Data
Fetches college statistics for major-conference players (2000-2024 seasons)
using the CollegeBasketballData API via direct HTTP requests.
"""

import os
import sys
import json
import time
import requests
from typing import List, Dict, Any

# Configuration
API_KEY = os.environ.get('CBBD_API_KEY')
BASE_URL = 'https://api.collegebasketballdata.com'
OUTPUT_FILE = '../data/historical_college_stats.json'
START_YEAR = 2000
END_YEAR = 2024

# Major conferences to include
MAJOR_CONFERENCES = {
    'ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12',
    'Big East', 'American', 'Mountain West', 'Atlantic 10',
    'WCC', 'Conference USA'
}

# Minimum thresholds to filter out low-usage players
MIN_GAMES = 15
MIN_MINUTES_PER_GAME = 15.0


def get_headers() -> Dict[str, str]:
    return {'Authorization': f'Bearer {API_KEY}'}


def fetch_season_stats(season: int) -> List[Dict]:
    """Fetch all player stats for a season in one request."""
    url = f'{BASE_URL}/stats/player/season'
    try:
        print(f'  Fetching {season}...', end='', flush=True)
        resp = requests.get(url, params={'season': season}, headers=get_headers(), timeout=30)
        resp.raise_for_status()
        data = resp.json()
        print(f' {len(data)} players')
        return data
    except requests.RequestException as e:
        print(f' ERROR: {e}')
        return []


def normalize_player(raw: Dict, season: int) -> Dict:
    """
    Convert a raw API record (totals) into a normalized per-game stat dict.
    The API returns season totals; we compute per-game averages here.
    """
    games = raw.get('games') or 1  # avoid division by zero
    minutes = raw.get('minutes') or 0

    fg = raw.get('fieldGoals') or {}
    three = raw.get('threePointFieldGoals') or {}
    ft = raw.get('freeThrows') or {}
    reb = raw.get('rebounds') or {}
    ws = raw.get('winShares') or {}

    return {
        'name': raw.get('name', 'Unknown'),
        'team': raw.get('team', 'Unknown'),
        'season': season,
        'conference': raw.get('conference', 'Unknown'),
        'position': raw.get('position', 'Unknown'),
        'athlete_id': raw.get('athleteId'),

        # Volume stats (per game)
        'games': games,
        'minutes_per_game': round(minutes / games, 1),
        'points_per_game': round((raw.get('points') or 0) / games, 1),
        'rebounds_per_game': round((reb.get('total') or 0) / games, 1),
        'offensive_rebounds_per_game': round((reb.get('offensive') or 0) / games, 1),
        'defensive_rebounds_per_game': round((reb.get('defensive') or 0) / games, 1),
        'assists_per_game': round((raw.get('assists') or 0) / games, 1),
        'steals_per_game': round((raw.get('steals') or 0) / games, 1),
        'blocks_per_game': round((raw.get('blocks') or 0) / games, 1),
        'turnovers_per_game': round((raw.get('turnovers') or 0) / games, 1),

        # Shooting percentages (already rates, not totals)
        'field_goal_percentage': fg.get('pct') or 0,
        'three_point_percentage': three.get('pct') or 0,
        'free_throw_percentage': ft.get('pct') or 0,
        'three_point_attempts_per_game': round((three.get('attempted') or 0) / games, 1),

        # Advanced stats
        'true_shooting_percentage': raw.get('trueShootingPct') or 0,
        'effective_field_goal_percentage': raw.get('effectiveFieldGoalPct') or 0,
        'usage_rate': raw.get('usage') or 0,
        'offensive_rating': raw.get('offensiveRating') or 0,
        'defensive_rating': raw.get('defensiveRating') or 0,
        'net_rating': raw.get('netRating') or 0,
        'win_shares': ws.get('total') or 0,
        'win_shares_per_40': ws.get('totalPer40') or 0,
        'assists_turnover_ratio': raw.get('assistsTurnoverRatio') or 0,
        'offensive_rebound_pct': raw.get('offensiveReboundPct') or 0,
        'free_throw_rate': raw.get('freeThrowRate') or 0,
        'porpag': raw.get('PORPAG') or 0,
    }


def filter_and_normalize(raw_list: List[Dict], season: int) -> List[Dict]:
    """Filter for major conferences and minimum thresholds, then normalize."""
    results = []
    for raw in raw_list:
        conf = raw.get('conference', '')
        if conf not in MAJOR_CONFERENCES:
            continue

        games = raw.get('games') or 0
        minutes = raw.get('minutes') or 0
        mpg = minutes / games if games > 0 else 0

        if games >= MIN_GAMES and mpg >= MIN_MINUTES_PER_GAME:
            results.append(normalize_player(raw, season))

    return results


def main():
    if not API_KEY:
        print('ERROR: CBBD_API_KEY environment variable not set.')
        print('Set it with: export CBBD_API_KEY="your_key_here"')
        sys.exit(1)

    print('=' * 60)
    print('HISTORICAL COLLEGE BASKETBALL DATA COLLECTOR')
    print('=' * 60)
    print(f'Target seasons: {START_YEAR}-{END_YEAR}')
    print(f'Conferences: {len(MAJOR_CONFERENCES)} major conferences')
    print(f'Filters: min {MIN_GAMES} games, {MIN_MINUTES_PER_GAME} MPG')
    print(f'Strategy: 1 request/season ({END_YEAR - START_YEAR + 1} total)')
    print()

    os.makedirs('../data', exist_ok=True)

    all_players = []

    for year in range(START_YEAR, END_YEAR + 1):
        raw_data = fetch_season_stats(year)

        if raw_data:
            season_players = filter_and_normalize(raw_data, year)
            all_players.extend(season_players)
            print(f'    -> {len(season_players)} qualifying players from major conferences')

        # Save progress after each year
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(all_players, f, indent=2)

        # Polite delay between requests
        time.sleep(0.5)

    print()
    print('=' * 60)
    print('DATA COLLECTION COMPLETE')
    print('=' * 60)
    print(f'Total qualifying player-seasons: {len(all_players)}')
    unique = len(set(p['name'] for p in all_players))
    print(f'Unique player names: {unique}')
    print(f'Output: {OUTPUT_FILE}')

    if all_players:
        print('\nSample record:')
        sample = all_players[0]
        print(f'  {sample["name"]} | {sample["team"]} | {sample["season"]}')
        print(f'  {sample["points_per_game"]} PPG, {sample["rebounds_per_game"]} RPG, {sample["assists_per_game"]} APG')
        print(f'  FG: {sample["field_goal_percentage"]}%, 3P: {sample["three_point_percentage"]}%, FT: {sample["free_throw_percentage"]}%')
        print(f'  TS%: {sample["true_shooting_percentage"]}, Usage: {sample["usage_rate"]}%, WS: {sample["win_shares"]}')

    print('\nNext step: Run fetch_nba_data.py to match NBA career stats')


if __name__ == '__main__':
    main()
