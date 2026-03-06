#!/usr/bin/env python3
"""
Enrich historical players in nba_career_stats.json with height/weight
from the ESPN core athlete API.

ESPN stores a profile for every college basketball player they have ever
tracked — including non-NBA players going back decades.  The stable
endpoint is:

  GET https://sports.core.api.espn.com/v2/sports/basketball
      /leagues/mens-college-basketball/athletes/{espn_athlete_id}

This works for any player whose record in historical_college_stats.json
carries a real ESPN athlete ID (athleteSourceId).

NOTE: The older historical records (seasons 2005-2021) were fetched by
fetch_college_data.py before it was fixed to use athleteSourceId.  Those
records carry CBBD-internal athlete IDs (< 200 000) which do not resolve
on ESPN's modern APIs.  Re-run fetch_college_data.py + fetch_nba_data.py
with a valid CBBD_API_KEY to regenerate nba_career_stats.json with proper
ESPN IDs, then run this script again for full coverage.

Usage:
    cd scripts/
    python3 enrich_historical_physical.py
"""

import json
import os
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
CAREER_FILE = '../data/nba_career_stats.json'
PUBLIC_DIR  = '../draft-dashboard/public/data'

ESPN_CORE   = (
    'https://sports.core.api.espn.com/v2/sports/basketball'
    '/leagues/mens-college-basketball/athletes'
)
HEADERS = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
MAX_WORKERS = 20   # ESPN core API handles parallel reads well
TIMEOUT     = 10   # seconds per request

# Only try IDs in the modern ESPN range — CBBD-internal IDs (<200 000)
# return 404 and waste quota.
MIN_VALID_ESPN_ID = 200_001


# ---------------------------------------------------------------------------
# Fetch one athlete's physical data from ESPN core API
# ---------------------------------------------------------------------------
def fetch_athlete_physical(athlete_id: int) -> Optional[dict]:
    """
    Return {'height_inches': float|None, 'weight_pounds': int|None}
    or None on failure / 404.
    """
    try:
        r = requests.get(f'{ESPN_CORE}/{athlete_id}', headers=HEADERS, timeout=TIMEOUT)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        d = r.json()
        ht = d.get('height')
        wt = d.get('weight')
        return {
            'height_inches': float(ht) if ht is not None else None,
            'weight_pounds': int(wt)   if wt is not None else None,
        }
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(CAREER_FILE) as f:
        players = json.load(f)

    # Identify players that need physical data AND have a valid ESPN athlete ID
    needs = [
        p for p in players
        if (not p.get('physical')
            or (not (p.get('physical') or {}).get('height_inches')
                and not (p.get('physical') or {}).get('weight_pounds')))
        and isinstance((p.get('college_stats') or {}).get('athlete_id'), int)
        and p['college_stats']['athlete_id'] >= MIN_VALID_ESPN_ID
    ]

    total_missing = sum(
        1 for p in players
        if not p.get('physical')
        or (not (p.get('physical') or {}).get('height_inches')
            and not (p.get('physical') or {}).get('weight_pounds'))
    )
    print(f'Players missing physical data:  {total_missing}')
    print(f'  — with valid ESPN ID (≥{MIN_VALID_ESPN_ID}): {len(needs)}')
    print(f'  — with legacy CBBD ID (skipped): {total_missing - len(needs)}')

    if not needs:
        print('\nNothing to fetch.  Re-run fetch_college_data.py with a valid')
        print('CBBD_API_KEY to regenerate historical records with ESPN source IDs,')
        print('then run this script again.')
        return

    print(f'\nFetching {len(needs)} athlete profiles from ESPN core API '
          f'(up to {MAX_WORKERS} parallel)…')

    # Build id → player index for fast lookup
    id_to_player = {p['college_stats']['athlete_id']: p for p in needs}

    done    = 0
    updated = 0
    total   = len(needs)

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(fetch_athlete_physical, aid): aid
            for aid in id_to_player
        }
        for fut in as_completed(futures):
            aid    = futures[fut]
            result = fut.result()
            done  += 1

            if result and (result['height_inches'] or result['weight_pounds']):
                p = id_to_player[aid]
                if not p.get('physical'):
                    p['physical'] = {
                        'height_inches': None, 'weight_pounds': None,
                        'wingspan_inches': None, 'age_at_season_start': None,
                    }
                if result['height_inches'] and not p['physical'].get('height_inches'):
                    p['physical']['height_inches'] = result['height_inches']
                if result['weight_pounds'] and not p['physical'].get('weight_pounds'):
                    p['physical']['weight_pounds'] = result['weight_pounds']
                updated += 1

            if done % 200 == 0 or done == total:
                print(f'  {done}/{total} fetched  ({updated} updated so far)')

    print(f'\nPlayers updated: {updated} / {len(needs)}')

    # Save
    with open(CAREER_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy(CAREER_FILE, f'{PUBLIC_DIR}/nba_career_stats.json')
    print(f'Saved → {CAREER_FILE}  +  {PUBLIC_DIR}/')

    # Coverage summary
    now_has = sum(
        1 for p in players
        if p.get('physical') and p['physical'].get('height_inches')
    )
    print(f'Physical data coverage: {now_has}/{len(players)} '
          f'({100 * now_has // len(players)}%)')


if __name__ == '__main__':
    main()
