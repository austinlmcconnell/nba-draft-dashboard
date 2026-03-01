#!/usr/bin/env python3
"""
Fetch physical attributes AND correct ESPN athlete IDs for 2026 players
via the ESPN team roster API — no auth required.

For each unique espn_team_id in our 2026 data we call:
  https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{team_id}/roster

We then name-match roster athletes to our player records and write back:
  • athlete_id  – ESPN's athlete id (for headshot CDN)
  • height_inches
  • weight_pounds
"""

import json
import os
import re
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional

import requests

COLLEGE_DATA_FILE = '../data/historical_college_stats.json'
PUBLIC_DATA_DIR   = '../draft-dashboard/public/data'
CURRENT_SEASON    = 2026
MAX_WORKERS       = 12
HEADERS           = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
ESPN_BASE         = 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball'

# ---------------------------------------------------------------------------
# Name normalisation (mirrors fetch_nba_data.py)
# ---------------------------------------------------------------------------
_SUFFIX_RE = re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', re.IGNORECASE)
_PUNCT_RE  = re.compile(r"[,\.']")


def _norm(name: str) -> str:
    name = _SUFFIX_RE.sub('', name)
    name = _PUNCT_RE.sub('', name)
    return ' '.join(name.lower().split())


def _names_match(a: str, b: str) -> bool:
    """True if names match exactly (normalised), or share last + first-3-chars."""
    na, nb = _norm(a), _norm(b)
    if na == nb:
        return True
    pa, pb = na.split(), nb.split()
    if len(pa) >= 2 and len(pb) >= 2:
        return pa[-1] == pb[-1] and pa[0][:3] == pb[0][:3]
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


def fetch_team_roster(team_id: int) -> List[Dict]:
    """Return list of {name, espn_id, height_inches, weight_pounds} for a team."""
    url = f'{ESPN_BASE}/teams/{team_id}/roster'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code != 200:
            return []
        data = resp.json()
        athletes = data.get('athletes', [])
        result = []
        for a in athletes:
            espn_id = a.get('id') or a.get('uid', '').split(':')[-1]
            result.append({
                'name':          a.get('displayName') or a.get('fullName', ''),
                'espn_id':       int(espn_id) if espn_id else None,
                'height_inches': parse_height(a.get('height')),
                'weight_pounds': int(a['weight']) if a.get('weight') else None,
            })
        return result
    except Exception as e:
        print(f'  WARN team {team_id}: {e}')
        return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(COLLEGE_DATA_FILE) as f:
        players = json.load(f)

    current = [p for p in players if p.get('season') == CURRENT_SEASON]
    print(f'{len(current)} records for season {CURRENT_SEASON}')

    # Unique ESPN team IDs (skip None)
    team_ids = sorted({p['espn_team_id'] for p in current if p.get('espn_team_id')})
    print(f'Fetching rosters for {len(team_ids)} teams ...')

    # Fetch all rosters in parallel
    roster_by_team: Dict[int, List[Dict]] = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_team_roster, tid): tid for tid in team_ids}
        done = 0
        for fut in as_completed(futures):
            tid = futures[fut]
            roster_by_team[tid] = fut.result()
            done += 1
            if done % 20 == 0 or done == len(team_ids):
                total_players = sum(len(r) for r in roster_by_team.values())
                print(f'  {done}/{len(team_ids)} teams — {total_players} roster athletes so far')

    total_roster = sum(len(r) for r in roster_by_team.values())
    print(f'\nRoster athletes fetched: {total_roster}')

    # Match each player record to a roster entry
    updated_id = 0
    updated_phys = 0

    for p in players:
        if p.get('season') != CURRENT_SEASON:
            continue
        tid = p.get('espn_team_id')
        if not tid or tid not in roster_by_team:
            continue

        roster = roster_by_team[tid]
        match = next((r for r in roster if _names_match(p['name'], r['name'])), None)
        if not match:
            continue

        if match['espn_id']:
            p['athlete_id'] = match['espn_id']
            updated_id += 1

        if match['height_inches'] is not None:
            p['height_inches'] = match['height_inches']
            updated_phys += 1
        if match['weight_pounds'] is not None:
            p['weight_pounds'] = match['weight_pounds']

    print(f'athlete_id updated:   {updated_id}')
    print(f'height/weight added:  {updated_phys}')

    # Sample a few results
    sample = [p for p in players if p.get('season') == CURRENT_SEASON
              and p.get('height_inches')][:5]
    print('\nSample:')
    for p in sample:
        print(f"  {p['name']} ({p['team']}): "
              f"{p.get('height_inches')}in, {p.get('weight_pounds')}lb, "
              f"athlete_id={p.get('athlete_id')}")

    # Save
    with open(COLLEGE_DATA_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    shutil.copy(COLLEGE_DATA_FILE, f'{PUBLIC_DATA_DIR}/historical_college_stats.json')
    print(f'\nSaved → {COLLEGE_DATA_FILE}  +  {PUBLIC_DATA_DIR}/')


if __name__ == '__main__':
    main()
