#!/usr/bin/env python3
"""
Enrich historical_college_stats.json with height/weight from CBBD roster API.

CBBD /teams/roster returns player id (= our athlete_id), height (inches),
and weight (pounds) directly — no ESPN lookup needed.

Usage:
    export CBBD_API_KEY="..."
    cd scripts/
    python3 enrich_physical_cbbd.py
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests

API_KEY  = os.environ.get('CBBD_API_KEY')
BASE_URL = 'https://api.collegebasketballdata.com'
DATA_FILE = '../data/historical_college_stats.json'
MAX_WORKERS = 12
TIMEOUT = 20


def headers():
    return {'Authorization': f'Bearer {API_KEY}', 'accept': 'application/json'}


def fetch_roster(team: str, season: int):
    """Returns list of {id, height_inches, weight_pounds} for a team/season."""
    try:
        r = requests.get(
            f'{BASE_URL}/teams/roster',
            params={'team': team, 'season': season},
            headers=headers(),
            timeout=TIMEOUT,
        )
        if r.status_code != 200:
            return team, season, []
        data = r.json()
        players = []
        for entry in data:
            for p in entry.get('players', []):
                pid = p.get('id')
                h = p.get('height')   # already in inches
                w = p.get('weight')   # already in pounds
                if pid and (h or w):
                    players.append({'id': pid, 'height_inches': h, 'weight_pounds': w})
        return team, season, players
    except Exception as e:
        return team, season, []


def main():
    if not API_KEY:
        print('ERROR: CBBD_API_KEY not set.')
        sys.exit(1)

    with open(DATA_FILE) as f:
        data = json.load(f)

    # Find records missing physical data
    missing = [p for p in data if not p.get('height_inches') or not p.get('weight_pounds')]
    print(f'Records missing height/weight: {len(missing):,} / {len(data):,}')

    # Collect unique (team, season) pairs
    pairs = sorted(set((p['team'], p['season']) for p in missing))
    print(f'Unique (team, season) to fetch: {len(pairs):,}')

    # Fetch all rosters in parallel
    phys_lookup = {}  # cbbd_athlete_id -> {height_inches, weight_pounds}
    done = 0
    errors = 0

    print(f'Fetching rosters ({MAX_WORKERS} workers)...')
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_roster, team, season): (team, season)
                   for team, season in pairs}
        for fut in as_completed(futures):
            team, season, players = fut.result()
            done += 1
            if not players:
                errors += 1
            for p in players:
                pid = p['id']
                if pid not in phys_lookup:
                    phys_lookup[pid] = {
                        'height_inches': p['height_inches'],
                        'weight_pounds': p['weight_pounds'],
                    }
            if done % 200 == 0 or done == len(pairs):
                print(f'  {done}/{len(pairs)} fetched  ({len(phys_lookup):,} athletes indexed, {errors} empty)')

    print(f'\nPhysical data indexed for {len(phys_lookup):,} athletes')

    # Enrich records
    enriched = 0
    for p in data:
        if p.get('height_inches') and p.get('weight_pounds'):
            continue
        aid = p.get('athlete_id')
        if aid and aid in phys_lookup:
            phys = phys_lookup[aid]
            if phys.get('height_inches') and not p.get('height_inches'):
                p['height_inches'] = phys['height_inches']
            if phys.get('weight_pounds') and not p.get('weight_pounds'):
                p['weight_pounds'] = phys['weight_pounds']
            enriched += 1

    print(f'Records enriched: {enriched:,}')

    # Coverage
    has_both = sum(1 for p in data if p.get('height_inches') and p.get('weight_pounds'))
    print(f'Coverage after: {has_both:,}/{len(data):,} ({100*has_both/len(data):.1f}%)')

    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)
    print(f'Saved → {DATA_FILE}')


if __name__ == '__main__':
    main()
