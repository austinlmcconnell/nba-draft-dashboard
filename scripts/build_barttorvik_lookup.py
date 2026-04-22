#!/usr/bin/env python3
"""
Build BartTorvik college advanced-stats lookup.

Fetches per-season player data from https://barttorvik.com/getadvstats.php
for seasons 2008 through 2026 and writes a single JSON lookup keyed by
normalized "name|season" so we can join this data to our historical
college dataset (nba_career_stats.json) and to current prospects.

Primary metric: PRPG! (Points per Replacement Player per Game) — BartTorvik's
single-number player value that captures both offensive and defensive impact,
adjusted for competition level and pace.

Usage:
    pip install requests
    python3 scripts/build_barttorvik_lookup.py

Rate limit: 6 s between requests (conservative — barttorvik.com has DNS-level
throttling when hit too hard).
"""

import csv
import json
import re
import time
import unicodedata
from io import StringIO
from pathlib import Path

import requests

OUT_PATH = Path(__file__).parent.parent / 'draft-dashboard/public/data/barttorvik_lookup.json'
SEASONS  = range(2008, 2027)  # BartTorvik data goes back to 2008
DELAY    = 6  # seconds between requests

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
}


def normalize(name: str) -> str:
    """Match the key style used by our existing BPM lookup."""
    name = unicodedata.normalize('NFD', str(name))
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower()
    name = re.sub(r"[''`]", '', name)
    name = re.sub(r'\b(jr\.?|sr\.?|ii|iii|iv)\b', '', name)
    name = re.sub(r'[^a-z\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fetch_season(year: int) -> list[dict]:
    """
    Returns a list of player dicts for the given season.
    The endpoint returns a headerless CSV with 67 columns; we map the ones
    we care about by index.
    """
    url = f'https://barttorvik.com/getadvstats.php?year={year}&csv=1'
    resp = requests.get(url, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    body = resp.text

    if '<html' in body[:200].lower() or '<!doctype' in body[:200].lower():
        raise RuntimeError(f'Got HTML (blocked) for year {year}')

    reader = csv.reader(StringIO(body))
    out = []
    for row in reader:
        if len(row) < 49:
            continue
        try:
            prpg = float(row[28]) if row[28] else None
            adj_ortg = float(row[5]) if row[5] else None
            adj_drtg = float(row[46]) if row[46] else None
        except ValueError:
            continue

        if prpg is None:
            continue

        out.append({
            'name':         row[0],
            'team':         row[1],
            'conference':   row[2],
            'season':       year,
            'class_year':   row[25],   # Fr/So/Jr/Sr
            'height':       row[26],
            'games':        int(row[3])   if row[3] else 0,
            'min_pct':      float(row[4]) if row[4] else 0.0,
            'prpg':         round(prpg, 3),
            'adj_ortg':     round(adj_ortg, 2) if adj_ortg is not None else None,
            'adj_drtg':     round(adj_drtg, 2) if adj_drtg is not None else None,
            'usage':        float(row[6]) if row[6] else None,
            'ts_pct':       float(row[8]) if row[8] else None,
            'efg_pct':      float(row[7]) if row[7] else None,
            'position':     row[64] if len(row) > 64 else None,  # e.g. "Wing F"
        })
    return out


def main() -> None:
    lookup: dict = {}
    total = 0

    for year in SEASONS:
        print(f'Season {year - 1}-{str(year)[2:]} ...', end=' ', flush=True)
        try:
            players = fetch_season(year)
        except Exception as e:
            print(f'FAILED: {e}')
            time.sleep(DELAY)
            continue

        for p in players:
            key = f'{normalize(p["name"])}|{p["season"]}'
            # if two players share a name+season (rare), prefer the one with more games
            prev = lookup.get(key)
            if prev is None or p['games'] > prev['games']:
                lookup[key] = p

        total += len(players)
        print(f'{len(players)} players')
        time.sleep(DELAY)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(lookup, f, indent=2)

    print(f'\nWrote {len(lookup)} unique (name|season) records from {total} total rows')
    print(f'→ {OUT_PATH}')

    # Spot checks
    for check in [
        ('aj dybantsa',       2026),
        ('cameron boozer',    2026),
        ('darryn peterson',   2026),
        ('zion williamson',   2019),
        ('rj barrett',        2019),
        ('marshon brooks',    2011),
    ]:
        key = f'{check[0]}|{check[1]}'
        p = lookup.get(key)
        if p:
            print(f'  {p["name"]:<22} {p["team"]:<15} {p["season"]}  '
                  f'PRPG={p["prpg"]:>5.2f}  adjORtg={p["adj_ortg"]}  adjDRtg={p["adj_drtg"]}')
        else:
            print(f'  {check[0]} {check[1]}: NOT FOUND')


if __name__ == '__main__':
    main()
