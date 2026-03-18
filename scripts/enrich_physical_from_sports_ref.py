#!/usr/bin/env python3
"""
Enrich physical data (height, weight) from Sports Reference CBB roster pages.

Strategy
--------
1. Cross-reference nba_career_stats.json ← historical_college_stats.json
   (fills career records that have matching data in the college stats file,
    zero HTTP requests needed).

2. Scrape Sports Reference CBB school roster pages for records still missing
   height/weight in historical_college_stats.json.
   URL: https://www.sports-reference.com/cbb/schools/{slug}/men/{year}.html
   Each page returns every player on that roster with height + weight.
   Total: one request per unique (team, season) combination (~1,048 pages).

3. Re-apply step 1 to fill any career records newly enriched in step 2.

Usage
-----
    cd scripts/
    python3 enrich_physical_from_sports_ref.py
"""

import json
import os
import re
import time
from typing import Dict, Optional, Tuple

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, '..', 'draft-dashboard', 'public', 'data')

CAREER_FILE = os.path.join(PUBLIC_DIR, 'nba_career_stats.json')
HIST_FILE   = os.path.join(PUBLIC_DIR, 'historical_college_stats.json')

# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
HEADERS = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
DELAY   = 3.5   # seconds between Sports Reference requests
TIMEOUT = 25

# ---------------------------------------------------------------------------
# Team name → Sports Reference school slug
# ---------------------------------------------------------------------------
_TEAM_SLUG: Dict[str, str] = {
    'Arizona':           'arizona',
    'Auburn':            'auburn',
    'Fresno State':      'fresno-state',
    'Illinois':          'illinois',
    'Indiana':           'indiana',
    'LSU':               'lsu',
    'Maryland':          'maryland',
    'Missouri':          'missouri',
    'Nevada':            'nevada',
    'North Carolina':    'north-carolina',
    'North Texas':       'north-texas',
    'Northwestern':      'northwestern',
    'Notre Dame':        'notre-dame',
    'Ohio State':        'ohio-state',
    'Oklahoma':          'oklahoma',
    'Oklahoma State':    'oklahoma-state',
    'Ole Miss':          'mississippi',
    'Oregon':            'oregon',
    'Oregon State':      'oregon-state',
    'Pacific':           'pacific',
    'Penn State':        'penn-state',
    'Pepperdine':        'pepperdine',
    'Pittsburgh':        'pittsburgh',
    'Portland':          'portland',
    'Providence':        'providence',
    'Purdue':            'purdue',
    'Rice':              'rice',
    'Rutgers':           'rutgers',
    'SMU':               'southern-methodist',
    "Saint Mary's":      'saint-marys-ca',
    'San Diego':         'san-diego',
    'San Diego State':   'san-diego-state',
    'San Francisco':     'san-francisco',
    'San José State':    'san-jose-state',
    'Santa Clara':       'santa-clara',
    'Seton Hall':        'seton-hall',
    'South Carolina':    'south-carolina',
    'South Florida':     'south-florida',
    "St. John's":        'st-johns',
    'Stanford':          'stanford',
    'Syracuse':          'syracuse',
    'TCU':               'texas-christian',
    'Temple':            'temple',
    'Tennessee':         'tennessee',
    'Texas':             'texas',
    'Texas A&M':         'texas-am',
    'Texas Tech':        'texas-tech',
    'Tulane':            'tulane',
    'Tulsa':             'tulsa',
    'UAB':               'alabama-birmingham',
    'UCF':               'ucf',
    'UCLA':              'ucla',
    'UConn':             'connecticut',
    'UNLV':              'nevada-las-vegas',
    'USC':               'usc',
    'UTSA':              'utsa',
    'Utah':              'utah',
    'Utah State':        'utah-state',
    'Vanderbilt':        'vanderbilt',
    'Villanova':         'villanova',
    'Virginia':          'virginia',
    'Virginia Tech':     'virginia-tech',
    'Wake Forest':       'wake-forest',
    'Washington':        'washington',
    'Washington State':  'washington-state',
    'West Virginia':     'west-virginia',
    'Wichita State':     'wichita-state',
    'Wisconsin':         'wisconsin',
    'Wyoming':           'wyoming',
    'Xavier':            'xavier',
}

# ---------------------------------------------------------------------------
# Name normalisation (consistent with enrich_batch_physical.py)
# ---------------------------------------------------------------------------
_SUFFIX_RE  = re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', re.IGNORECASE)
_PUNCT_RE   = re.compile(r"[,\.''\-]")
_ACCENT_MAP = str.maketrans(
    'àáâãäåèéêëìíîïòóôõöøùúûüñçý',
    'aaaaaaeeeeiiiioooooouuuuncy',
)


def _norm(name: str) -> str:
    name = name.translate(_ACCENT_MAP)
    name = _SUFFIX_RE.sub('', name)
    name = _PUNCT_RE.sub('', name)
    return ' '.join(name.lower().split())


# ---------------------------------------------------------------------------
# Height parsing: '6-8' → 80.0 inches
# ---------------------------------------------------------------------------
def _parse_height(s: str) -> Optional[float]:
    m = re.match(r'(\d+)-(\d+)', s or '')
    return float(m.group(1)) * 12 + float(m.group(2)) if m else None


# ---------------------------------------------------------------------------
# Step 1: Cross-reference career ← hist
# ---------------------------------------------------------------------------
def crossref_career_from_hist(career: list, hist: list) -> Tuple[int, int]:
    """
    For each career record missing height/weight, look it up in hist by
    name+team+season and copy the data.
    Returns (players_updated, fields_applied).
    """
    # Build lookup: (norm_name, team, season) → hist_record
    lookup: Dict[Tuple, dict] = {}
    for p in hist:
        if p.get('height_inches') or p.get('weight_pounds'):
            key = (_norm(p.get('name', '')), p.get('team', ''), p.get('season'))
            lookup[key] = p

    updated = 0
    applied = 0

    for rec in career:
        phys = rec.get('physical') or {}
        if phys.get('height_inches') and phys.get('weight_pounds'):
            continue  # already complete

        cs   = rec.get('college_stats') or {}
        key  = (_norm(rec.get('name', '')), cs.get('team', ''), cs.get('season'))
        hist_rec = lookup.get(key)
        if not hist_rec:
            continue

        if not rec.get('physical'):
            rec['physical'] = {
                'height_inches': None, 'weight_pounds': None,
                'wingspan_inches': None, 'age_at_season_start': None,
            }
        phys = rec['physical']
        player_updated = False

        if hist_rec.get('height_inches') and not phys.get('height_inches'):
            phys['height_inches'] = hist_rec['height_inches']
            applied += 1
            player_updated = True
        if hist_rec.get('weight_pounds') and not phys.get('weight_pounds'):
            phys['weight_pounds'] = hist_rec['weight_pounds']
            applied += 1
            player_updated = True

        if player_updated:
            updated += 1

    return updated, applied


# ---------------------------------------------------------------------------
# Step 2: Scrape Sports Reference CBB roster pages
# ---------------------------------------------------------------------------
def fetch_roster(team: str, season: int) -> Dict[str, dict]:
    """
    Fetch the Sports Reference CBB roster page for (team, season) and return
    {norm_name: {height_inches, weight_pounds}}.
    Returns {} on failure or unknown team.
    """
    slug = _TEAM_SLUG.get(team)
    if not slug:
        return {}

    url = f'https://www.sports-reference.com/cbb/schools/{slug}/men/{season}.html'
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
            if r.status_code == 404:
                return {}
            r.raise_for_status()
            break
        except requests.RequestException as exc:
            wait = 2 ** attempt
            time.sleep(wait)
    else:
        return {}

    soup  = BeautifulSoup(r.text, 'html.parser')
    table = soup.find('table', {'id': 'roster'})
    if not table:
        return {}

    result: Dict[str, dict] = {}
    tbody = table.find('tbody') or table
    for row in tbody.find_all('tr'):
        cells = {td.get('data-stat'): td.text.strip() for td in row.find_all(['td', 'th'])}
        name  = cells.get('player', '').strip()
        ht    = cells.get('height', '').strip()
        wt    = cells.get('weight', '').strip()
        if not name:
            continue
        entry = {}
        h = _parse_height(ht)
        if h and 60 < h < 110:
            entry['height_inches'] = h
        if wt.isdigit():
            entry['weight_pounds'] = int(wt)
        if entry:
            result[_norm(name)] = entry

    return result


PROGRESS_FILE = os.path.join(PUBLIC_DIR, '.sports_ref_progress.json')


def load_progress() -> set:
    """Load set of already-completed (team, season) combos."""
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE) as f:
                data = json.load(f)
            return {tuple(x) for x in data}
        except Exception:
            pass
    return set()


def save_progress(done: set) -> None:
    with open(PROGRESS_FILE, 'w') as f:
        json.dump([list(x) for x in done], f)


def enrich_hist_from_sports_ref(hist: list, career: list) -> Tuple[int, int]:
    """
    Scrape Sports Reference roster pages for all (team, season) combos that
    still have records missing height/weight.
    Saves progress incrementally every 25 pages so crashes can be resumed.
    Returns (players_updated, fields_applied).
    """
    # Collect unique combos that are needed
    needed = {}
    for p in hist:
        if not p.get('height_inches') or not p.get('weight_pounds'):
            team   = p.get('team', '')
            season = p.get('season')
            if team and season and team in _TEAM_SLUG:
                needed.setdefault((team, season), []).append(p)

    done          = load_progress()
    remaining     = {k: v for k, v in needed.items() if k not in done}
    total_combos  = len(needed)
    total_updated = 0
    total_applied = 0

    print(f'[Sports Ref] {total_combos} team-season pages total, {len(done)} already done, {len(remaining)} remaining…')

    for i, ((team, season), players) in enumerate(sorted(remaining.items()), 1):
        roster = fetch_roster(team, season)

        if roster:
            for p in players:
                norm = _norm(p.get('name', ''))
                data = roster.get(norm)
                if not data:
                    parts = norm.split()
                    if len(parts) >= 2:
                        last, fp4 = parts[-1], parts[0][:4]
                        for key, val in roster.items():
                            kp = key.split()
                            if len(kp) >= 2 and kp[-1] == last and kp[0][:4] == fp4:
                                data = val
                                break

                if data:
                    player_updated = False
                    if data.get('height_inches') and not p.get('height_inches'):
                        p['height_inches'] = data['height_inches']
                        total_applied += 1
                        player_updated = True
                    if data.get('weight_pounds') and not p.get('weight_pounds'):
                        p['weight_pounds'] = data['weight_pounds']
                        total_applied += 1
                        player_updated = True
                    if player_updated:
                        total_updated += 1

        done.add((team, season))

        # Save incrementally every 25 pages
        if i % 25 == 0 or i == len(remaining):
            completed_so_far = len(done)
            print(f'  {completed_so_far}/{total_combos} pages done  ({total_updated} players updated so far) — saving…')
            # Re-apply cross-reference and flush both files
            crossref_career_from_hist(career, hist)
            with open(HIST_FILE, 'w') as f:
                json.dump(hist, f, indent=2)
            with open(CAREER_FILE, 'w') as f:
                json.dump(career, f, indent=2)
            save_progress(done)

        time.sleep(DELAY)

    return total_updated, total_applied


# ---------------------------------------------------------------------------
# Coverage report
# ---------------------------------------------------------------------------
def report(label: str, players: list, is_career: bool) -> None:
    total = len(players)

    def count(field):
        if is_career:
            return sum(1 for p in players if (p.get('physical') or {}).get(field))
        return sum(1 for p in players if p.get(field))

    ht  = count('height_inches')
    wt  = count('weight_pounds')
    ws  = count('wingspan_inches')
    age = count('age_at_season_start')
    print(f'  {label} ({total:,}):')
    print(f'    height:   {ht:>5,}/{total:,} ({100*ht//total}%)')
    print(f'    weight:   {wt:>5,}/{total:,} ({100*wt//total}%)')
    print(f'    wingspan: {ws:>5,}/{total:,} ({100*ws//total}%)')
    print(f'    age:      {age:>5,}/{total:,} ({100*age//total}%)')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print('=' * 60)
    print('PHYSICAL ENRICHMENT — Sports Reference CBB + Cross-reference')
    print('=' * 60)

    with open(CAREER_FILE) as f:
        career = json.load(f)
    with open(HIST_FILE) as f:
        hist = json.load(f)

    print(f'\nLoaded career: {len(career):,}  |  hist: {len(hist):,}')
    print('\nCOVERAGE BEFORE:')
    report('nba_career_stats',        career, is_career=True)
    report('historical_college_stats', hist,  is_career=False)

    # ------------------------------------------------------------------
    # Step 1: Cross-reference career ← hist (zero HTTP requests)
    # ------------------------------------------------------------------
    print('\n[Step 1] Cross-reference career ← hist…')
    u1, a1 = crossref_career_from_hist(career, hist)
    print(f'  Players updated: {u1:,}  fields applied: {a1:,}')

    # ------------------------------------------------------------------
    # Step 2: Sports Reference scraping for hist (saves incrementally)
    # ------------------------------------------------------------------
    print('\n[Step 2] Scrape Sports Reference CBB roster pages…')
    u2, a2 = enrich_hist_from_sports_ref(hist, career)
    print(f'  Players updated: {u2:,}  fields applied: {a2:,}')

    # ------------------------------------------------------------------
    print('\nCOVERAGE AFTER:')
    report('nba_career_stats',        career, is_career=True)
    report('historical_college_stats', hist,  is_career=False)

    # Clean up progress file on successful completion
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
    print(f'\nDone. Data saved → {PUBLIC_DIR}/')


if __name__ == '__main__':
    main()
