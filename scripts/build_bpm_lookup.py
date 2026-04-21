#!/usr/bin/env python3
"""
Build BPM (Box Plus-Minus) career lookup from Basketball Reference per-season
advanced stats tables.

Scrapes NBA seasons 2005-06 through 2024-25 (year IDs 2006–2025), computes
minute-weighted career BPM for every player with ≥100 career minutes, and
writes draft-dashboard/public/data/bpm_lookup.json.

Usage:
    pip install requests beautifulsoup4 lxml pandas
    python3 scripts/build_bpm_lookup.py

Rate limit: sleeps 4 s between requests (~15 req/min, safely under BBRef's 20/min cap).
Full run takes ~90 seconds.
"""

import json
import re
import time
import unicodedata
from collections import defaultdict
from io import StringIO
from pathlib import Path

import requests
from bs4 import BeautifulSoup, Comment
import pandas as pd

OUT_PATH = Path(__file__).parent.parent / 'draft-dashboard/public/data/bpm_lookup.json'
MIN_MP   = 100       # minimum career minutes to include
SEASONS  = range(2006, 2026)  # NBA seasons ending 2006 through 2025

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}


def normalize(name: str) -> str:
    """Lowercase, strip diacritics/apostrophes/suffixes, collapse spaces."""
    name = unicodedata.normalize('NFD', str(name))
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower()
    name = re.sub(r"[''`]", '', name)
    name = re.sub(r'\b(jr\.?|sr\.?|ii|iii|iv)\b', '', name)
    name = re.sub(r'[^a-z\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fetch_season(year: int) -> pd.DataFrame | None:
    """
    Fetch the advanced stats table for the NBA season ending in `year`.
    Returns a DataFrame with [player, tm, mp, bpm] or None on failure.
    """
    url = f'https://www.basketball-reference.com/leagues/NBA_{year}_advanced.html'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f'  HTTP error {year}: {e}')
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')  # use bytes so BS4 handles UTF-8 correctly

    # Try both known table IDs ('advanced' in recent years, 'advanced_stats' in older pages)
    table = soup.find('table', {'id': 'advanced'}) or soup.find('table', {'id': 'advanced_stats'})
    if table is None:
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            cs = str(comment)
            if '<table' in cs and ('id="advanced"' in cs or 'id="advanced_stats"' in cs):
                inner = BeautifulSoup(cs, 'html.parser')
                table = inner.find('table', {'id': 'advanced'}) or inner.find('table', {'id': 'advanced_stats'})
                if table:
                    break

    if table is None:
        print(f'  No table for {year}')
        return None

    try:
        df = pd.read_html(StringIO(str(table)))[0]
    except Exception as e:
        print(f'  Parse error {year}: {e}')
        return None

    # Flatten MultiIndex columns if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['_'.join(str(c) for c in col).strip('_') for col in df.columns]

    df.columns = [str(c).lower().strip() for c in df.columns]

    # Drop repeated header rows BBRef inserts every N rows
    if 'player' in df.columns:
        df = df[df['player'] != 'Player'].copy()

    if 'bpm' not in df.columns:
        print(f'  No BPM column for {year} (columns: {list(df.columns)[:10]})')
        return None

    df['mp']  = pd.to_numeric(df.get('mp',  0), errors='coerce')
    df['bpm'] = pd.to_numeric(df['bpm'],        errors='coerce')
    df = df.dropna(subset=['mp', 'bpm'])
    df = df[df['mp'] > 0].copy()

    # For traded players, keep only the TOT (combined) row
    if 'tm' in df.columns:
        traded = df.groupby('player')['tm'].apply(lambda x: (x == 'TOT').any())
        traded_names = traded[traded].index
        df = df[~(df['player'].isin(traded_names) & (df['tm'] != 'TOT'))].copy()

    return df[['player', 'mp', 'bpm']].reset_index(drop=True)


def main() -> None:
    career: dict = defaultdict(lambda: {'bpm_x_mp': 0.0, 'mp': 0, 'seasons': 0, 'display': ''})

    for year in SEASONS:
        print(f'Season {year - 1}–{str(year)[2:]} ...', end=' ', flush=True)
        df = fetch_season(year)
        if df is None:
            time.sleep(4)
            continue

        for _, row in df.iterrows():
            raw_name = str(row['player']).strip()
            norm     = normalize(raw_name)
            mp       = float(row['mp'])
            bpm      = float(row['bpm'])

            e = career[norm]
            e['bpm_x_mp'] += bpm * mp
            e['mp']       += mp
            e['seasons']  += 1
            if not e['display']:
                e['display'] = raw_name

        print(f'{len(df)} rows')
        time.sleep(4)

    lookup: dict = {}
    for norm, e in career.items():
        if e['mp'] >= MIN_MP:
            lookup[norm] = {
                'bpm':     round(e['bpm_x_mp'] / e['mp'], 2),
                'mp':      int(e['mp']),
                'seasons': e['seasons'],
                'display': e['display'],
            }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(lookup, f, indent=2)

    print(f'\nWrote {len(lookup)} players → {OUT_PATH}')

    for check in ['lebron james', 'stephen curry', 'jalen brunson', 'nikola jokic', 'kevin durant']:
        if check in lookup:
            e = lookup[check]
            print(f'  {e["display"]}: BPM {e["bpm"]:+.2f} ({e["mp"]:,} MP, {e["seasons"]}s)')
        else:
            print(f'  {check}: NOT FOUND')


if __name__ == '__main__':
    main()
