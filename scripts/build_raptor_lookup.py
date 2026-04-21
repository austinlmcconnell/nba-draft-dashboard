"""
Build raptor_lookup.json from FiveThirtyEight's historical RAPTOR CSV.

Career RAPTOR = weighted average of Raptor+/- by minutes played,
regular-season games only.

Output: public/data/raptor_lookup.json
  {
    "lebron james": { "raptor": 7.2, "mp": 45321, "seasons": 20, "display": "LeBron James" },
    ...
  }

Keyed by lowercased name for case-insensitive lookup.
"""

import csv
import json
import io
import os
import re
import urllib.request
from collections import defaultdict

CSV_URL = 'https://raw.githubusercontent.com/fivethirtyeight/nba-player-advanced-metrics/master/nba-data-historical.csv'
OUT_PATH = os.path.join(os.path.dirname(__file__), '../draft-dashboard/public/data/raptor_lookup.json')


def normalize(name: str) -> str:
    name = name.strip().lower()
    name = re.sub(r"[''`]", '', name)
    name = re.sub(r'\s+(jr|sr|ii|iii|iv|v)\.?\s*$', '', name)
    name = re.sub(r'[^a-z\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def main():
    print(f'Fetching {CSV_URL}...')
    with urllib.request.urlopen(CSV_URL, timeout=30) as resp:
        raw = resp.read().decode('utf-8')

    rows = list(csv.DictReader(io.StringIO(raw)))
    print(f'  {len(rows):,} rows loaded')

    # Accumulate weighted RAPTOR per player (RS only)
    # { normalized_name: { display, total_weighted, total_mp, seasons } }
    acc: dict[str, dict] = defaultdict(lambda: {
        'display': '',
        'total_weighted': 0.0,
        'total_mp': 0,
        'seasons': set(),
    })

    skipped = 0
    for row in rows:
        if row.get('type', '').strip() != 'RS':
            continue

        name = row.get('name_common', '').strip()
        if not name:
            continue

        raptor_str = row.get('Raptor+/-', '').strip()
        mp_str = row.get('Min', '').strip()

        if not raptor_str or raptor_str in ('NULL', 'NA', ''):
            skipped += 1
            continue
        if not mp_str or mp_str in ('NULL', 'NA', ''):
            skipped += 1
            continue

        try:
            raptor = float(raptor_str)
            mp = int(float(mp_str))
        except ValueError:
            skipped += 1
            continue

        if mp <= 0:
            continue

        key = normalize(name)
        acc[key]['display'] = name
        acc[key]['total_weighted'] += raptor * mp
        acc[key]['total_mp'] += mp
        try:
            acc[key]['seasons'].add(int(row.get('year_id', 0)))
        except ValueError:
            pass

    print(f'  {skipped} rows skipped (null RAPTOR or minutes)')

    # Build final lookup
    lookup: dict[str, dict] = {}
    for key, data in acc.items():
        if data['total_mp'] < 100:  # filter out truly empty rows
            continue
        career_raptor = data['total_weighted'] / data['total_mp']
        lookup[key] = {
            'raptor': round(career_raptor, 2),
            'mp': data['total_mp'],
            'seasons': len(data['seasons']),
            'display': data['display'],
        }

    print(f'  {len(lookup):,} players with ≥500 career minutes written')

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(lookup, f, indent=2, sort_keys=True)

    print(f'Written to {OUT_PATH}')

    # Spot-check a few known players
    for name in ['LeBron James', 'Stephen Curry', 'Giannis Antetokounmpo', 'Kevin Durant']:
        key = normalize(name)
        if key in lookup:
            e = lookup[key]
            print(f'  {name}: RAPTOR {e["raptor"]:+.2f} over {e["seasons"]} seasons ({e["mp"]:,} min)')
        else:
            print(f'  {name}: NOT FOUND')


if __name__ == '__main__':
    main()
