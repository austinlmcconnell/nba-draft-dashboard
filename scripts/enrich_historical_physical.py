#!/usr/bin/env python3
"""
Enrich historical players in nba_career_stats.json with height/weight
from the ESPN college basketball historical roster API.

ESPN supports season-specific team rosters:
  GET https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball
      /teams/{team_id}/roster?season={year}

We iterate over all unique (team, season) pairs in nba_career_stats.json
that are currently missing physical data, map team names to ESPN IDs via
the existing team_metadata.json, and write height/weight back to both
nba_career_stats.json and the public/data copy.

Usage:
    cd scripts/
    python3 enrich_historical_physical.py

No API key required — ESPN's roster endpoint is public.
"""

import json
import os
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
CAREER_FILE    = '../data/nba_career_stats.json'
METADATA_FILE  = '../draft-dashboard/public/data/team_metadata.json'
PUBLIC_DIR     = '../draft-dashboard/public/data'
ESPN_BASE      = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'
HEADERS        = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
MAX_WORKERS    = 16   # parallel roster fetches
TIMEOUT        = 15   # seconds per request

# ---------------------------------------------------------------------------
# Name normalisation (mirrors fetch_nba_data.py / fetch_physical_data.py)
# ---------------------------------------------------------------------------
_ACCENT_MAP = str.maketrans(
    'àáâãäåèéêëìíîïòóôõöøùúûüñçý',
    'aaaaaaeeeeiiiioooooouuuuncy'
)
_SUFFIX_RE = re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', re.IGNORECASE)
_PUNCT_RE  = re.compile(r"[,\.'']")


def _norm(name: str) -> str:
    name = name.translate(_ACCENT_MAP)
    name = _SUFFIX_RE.sub('', name)
    name = _PUNCT_RE.sub('', name)
    return ' '.join(name.lower().split())


def _names_match(a: str, b: str) -> bool:
    na, nb = _norm(a), _norm(b)
    if na == nb:
        return True
    pa, pb = na.split(), nb.split()
    if len(pa) >= 2 and len(pb) >= 2:
        # Last name + first 4 chars of first name
        return pa[-1] == pb[-1] and pa[0][:4] == pb[0][:4]
    return False


# ---------------------------------------------------------------------------
# ESPN roster fetch
# ---------------------------------------------------------------------------
def parse_height(val) -> Optional[int]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return int(val)
    m = re.match(r"(\d+)'(\d+)", str(val))
    if m:
        return int(m.group(1)) * 12 + int(m.group(2))
    try:
        return int(float(str(val)))
    except ValueError:
        return None


def fetch_roster(team_id: int, season: int) -> List[Dict]:
    """
    Fetch ESPN team roster for a specific season.
    ESPN uses the end year of the season (e.g., 2007 for 2006-07).
    Returns a list of {name, height_inches, weight_pounds}.
    """
    url = f'{ESPN_BASE}/teams/{team_id}/roster'
    try:
        resp = requests.get(url, params={'season': season}, headers=HEADERS, timeout=TIMEOUT)
        if resp.status_code != 200:
            return []
        data = resp.json()
        athletes = data.get('athletes', [])
        result = []
        for a in athletes:
            name = a.get('displayName') or a.get('fullName', '')
            if not name:
                continue
            h = parse_height(a.get('height'))
            w = int(a['weight']) if a.get('weight') else None
            if h or w:
                result.append({'name': name, 'height_inches': h, 'weight_pounds': w})
        return result
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    # Load data
    with open(CAREER_FILE) as f:
        players: List[Dict] = json.load(f)

    with open(METADATA_FILE) as f:
        team_meta: Dict[str, Dict] = json.load(f)

    # Build team-name → ESPN source ID lookup (normalised keys)
    team_id_map: Dict[str, int] = {}
    for team_name, meta in team_meta.items():
        eid = meta.get('espn_source_id')
        if eid:
            team_id_map[_norm(team_name)] = int(eid)

    # Identify players that need physical data
    needs_phys = [
        p for p in players
        if (not p.get('physical')
            or (not p['physical'].get('height_inches') and not p['physical'].get('weight_pounds')))
        and p.get('college_team')
        and p.get('college_season')
    ]
    print(f'Players needing physical data: {len(needs_phys)}')

    # Collect unique (team_name, season) → ESPN team ID
    combos: Dict[Tuple[str, int], int] = {}
    skipped_teams = set()
    for p in needs_phys:
        team_norm = _norm(p['college_team'])
        season    = int(p['college_season'])
        if team_norm in team_id_map:
            combos[(team_norm, season)] = team_id_map[team_norm]
        else:
            skipped_teams.add(p['college_team'])

    if skipped_teams:
        print(f'Teams not found in metadata (will skip): {sorted(skipped_teams)}')

    print(f'Unique (team, season) combos to fetch: {len(combos)}')
    if not combos:
        print('Nothing to fetch — exiting.')
        return

    # Fetch all rosters in parallel
    roster_cache: Dict[Tuple[str, int], List[Dict]] = {}  # (team_norm, season) → athletes
    total   = len(combos)
    done    = 0
    matched_total = 0

    print(f'Fetching {total} rosters (up to {MAX_WORKERS} parallel)…')
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(fetch_roster, espn_id, season): (team_norm, season)
            for (team_norm, season), espn_id in combos.items()
        }
        for fut in as_completed(futures):
            key = futures[fut]
            athletes = fut.result()
            roster_cache[key] = athletes
            done += 1
            if done % 100 == 0 or done == total:
                print(f'  {done}/{total} rosters fetched')

    # Match players to roster entries
    print('\nMatching players to roster entries…')
    updated = 0
    for p in needs_phys:
        team_norm = _norm(p['college_team'])
        season    = int(p['college_season'])
        key       = (team_norm, season)
        athletes  = roster_cache.get(key, [])
        if not athletes:
            continue

        match = next((a for a in athletes if _names_match(p['name'], a['name'])), None)
        if not match:
            continue

        if not p.get('physical'):
            p['physical'] = {'height_inches': None, 'weight_pounds': None,
                             'wingspan_inches': None, 'age_at_season_start': None}

        if match['height_inches'] is not None and not p['physical'].get('height_inches'):
            p['physical']['height_inches'] = match['height_inches']
        if match['weight_pounds'] is not None and not p['physical'].get('weight_pounds'):
            p['physical']['weight_pounds'] = match['weight_pounds']

        updated += 1

    print(f'Players updated with physical data: {updated} / {len(needs_phys)}')

    # Save
    with open(CAREER_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy(CAREER_FILE, f'{PUBLIC_DIR}/nba_career_stats.json')
    print(f'\nSaved → {CAREER_FILE}  +  {PUBLIC_DIR}/')

    # Coverage summary
    now_has  = sum(1 for p in players if p.get('physical') and p['physical'].get('height_inches'))
    print(f'Physical data coverage: {now_has}/{len(players)} ({100*now_has//len(players)}%)')


if __name__ == '__main__':
    main()
