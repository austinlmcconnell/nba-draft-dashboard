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

    Column index reference (verified from getadvstats.php output):
       0 name             1 team              2 conference
       3 games            4 min_pct           5 adj_ortg
       6 usage            7 efg_pct           8 ts_pct
       9 orb_pct         10 drb_pct          11 ast_pct
      12 tov_pct         13 ftm              14 fta
      15 ft_pct          16 two_pm           17 two_pa
      18 two_pct         19 three_pm         20 three_pa
      21 three_pct       22 blk_pct          23 stl_pct
      24 ft_rate         25 class_year       26 height
      27 num             28 prpg             29 adj_ortg(dup)
      30 (unknown)       31 year             32 pid
      33 hometown        34 mp_total         35 (unknown)
      36 rim_made        37 rim_att          38 mid_made
      39 mid_att         40 rim_pct          41 mid_pct
      46 adj_drtg        64 position         (rest unused)
    """
    url = f'https://barttorvik.com/getadvstats.php?year={year}&csv=1'
    resp = requests.get(url, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    body = resp.text

    if '<html' in body[:200].lower() or '<!doctype' in body[:200].lower():
        raise RuntimeError(f'Got HTML (blocked) for year {year}')

    def f(v):
        try: return float(v) if v not in ('', None) else None
        except ValueError: return None

    def i(v):
        try: return int(v) if v not in ('', None) else 0
        except ValueError: return 0

    reader = csv.reader(StringIO(body))
    out = []
    for row in reader:
        if len(row) < 49:
            continue
        prpg     = f(row[28])
        adj_ortg = f(row[5])
        adj_drtg = f(row[46])
        if prpg is None:
            continue

        out.append({
            'name':         row[0],
            'team':         row[1],
            'conference':   row[2],
            'season':       year,
            'class_year':   row[25],
            'height':       row[26],
            'games':        i(row[3]),
            'min_pct':      f(row[4]) or 0.0,
            'prpg':         round(prpg, 3),
            'adj_ortg':     round(adj_ortg, 2) if adj_ortg is not None else None,
            'adj_drtg':     round(adj_drtg, 2) if adj_drtg is not None else None,
            'usage':        f(row[6]),
            'ts_pct':       f(row[8]),
            'efg_pct':      f(row[7]),
            'position':     row[64] if len(row) > 64 else None,
            # Per-possession rate stats (as percentages, BartTorvik native)
            'orb_pct':      f(row[9]),
            'drb_pct':      f(row[10]),
            'ast_pct':      f(row[11]),
            'tov_pct':      f(row[12]),
            'blk_pct':      f(row[22]),
            'stl_pct':      f(row[23]),
            'ft_rate':      f(row[24]),
            # Shooting splits (totals + percentages)
            'ftm':          i(row[13]),
            'fta':          i(row[14]),
            'ft_pct':       f(row[15]),
            'two_pm':       i(row[16]),
            'two_pa':       i(row[17]),
            'two_pct':      f(row[18]),
            'three_pm':     i(row[19]),
            'three_pa':     i(row[20]),
            'three_pct':    f(row[21]),
            # Shot location splits (HoopMath-derived) — rim vs 2pt jumper (mid)
            'rim_made':     i(row[36]) if len(row) > 36 else 0,
            'rim_att':      i(row[37]) if len(row) > 37 else 0,
            'mid_made':     i(row[38]) if len(row) > 38 else 0,
            'mid_att':      i(row[39]) if len(row) > 39 else 0,
            'rim_pct':      f(row[40]) if len(row) > 40 else None,
            'mid_pct':      f(row[41]) if len(row) > 41 else None,
            # Total minutes played (for per-40 derivations)
            'mp_total':     f(row[34]) if len(row) > 34 else None,
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
