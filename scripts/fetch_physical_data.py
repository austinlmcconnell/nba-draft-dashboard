#!/usr/bin/env python3
"""
Fetch physical attributes (height, weight) for current-season players
using ESPN's public athlete API, keyed by the athlete_id already in our data.
"""

import json
import os
import re
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, Optional

import requests

COLLEGE_DATA_FILE = '../data/historical_college_stats.json'
PUBLIC_DATA_DIR   = '../draft-dashboard/public/data'
CURRENT_SEASON    = 2026
MAX_WORKERS       = 15
HEADERS           = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}


def parse_height(val) -> Optional[int]:
    """Convert ESPN height value to inches.  Can be int, float, or string like "6'10\""."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val)
    m = re.match(r"(\d+)'(\d+)", s)
    if m:
        return int(m.group(1)) * 12 + int(m.group(2))
    try:
        return int(float(s))
    except ValueError:
        return None


def fetch_athlete(athlete_id: int) -> Optional[Dict]:
    """Return {height_inches, weight_pounds} for one athlete, or None."""
    url = f'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/athletes/{athlete_id}'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        data = resp.json()
        # Response shape varies; athlete data may be nested or at root
        athlete = data.get('athlete') or data
        h = parse_height(athlete.get('height'))
        w_raw = athlete.get('weight')
        w = int(w_raw) if w_raw else None
        if h or w:
            return {'height_inches': h, 'weight_pounds': w}
    except Exception:
        pass
    return None


def main():
    with open(COLLEGE_DATA_FILE) as f:
        players = json.load(f)

    current = [p for p in players if p.get('season') == CURRENT_SEASON and p.get('athlete_id')]
    print(f'Fetching physical data for {len(current)} season={CURRENT_SEASON} players '
          f'({MAX_WORKERS} parallel workers)...')

    unique_ids = list({p['athlete_id'] for p in current})
    physical_map: Dict[int, Dict] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_athlete, aid): aid for aid in unique_ids}
        done = 0
        for future in as_completed(futures):
            aid = futures[future]
            result = future.result()
            if result:
                physical_map[aid] = result
            done += 1
            if done % 100 == 0 or done == len(unique_ids):
                print(f'  {done}/{len(unique_ids)} fetched — {len(physical_map)} with data so far')

    hit = len(physical_map)
    print(f'\nPhysical data found: {hit}/{len(unique_ids)} ({hit*100//len(unique_ids)}%)')

    # Patch records
    updated = 0
    for p in players:
        if p.get('season') == CURRENT_SEASON:
            aid = p.get('athlete_id')
            if aid and aid in physical_map:
                phys = physical_map[aid]
                p['height_inches'] = phys.get('height_inches')
                p['weight_pounds'] = phys.get('weight_pounds')
                updated += 1

    print(f'Patched {updated} player records')

    with open(COLLEGE_DATA_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    shutil.copy(COLLEGE_DATA_FILE, f'{PUBLIC_DATA_DIR}/historical_college_stats.json')
    print(f'Saved → {COLLEGE_DATA_FILE}  +  {PUBLIC_DATA_DIR}/')

    # Show a few samples
    samples = [(aid, phys) for aid, phys in list(physical_map.items())[:5]]
    print('\nSamples:')
    for aid, phys in samples:
        print(f'  athlete_id={aid}: {phys}')


if __name__ == '__main__':
    main()
