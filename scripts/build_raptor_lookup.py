#!/usr/bin/env python3
"""
Build NBA career RAPTOR lookup from FiveThirtyEight open-data CSVs.

Sources (GitHub raw, no auth required):
  modern_RAPTOR_by_player.csv   — 2014-2022, box-score + on/off component
  historical_RAPTOR_by_player.csv — 2008-2013, box-score only

Strategy: use modern for 2014-2022, historical for 2008-2013.
Where both cover the same player-season, modern wins (better methodology).

Career average = MP-weighted mean of raptor_total across all seasons in range.
Players with < MIN_MP total in the RAPTOR data are excluded (unreliable sample).

Output: draft-dashboard/public/data/raptor_lookup.json
  { "jamal murray": { "raptor": 1.834, "mp": 11645, "seasons": 5, "display": "Jamal Murray" } }

RAPTOR scale (per 100 possessions):
  > +6  : All-time elite
  +2..+6: All-Star / star
  0..+2 : Good starter
  -2..0 : Rotation player
  < -2  : Below replacement
"""

import csv
import io
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

import requests

MODERN_URL = (
    'https://raw.githubusercontent.com/fivethirtyeight/data/master/'
    'nba-raptor/modern_RAPTOR_by_player.csv'
)
HISTORICAL_URL = (
    'https://raw.githubusercontent.com/fivethirtyeight/data/master/'
    'nba-raptor/historical_RAPTOR_by_player.csv'
)

OUT_PATH = Path(__file__).parent.parent / 'draft-dashboard/public/data/raptor_lookup.json'
MIN_SEASON = 2008   # match college comp pool start year
MIN_MP     = 1500   # ~1 full season — filters cup-of-coffee NBA careers

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
}


def normalize(name: str) -> str:
    name = unicodedata.normalize('NFD', str(name))
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower()
    name = re.sub(r"[''`]", '', name)
    name = re.sub(r'\b(jr\.?|sr\.?|ii|iii|iv)\b', '', name)
    name = re.sub(r'[^a-z\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fetch_csv(url: str) -> list[dict]:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    reader = csv.DictReader(io.StringIO(resp.text))
    return list(reader)


def main() -> None:
    print('Fetching modern RAPTOR (2014-2022)…')
    modern_rows = fetch_csv(MODERN_URL)
    print(f'  {len(modern_rows)} rows')

    print('Fetching historical RAPTOR (pre-2014)…')
    hist_rows = fetch_csv(HISTORICAL_URL)
    print(f'  {len(hist_rows)} rows')

    # player_id|season → (player_name, mp, raptor_total, prefer_modern)
    # prefer modern when available; for pre-2014 only historical exists
    seen: dict[str, dict] = {}

    def add_row(row: dict, prefer: bool) -> None:
        season = int(row.get('season', 0))
        if season < MIN_SEASON:
            return
        pid = row.get('player_id', '').strip()
        if not pid:
            return
        mp_raw = row.get('mp', '').strip()
        rap_raw = row.get('raptor_total', '').strip()
        if not mp_raw or not rap_raw:
            return
        try:
            mp    = float(mp_raw)
            raptor = float(rap_raw)
        except ValueError:
            return
        if mp <= 0:
            return

        key = f'{pid}|{season}'
        if key not in seen or prefer:
            seen[key] = {
                'name':   row.get('player_name', '').strip(),
                'mp':     mp,
                'raptor': raptor,
            }

    # Load historical first (lower priority)
    for row in hist_rows:
        add_row(row, prefer=False)

    # Load modern second (higher priority, overrides historical 2014-2022)
    for row in modern_rows:
        add_row(row, prefer=True)

    print(f'Unique player-seasons (≥{MIN_SEASON}): {len(seen)}')

    # Aggregate to career MP-weighted average RAPTOR
    career: dict = defaultdict(lambda: {'mp': 0.0, 'raptor_sum': 0.0, 'seasons': 0, 'display': ''})
    for entry in seen.values():
        norm = normalize(entry['name'])
        c = career[norm]
        c['mp']         += entry['mp']
        c['raptor_sum'] += entry['raptor'] * entry['mp']
        c['seasons']    += 1
        if not c['display']:
            c['display'] = entry['name']

    lookup: dict = {}
    for norm, c in career.items():
        if c['mp'] < MIN_MP:
            continue
        lookup[norm] = {
            'raptor':  round(c['raptor_sum'] / c['mp'], 4),
            'mp':      int(c['mp']),
            'seasons': c['seasons'],
            'display': c['display'],
        }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(lookup, f, indent=2)

    print(f'\nWrote {len(lookup)} players → {OUT_PATH}')

    checks = [
        'jamal murray', 'brandin podziemski', 'stephen curry',
        'nikola jokic', 'lebron james', 'devin booker', 'jaylen brown',
        'kevin durant', 'james harden', 'anthony davis',
    ]
    for k in checks:
        e = lookup.get(k)
        if e:
            print(f'  {e["display"]:<26}  RAPTOR {e["raptor"]:+.3f}  ({e["mp"]:,} MP, {e["seasons"]}s)')
        else:
            print(f'  {k}: NOT FOUND')


if __name__ == '__main__':
    main()
