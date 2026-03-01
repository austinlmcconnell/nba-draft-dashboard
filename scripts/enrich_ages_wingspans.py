#!/usr/bin/env python3
"""
Enrich historical players with age_at_season_start from Basketball Reference.

Sources:
  1. Birth dates — BBRef NBA player index pages (a-z), 26 HTTP requests total.
     Each page lists every NBA player with their birth date.  We build a lookup
     keyed by normalised name and match it against nba_career_stats.json.

  2. Wingspans — NBA Draft Combine API (stats.nba.com).  Covers draft classes
     2001-2024.  Skipped gracefully if the endpoint is unreachable (it has
     strict CORS / bot-detection that can block non-browser clients).

Age calculation:
  age_at_season_start = player's age on November 1 of (college_season - 1).
  Example: college_season=2007 (2006-07 season) → season_start = 2006-11-01.
  A player born 1988-09-29 was 18 on that date.

Usage:
    cd scripts/
    python3 enrich_ages_wingspans.py
"""

import json
import os
import re
import shutil
import time
from datetime import date
from typing import Dict, Optional

import requests
from bs4 import BeautifulSoup

CAREER_FILE   = '../data/nba_career_stats.json'
PUBLIC_DIR    = '../draft-dashboard/public/data'
BBREF_BASE    = 'https://www.basketball-reference.com'
HEADERS       = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
DELAY         = 1.2   # seconds between BBRef requests

# NBA stats.nba.com — often blocked; set to False to skip entirely
TRY_COMBINE   = True

_NBA_STATS_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Referer':            'https://www.nba.com/',
    'Origin':             'https://www.nba.com',
    'Accept':             'application/json, text/plain, */*',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token':  'true',
}

# ---------------------------------------------------------------------------
# Name normalisation (mirrors fetch_nba_data.py)
# ---------------------------------------------------------------------------
_SUFFIX_RE = re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', re.IGNORECASE)
_PUNCT_RE  = re.compile(r"[,\.'']")
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
# Parse "May 8, 1951" → date object
# ---------------------------------------------------------------------------
def parse_birth_date(s: str) -> Optional[date]:
    """Convert BBRef birth date string (e.g. 'September 29, 1988') to a date."""
    s = s.strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s)          # ISO format (shouldn't appear but safe)
    except ValueError:
        pass
    # "Month Day, Year"
    m = re.match(
        r'(January|February|March|April|May|June|July|August|September|October|November|December)'
        r'\s+(\d{1,2}),?\s+(\d{4})', s, re.IGNORECASE)
    if m:
        MONTHS = {
            'january': 1, 'february': 2, 'march': 3, 'april': 4,
            'may': 5, 'june': 6, 'july': 7, 'august': 8,
            'september': 9, 'october': 10, 'november': 11, 'december': 12,
        }
        try:
            return date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
        except ValueError:
            pass
    return None


def age_on(birth: date, ref: date) -> int:
    """Return age in whole years as of ref_date."""
    years = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        years -= 1
    return years


# ---------------------------------------------------------------------------
# Step 1 — Build birth-date registry from BBRef player index (a-z)
# ---------------------------------------------------------------------------
def build_birth_registry() -> Dict[str, date]:
    """Scrape BBRef NBA player index pages and return {norm_name: birth_date}."""
    registry: Dict[str, date] = {}
    letters = 'abcdefghijklmnopqrstuvwxyz'
    print(f'Building birth date registry from BBRef index ({len(letters)} pages)…')

    for letter in letters:
        url = f'{BBREF_BASE}/players/{letter}/'
        for attempt in range(3):
            try:
                r = requests.get(url, headers=HEADERS, timeout=20)
                r.raise_for_status()
                break
            except requests.RequestException as e:
                wait = 2 ** attempt
                print(f'  Retrying {url} in {wait}s ({e})')
                time.sleep(wait)
        else:
            print(f'  FAILED: /players/{letter}/')
            continue

        soup = BeautifulSoup(r.text, 'html.parser')
        table = soup.find('table', {'id': 'players'})
        if not table:
            print(f'  /players/{letter}/: table not found')
            time.sleep(DELAY)
            continue

        tbody = table.find('tbody')
        if not tbody:
            time.sleep(DELAY)
            continue

        count = 0
        for row in tbody.find_all('tr'):
            cells = {td.get('data-stat'): td for td in row.find_all(['td', 'th'])}
            player_cell = cells.get('player')
            if not player_cell or not player_cell.text.strip():
                continue

            name = player_cell.text.strip()
            bd_cell = cells.get('birth_date')
            if not bd_cell:
                continue
            bd = parse_birth_date(bd_cell.text.strip())
            if bd:
                registry[_norm(name)] = bd
                count += 1

        print(f'  /players/{letter}/: {count} birth dates  (registry total: {len(registry)})')
        time.sleep(DELAY)

    print(f'Birth registry complete: {len(registry)} entries\n')
    return registry


# ---------------------------------------------------------------------------
# Step 2 — Wingspan from NBA Draft Combine (stats.nba.com)
# ---------------------------------------------------------------------------
def fetch_combine_wingspans(start: int = 2001, end: int = 2024) -> Dict[str, float]:
    """Fetch NBA Draft Combine wingspans.  Returns {} if unreachable."""
    wingspans: Dict[str, float] = {}
    print(f'Fetching combine wingspans ({start}–{end})…')

    for draft_year in range(start, end + 1):
        season = f'{draft_year}-{str(draft_year + 1)[-2:]}'
        url = (
            'https://stats.nba.com/stats/draftcombinestats'
            f'?LeagueID=00&SeasonYear={season}'
        )
        try:
            resp = requests.get(url, headers=_NBA_STATS_HEADERS, timeout=15)
            if resp.status_code in (400, 404):
                time.sleep(0.5)
                continue
            resp.raise_for_status()
            data = resp.json()

            rs   = (data.get('resultSets') or [{}])[0]
            hdrs = rs.get('headers', [])
            rows = rs.get('rowSet', [])

            if 'PLAYER_NAME' not in hdrs or 'WINGSPAN' not in hdrs:
                time.sleep(DELAY)
                continue

            ni = hdrs.index('PLAYER_NAME')
            wi = hdrs.index('WINGSPAN')
            found = 0
            for row in rows:
                name = row[ni] if ni < len(row) else None
                ws   = row[wi] if wi < len(row) else None
                if name and isinstance(ws, (int, float)) and 60 < ws < 108:
                    wingspans[_norm(str(name))] = float(ws)
                    found += 1

            print(f'  Combine {season}: {found} wingspans')
        except Exception as e:
            print(f'  Combine {season}: {e} — skipping remaining years')
            return wingspans    # bail out if the API is unreachable

        time.sleep(DELAY)

    print(f'Total combine wingspans: {len(wingspans)}\n')
    return wingspans


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print('=' * 60)
    print('AGE + WINGSPAN ENRICHMENT')
    print('=' * 60)

    with open(CAREER_FILE) as f:
        players = json.load(f)
    print(f'Loaded {len(players)} historical players\n')

    # --- Step 1: Birth dates ---
    birth_registry = build_birth_registry()

    # Apply birth dates → compute age_at_season_start
    age_added = 0
    age_missing_player = []
    for rec in players:
        norm = _norm(rec['name'])
        bd   = birth_registry.get(norm)

        if not bd:
            # Fallback: try last + first-4 fuzzy match
            parts = norm.split()
            if len(parts) >= 2:
                last = parts[-1]
                fp   = parts[0][:4]
                for key, val in birth_registry.items():
                    kp = key.split()
                    if len(kp) >= 2 and kp[-1] == last and kp[0][:4] == fp:
                        bd = val
                        break

        if not bd:
            age_missing_player.append(rec['name'])
            continue

        college_season = rec.get('college_season')
        if not college_season:
            continue

        # Season starts November 1 of the year BEFORE the college_season integer.
        # college_season=2007 → 2006-07 season → season_start=2006-11-01
        try:
            season_start = date(int(college_season) - 1, 11, 1)
        except (ValueError, TypeError):
            continue

        if not rec.get('physical'):
            rec['physical'] = {
                'height_inches': None, 'weight_pounds': None,
                'wingspan_inches': None, 'age_at_season_start': None,
            }

        computed_age = age_on(bd, season_start)
        # Sanity check: college basketball players should be 16-25 years old
        # at the start of their season.  Outliers indicate a name collision with
        # a different player in the BBRef index (e.g. an older era player with
        # the same name).
        if 16 <= computed_age <= 25:
            rec['physical']['age_at_season_start'] = computed_age
            age_added += 1
        else:
            age_missing_player.append(f"{rec['name']} (age={computed_age}, likely wrong match)")

    print(f'Ages populated:  {age_added} / {len(players)}')
    print(f'Birth dates not found for: {len(age_missing_player)} players')
    if age_missing_player[:10]:
        print('  Sample missing:', age_missing_player[:10])
    print()

    # --- Step 2: Wingspans ---
    if TRY_COMBINE:
        wingspans = fetch_combine_wingspans()
    else:
        print('Skipping combine wingspans (TRY_COMBINE=False)\n')
        wingspans = {}

    if wingspans:
        wing_added = 0
        for rec in players:
            norm = _norm(rec['name'])
            if norm in wingspans:
                if not rec.get('physical'):
                    rec['physical'] = {
                        'height_inches': None, 'weight_pounds': None,
                        'wingspan_inches': None, 'age_at_season_start': None,
                    }
                rec['physical']['wingspan_inches'] = wingspans[norm]
                wing_added += 1
        print(f'Wingspans added: {wing_added} / {len(players)}\n')
    else:
        print('No wingspans collected (combine API unreachable or skipped)\n')

    # --- Summary ---
    has_age = sum(1 for p in players if p.get('physical', {}) and p['physical'].get('age_at_season_start'))
    has_wing = sum(1 for p in players if p.get('physical', {}) and p['physical'].get('wingspan_inches'))
    has_ht   = sum(1 for p in players if p.get('physical', {}) and p['physical'].get('height_inches'))
    print(f'Coverage after enrichment:')
    print(f'  height:   {has_ht}/{len(players)} ({100*has_ht//len(players)}%)')
    print(f'  age:      {has_age}/{len(players)} ({100*has_age//len(players)}%)')
    print(f'  wingspan: {has_wing}/{len(players)} ({100*has_wing//len(players)}%)')
    print()

    # Sample check
    samples = [p for p in players if p.get('physical', {}) and p['physical'].get('age_at_season_start')][:5]
    for p in samples:
        phys = p['physical']
        print(f"  {p['name']} ({p.get('college_season')}): age={phys.get('age_at_season_start')}, "
              f"ht={phys.get('height_inches')}, ws={phys.get('wingspan_inches')}")

    # Save
    with open(CAREER_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy(CAREER_FILE, f'{PUBLIC_DIR}/nba_career_stats.json')
    print(f'\nSaved → {CAREER_FILE}  +  {PUBLIC_DIR}/')


if __name__ == '__main__':
    main()
