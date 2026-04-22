#!/usr/bin/env python3
"""
Build NBA career career-value lookup from Basketball Reference per-season
advanced stats tables.

Captures, per player:
  vorp    — career-total VORP (Value Over Replacement Player), cumulative
  ws      — career-total Win Shares, cumulative
  mp      — career-total minutes played
  seasons — number of regular seasons with ≥1 MP

From these we derive WS/48 in the UI as ws / mp × 48 — a rate stat that
does not reward longevity (unlike cumulative VORP or WS on their own) and
uses a different framework from BPM (offensive + defensive WS built from
distinct box-score components), so it avoids BPM's position biases.

Writes to draft-dashboard/public/data/vorp_lookup.json.

Usage:
    pip install requests beautifulsoup4 lxml pandas
    python3 scripts/build_vorp_lookup.py

Rate limit: sleeps 4 s between requests (~15 req/min, safely under BBRef's 20/min cap).
Full run takes ~90 seconds (longer with retries when BBRef rate-limits).
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

OUT_PATH = Path(__file__).parent.parent / 'draft-dashboard/public/data/vorp_lookup.json'
MIN_MP   = 100       # minimum career minutes to include in the lookup
SEASONS  = range(2006, 2026)

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept-Language': 'en-US,en;q=0.9',
}


def normalize(name: str) -> str:
    """Match the key style used by our BPM + BartTorvik lookups."""
    name = unicodedata.normalize('NFD', str(name))
    name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
    name = name.lower()
    name = re.sub(r"[''`]", '', name)
    name = re.sub(r'\b(jr\.?|sr\.?|ii|iii|iv)\b', '', name)
    name = re.sub(r'[^a-z\s]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def fetch_season(year: int) -> pd.DataFrame | None:
    """Returns a DataFrame with [player, tm, mp, vorp, ws] or None on failure."""
    url = f'https://www.basketball-reference.com/leagues/NBA_{year}_advanced.html'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        print(f'  HTTP error {year}: {e}')
        return None

    soup = BeautifulSoup(resp.content, 'html.parser')

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

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = ['_'.join(str(c) for c in col).strip('_') for col in df.columns]
    df.columns = [str(c).lower().strip() for c in df.columns]

    if 'player' in df.columns:
        df = df[df['player'] != 'Player'].copy()

    if 'vorp' not in df.columns or 'ws' not in df.columns:
        print(f'  Missing VORP/WS for {year} (cols: {list(df.columns)[:10]})')
        return None

    df['mp']   = pd.to_numeric(df.get('mp', 0), errors='coerce')
    df['vorp'] = pd.to_numeric(df['vorp'],       errors='coerce')
    df['ws']   = pd.to_numeric(df['ws'],         errors='coerce')
    df = df.dropna(subset=['mp', 'vorp', 'ws'])
    df = df[df['mp'] > 0].copy()

    # For traded players, keep only the TOT combined row
    if 'tm' in df.columns:
        traded = df.groupby('player')['tm'].apply(lambda x: (x == 'TOT').any())
        traded_names = traded[traded].index
        df = df[~(df['player'].isin(traded_names) & (df['tm'] != 'TOT'))].copy()

    return df[['player', 'mp', 'vorp', 'ws']].reset_index(drop=True)


def main() -> None:
    career: dict = defaultdict(lambda: {'vorp': 0.0, 'ws': 0.0, 'mp': 0, 'seasons': 0, 'display': ''})

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
            vorp     = float(row['vorp'])
            ws       = float(row['ws'])

            e = career[norm]
            e['vorp']    += vorp      # cumulative across seasons
            e['ws']      += ws        # cumulative across seasons
            e['mp']      += mp
            e['seasons'] += 1
            if not e['display']:
                e['display'] = raw_name

        print(f'{len(df)} rows')
        time.sleep(4)

    lookup: dict = {}
    for norm, e in career.items():
        if e['mp'] >= MIN_MP:
            lookup[norm] = {
                'vorp':    round(e['vorp'], 2),
                'ws':      round(e['ws'],   2),
                'mp':      int(e['mp']),
                'seasons': e['seasons'],
                'display': e['display'],
            }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, 'w') as f:
        json.dump(lookup, f, indent=2)

    print(f'\nWrote {len(lookup)} players → {OUT_PATH}')

    for check in ['lebron james', 'stephen curry', 'jalen brunson', 'nikola jokic',
                  'kevin durant', 'james harden', 'cameron bairstow']:
        if check in lookup:
            e = lookup[check]
            ws48 = e['ws'] / e['mp'] * 48 if e['mp'] else 0
            print(f'  {e["display"]:<22}  VORP {e["vorp"]:+6.1f}  WS {e["ws"]:+6.1f}  '
                  f'WS/48 {ws48:.3f}  ({e["mp"]:,} MP, {e["seasons"]}s)')
        else:
            print(f'  {check}: NOT FOUND')


if __name__ == '__main__':
    main()
