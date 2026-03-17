#!/usr/bin/env python3
"""
Batch Physical Data Enrichment
================================
Sweeps physical measurements (height, weight, wingspan, standing reach,
hand size, body fat) into BOTH data files in a small number of bulk requests
rather than one API call per player.

Sources and call counts
-----------------------
1. NBA Stats Combine API  (stats.nba.com)  —  1 call per draft year
   Covers 2001-2025.  Each call returns ALL combine invitees for that year
   with height (w/o shoes), weight, wingspan, standing reach, hand size, BF%.
   Total: ~25 calls.

2. GitHub combine CSV  (BryanDfor3 repo)  —  1 HTTP GET
   Backup wingspan source covering 2000-2025, ~1 800 rows.

3. Basketball Reference player index (a-z)  —  26 HTTP GETs
   Returns height, weight, and birth date for every NBA player ever.
   Used to fill height/weight for matched NBA players AND to compute
   age_at_season_start for anyone with a college_season value.

All three sources are batched: the entire NBA combine corpus comes in
< 30 calls; BBRef index comes in exactly 26 calls.

Targets
-------
  ../data/nba_career_stats.json         (written + copied to public/)
  ../data/historical_college_stats.json (written + copied to public/)

Usage
-----
    cd scripts/
    python3 enrich_batch_physical.py
"""

import csv
import io
import json
import os
import re
import shutil
import time
from datetime import date
from typing import Dict, Optional, Tuple

import requests
from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
DATA_DIR      = os.path.join(BASE_DIR, '..', 'data')
PUBLIC_DIR    = os.path.join(BASE_DIR, '..', 'draft-dashboard', 'public', 'data')

CAREER_FILE   = os.path.join(PUBLIC_DIR, 'nba_career_stats.json')
HIST_FILE     = os.path.join(PUBLIC_DIR, 'historical_college_stats.json')

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------
_BROWSER_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

_NBA_STATS_HEADERS = {
    **_BROWSER_HEADERS,
    'Referer':            'https://www.nba.com/',
    'Origin':             'https://www.nba.com',
    'Accept':             'application/json, text/plain, */*',
    'x-nba-stats-origin': 'stats',
    'x-nba-stats-token':  'true',
}

BBREF_BASE  = 'https://www.basketball-reference.com'
DELAY       = 1.0   # seconds between BBRef requests (polite scraping)
TIMEOUT_STD = 20    # seconds for standard requests
TIMEOUT_NBA = 15    # seconds for NBA stats API

# ---------------------------------------------------------------------------
# Name normalisation (consistent across all sources)
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
# Source 1 — NBA Stats Draft Combine API
# One call per draft year returns ALL measurements for that year's invitees.
# ---------------------------------------------------------------------------

# Available combine endpoints (each returns different measurement sets):
#   draftcombinestats      — anthropometric (height, weight, wingspan, reach, hands, BF)
#   draftcombinedrillresults — athletic (lane agility, sprint, vertical, etc.)
#   draftcombinespotshooting — shooting (% per zone)
_COMBINE_ENDPOINTS = [
    ('measurements', 'https://stats.nba.com/stats/draftcombinestats'),
]

# Field mappings from NBA Stats API column names to our schema
_MEAS_FIELDS = {
    'HEIGHT_WO_SHOES':  'height_inches',      # most accurate (no shoes)
    'WEIGHT':           'weight_pounds',
    'WINGSPAN':         'wingspan_inches',
    'STANDING_REACH':   'standing_reach_inches',
    'HAND_LENGTH':      'hand_length_inches',
    'HAND_WIDTH':       'hand_width_inches',
    'BODY_FAT_PCT':     'body_fat_pct',
}


def _probe_nba_stats() -> bool:
    """Quick reachability probe for stats.nba.com (3-second timeout)."""
    try:
        r = requests.get(
            'https://stats.nba.com/stats/draftcombinestats?LeagueID=00&SeasonYear=2023-24',
            headers=_NBA_STATS_HEADERS, timeout=3,
        )
        return r.status_code < 500
    except Exception:
        return False


def fetch_nba_combine_all(start: int = 2001, end: int = 2025) -> Dict[str, dict]:
    """
    Fetch all NBA Draft Combine anthropometric measurements for *start* through *end*.
    Returns {norm_name: {height_inches, weight_pounds, wingspan_inches, …}}
    Total HTTP requests: end - start + 1  (one per season).
    Skips entirely if stats.nba.com is unreachable.
    """
    combined: Dict[str, dict] = {}
    print(f'\n[NBA Combine API] Probing stats.nba.com…')
    if not _probe_nba_stats():
        print('  stats.nba.com unreachable in this environment — skipping.\n')
        return combined

    print(f'[NBA Combine API] Fetching {start}–{end} ({end - start + 1} calls)…')

    for year in range(start, end + 1):
        season = f'{year}-{str(year + 1)[-2:]}'
        url    = f'https://stats.nba.com/stats/draftcombinestats?LeagueID=00&SeasonYear={season}'

        for attempt in range(3):
            try:
                resp = requests.get(url, headers=_NBA_STATS_HEADERS, timeout=TIMEOUT_NBA)
                if resp.status_code in (400, 404):
                    break   # season not available — normal for future years
                resp.raise_for_status()
                data = resp.json()
                break
            except requests.RequestException as exc:
                wait = 2 ** attempt
                print(f'  {season}: retry in {wait}s ({exc})')
                time.sleep(wait)
        else:
            print(f'  {season}: failed after 3 attempts')
            continue

        rs   = (data.get('resultSets') or [{}])[0]
        hdrs = rs.get('headers', [])
        rows = rs.get('rowSet', [])

        if 'PLAYER_NAME' not in hdrs:
            time.sleep(0.4)
            continue

        ni = hdrs.index('PLAYER_NAME')

        # Build index map for available fields
        field_idx = {
            our_key: hdrs.index(api_col)
            for api_col, our_key in _MEAS_FIELDS.items()
            if api_col in hdrs
        }

        found = 0
        for row in rows:
            name = row[ni] if ni < len(row) else None
            if not name:
                continue
            measurements = {}
            for our_key, col_idx in field_idx.items():
                val = row[col_idx] if col_idx < len(row) else None
                if val is not None and val != '':
                    try:
                        measurements[our_key] = float(val)
                    except (TypeError, ValueError):
                        pass

            if measurements:
                norm = _norm(str(name))
                # Later seasons overwrite earlier — prefer most recent combine
                if norm not in combined:
                    combined[norm] = {}
                for k, v in measurements.items():
                    if v and 60 < v < 120 if 'inches' in k else True:
                        combined[norm][k] = v
                found += 1

        print(f'  {season}: {found} players  (total indexed: {len(combined)})')
        time.sleep(0.4)   # polite delay — NBA stats rate limit is lenient

    print(f'[NBA Combine] Total players indexed: {len(combined)}\n')
    return combined


# ---------------------------------------------------------------------------
# Source 2 — GitHub CSV (BryanDfor3 combine archive)
# One HTTP request, ~1 800 rows.
# ---------------------------------------------------------------------------
_GITHUB_CSV_URL = (
    'https://raw.githubusercontent.com/BryanDfor3/'
    'nba-draft-combine-command-center/main/data/nba_draft_combine_data.csv'
)

# Column name → our field
_CSV_FIELDS = {
    'PLAYER_NAME': None,          # identifier
    'WINGSPAN':    'wingspan_inches',
    'HEIGHT_WO_SHOES': 'height_inches',
    'WEIGHT':      'weight_pounds',
    'STANDING_REACH': 'standing_reach_inches',
}


def fetch_github_combine_csv() -> Dict[str, dict]:
    """Download the GitHub combine CSV and return {norm_name: measurements}."""
    print('[GitHub CSV] Fetching BryanDfor3 combine archive (1 request)…')
    try:
        resp = requests.get(_GITHUB_CSV_URL, headers=_BROWSER_HEADERS, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as exc:
        print(f'  Failed: {exc}\n')
        return {}

    result: Dict[str, dict] = {}
    reader = csv.DictReader(io.StringIO(resp.text))
    for row in reader:
        name = row.get('PLAYER_NAME', '').strip()
        if not name:
            continue
        norm = _norm(name)
        measurements = {}
        for csv_col, our_key in _CSV_FIELDS.items():
            if our_key is None:
                continue
            val = row.get(csv_col, '').strip()
            if val:
                try:
                    fval = float(val)
                    if 'inches' in our_key and not (60 < fval < 120):
                        continue
                    measurements[our_key] = fval
                except ValueError:
                    pass
        if measurements:
            result[norm] = measurements

    print(f'[GitHub CSV] {len(result)} player records loaded\n')
    return result


# ---------------------------------------------------------------------------
# Source 3 — Basketball Reference player index (a–z)
# 26 HTTP requests.  Returns height, weight, birth date for every NBA player.
# ---------------------------------------------------------------------------

def _parse_height(s: str) -> Optional[float]:
    """Convert '6-10' to 82.0 inches."""
    m = re.match(r'(\d+)-(\d+)', s or '')
    return float(m.group(1)) * 12 + float(m.group(2)) if m else None


def _parse_birth(s: str) -> Optional[date]:
    """Parse 'September 29, 1988' → date object."""
    s = s.strip()
    if not s:
        return None
    MONTHS = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12,
    }
    m = re.match(
        r'(January|February|March|April|May|June|July|August|September|'
        r'October|November|December)\s+(\d{1,2}),?\s+(\d{4})', s, re.IGNORECASE)
    if m:
        try:
            return date(int(m.group(3)), MONTHS[m.group(1).lower()], int(m.group(2)))
        except ValueError:
            pass
    return None


def _age_on(birth: date, ref: date) -> int:
    years = ref.year - birth.year
    if (ref.month, ref.day) < (birth.month, birth.day):
        years -= 1
    return years


def fetch_bbref_player_index() -> Dict[str, dict]:
    """
    Scrape all 26 BBRef /players/{letter}/ index pages.
    Returns {norm_name: {height_inches, weight_pounds, birth_date, year_max}}
    Total: 26 HTTP requests.
    """
    registry: Dict[str, dict] = {}
    letters = 'abcdefghijklmnopqrstuvwxyz'
    print(f'[BBRef Index] Scraping player index ({len(letters)} pages)…')

    for letter in letters:
        url = f'{BBREF_BASE}/players/{letter}/'
        soup = None
        for attempt in range(3):
            try:
                resp = requests.get(url, headers=_BROWSER_HEADERS, timeout=TIMEOUT_STD)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, 'html.parser')
                break
            except requests.RequestException as exc:
                wait = 2 ** attempt
                print(f'  /players/{letter}/: retry in {wait}s ({exc})')
                time.sleep(wait)

        if not soup:
            print(f'  /players/{letter}/: FAILED')
            time.sleep(DELAY)
            continue

        table = soup.find('table', {'id': 'players'})
        if not table:
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
            norm = _norm(name)

            ht_text = cells['height'].text.strip() if cells.get('height') else ''
            wt_text = cells['weight'].text.strip() if cells.get('weight') else ''
            bd_text = cells['birth_date'].text.strip() if cells.get('birth_date') else ''
            yr_max  = cells['year_max'].text.strip() if cells.get('year_max') else ''

            entry = {
                'name':          name,
                'height_inches': _parse_height(ht_text),
                'weight_pounds': int(wt_text) if wt_text.isdigit() else None,
                'birth_date':    _parse_birth(bd_text),
                'year_max':      int(yr_max) if yr_max.isdigit() else None,
            }

            # First occurrence wins for duplicate normalised names
            if norm not in registry:
                registry[norm] = entry
                count += 1

        print(f'  /players/{letter}/: {count} new  (registry: {len(registry):,})')
        time.sleep(DELAY)

    print(f'[BBRef Index] Registry complete: {len(registry):,} players\n')
    return registry


# ---------------------------------------------------------------------------
# Name matching helpers
# ---------------------------------------------------------------------------

def _fuzzy_last_first4(name_norm: str, lookup: Dict[str, dict]) -> Optional[dict]:
    """
    Fallback: match on (last_name, first_4_chars_of_first_name).
    Prevents Jarrius/Jaren, Antoine/Anthony collisions.
    """
    parts = name_norm.split()
    if len(parts) < 2:
        return None
    last = parts[-1]
    fp4  = parts[0][:4]
    for key, val in lookup.items():
        kp = key.split()
        if len(kp) >= 2 and kp[-1] == last and kp[0][:4] == fp4:
            return val
    return None


def lookup_player(name: str, registry: Dict[str, dict]) -> Optional[dict]:
    """Try exact normalised match, then last+first4 fallback."""
    norm = _norm(name)
    if norm in registry:
        return registry[norm]
    return _fuzzy_last_first4(norm, registry)


# ---------------------------------------------------------------------------
# Apply measurements to a list of player records
# ---------------------------------------------------------------------------

def _apply_combine(players, combine_data: Dict[str, dict],
                   name_key: str = 'name',
                   physical_key: Optional[str] = 'physical') -> Tuple[int, int]:
    """
    Apply combine measurements to player records.
    For nba_career_stats format: physical_key = 'physical'
    For historical_college_stats format: physical_key = None (fields at root level)
    Returns (players_updated, measurements_applied).
    """
    updated = 0
    applied = 0

    for rec in players:
        name = rec.get(name_key, '')
        if not name:
            continue
        norm = _norm(name)

        meas = combine_data.get(norm)
        if not meas:
            meas = _fuzzy_last_first4(norm, combine_data) or {}

        if not meas:
            continue

        player_updated = False

        if physical_key:
            # nba_career_stats format — measurements inside 'physical' sub-dict
            if not rec.get(physical_key):
                rec[physical_key] = {
                    'height_inches': None, 'weight_pounds': None,
                    'wingspan_inches': None, 'age_at_season_start': None,
                }
            phys = rec[physical_key]
            for field, val in meas.items():
                if val is not None and not phys.get(field):
                    phys[field] = val
                    applied += 1
                    player_updated = True
        else:
            # historical_college_stats format — measurements at record root
            for field, val in meas.items():
                if val is not None and not rec.get(field):
                    rec[field] = val
                    applied += 1
                    player_updated = True

        if player_updated:
            updated += 1

    return updated, applied


def _apply_bbref(players, registry: Dict[str, dict],
                 name_key: str = 'name',
                 physical_key: Optional[str] = 'physical',
                 compute_age: bool = True) -> Tuple[int, int]:
    """
    Apply BBRef height/weight and compute age_at_season_start.
    Only fills height/weight if currently null.
    Age computation requires a 'college_season' or 'season' field on the record.
    """
    updated = 0
    applied = 0

    for rec in players:
        name = rec.get(name_key, '')
        match = lookup_player(name, registry)
        if not match:
            continue

        player_updated = False
        ht = match.get('height_inches')
        wt = match.get('weight_pounds')
        bd = match.get('birth_date')  # date object or None

        # Determine season for age calculation
        season = rec.get('college_season') or rec.get('season')
        age = None
        if bd and season and compute_age:
            try:
                season_start = date(int(season) - 1, 11, 1)
                computed = _age_on(bd, season_start)
                if 16 <= computed <= 25:   # sanity check for college players
                    age = computed
            except (ValueError, TypeError):
                pass

        if physical_key:
            if not rec.get(physical_key):
                rec[physical_key] = {
                    'height_inches': None, 'weight_pounds': None,
                    'wingspan_inches': None, 'age_at_season_start': None,
                }
            phys = rec[physical_key]
            if ht and not phys.get('height_inches'):
                phys['height_inches'] = ht
                applied += 1
                player_updated = True
            if wt and not phys.get('weight_pounds'):
                phys['weight_pounds'] = wt
                applied += 1
                player_updated = True
            if age and not phys.get('age_at_season_start'):
                phys['age_at_season_start'] = age
                applied += 1
                player_updated = True
        else:
            if ht and not rec.get('height_inches'):
                rec['height_inches'] = ht
                applied += 1
                player_updated = True
            if wt and not rec.get('weight_pounds'):
                rec['weight_pounds'] = wt
                applied += 1
                player_updated = True
            if age and not rec.get('age_at_season_start'):
                rec['age_at_season_start'] = age
                applied += 1
                player_updated = True

        if player_updated:
            updated += 1

    return updated, applied


# ---------------------------------------------------------------------------
# Coverage reporting
# ---------------------------------------------------------------------------

def report_coverage(label: str, players: list, physical_key: Optional[str]) -> None:
    total = len(players)

    def count(field):
        if physical_key:
            return sum(1 for p in players if (p.get(physical_key) or {}).get(field))
        return sum(1 for p in players if p.get(field))

    ht  = count('height_inches')
    wt  = count('weight_pounds')
    ws  = count('wingspan_inches')
    age = count('age_at_season_start')
    reach = count('standing_reach_inches')

    print(f'  {label} ({total:,} records):')
    print(f'    height:        {ht:>5,} / {total:,}  ({100*ht//total}%)')
    print(f'    weight:        {wt:>5,} / {total:,}  ({100*wt//total}%)')
    print(f'    wingspan:      {ws:>5,} / {total:,}  ({100*ws//total}%)')
    print(f'    standing_reach:{reach:>5,} / {total:,}  ({100*reach//total}%)')
    print(f'    age:           {age:>5,} / {total:,}  ({100*age//total}%)')


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print('=' * 60)
    print('BATCH PHYSICAL DATA ENRICHMENT')
    print('Sources: NBA Combine API + GitHub CSV + BBRef Index')
    print('=' * 60)

    # ------------------------------------------------------------------
    # Load both data files
    # ------------------------------------------------------------------
    with open(CAREER_FILE) as f:
        career_players = json.load(f)
    print(f'\nLoaded nba_career_stats:       {len(career_players):,} records')

    with open(HIST_FILE) as f:
        hist_players = json.load(f)
    print(f'Loaded historical_college_stats: {len(hist_players):,} records\n')

    print('COVERAGE BEFORE ENRICHMENT:')
    report_coverage('nba_career_stats',       career_players, physical_key='physical')
    report_coverage('historical_college_stats', hist_players,  physical_key=None)

    # ------------------------------------------------------------------
    # Source 1: NBA Combine API  (~25 calls)
    # ------------------------------------------------------------------
    combine_data = fetch_nba_combine_all(start=2001, end=2025)

    # Apply to nba_career_stats  (physical sub-dict)
    u1, a1 = _apply_combine(career_players, combine_data, physical_key='physical')
    print(f'[NBA Combine → career]    players updated: {u1:,}  measurements: {a1:,}')

    # Apply to historical_college_stats  (root-level fields)
    u2, a2 = _apply_combine(hist_players, combine_data, physical_key=None)
    print(f'[NBA Combine → history]   players updated: {u2:,}  measurements: {a2:,}')

    # ------------------------------------------------------------------
    # Source 2: GitHub CSV  (1 call)
    # ------------------------------------------------------------------
    github_data = fetch_github_combine_csv()

    u3, a3 = _apply_combine(career_players, github_data, physical_key='physical')
    print(f'[GitHub CSV → career]     players updated: {u3:,}  measurements: {a3:,}')

    u4, a4 = _apply_combine(hist_players, github_data, physical_key=None)
    print(f'[GitHub CSV → history]    players updated: {u4:,}  measurements: {a4:,}')

    # ------------------------------------------------------------------
    # Source 3: BBRef Index  (26 calls)
    # ------------------------------------------------------------------
    bbref = fetch_bbref_player_index()

    u5, a5 = _apply_bbref(career_players, bbref, physical_key='physical',
                          compute_age=True)
    print(f'[BBRef → career]          players updated: {u5:,}  measurements: {a5:,}')

    u6, a6 = _apply_bbref(hist_players, bbref, physical_key=None,
                          compute_age=True)
    print(f'[BBRef → history]         players updated: {u6:,}  measurements: {a6:,}')

    # ------------------------------------------------------------------
    # Coverage after
    # ------------------------------------------------------------------
    print('\nCOVERAGE AFTER ENRICHMENT:')
    report_coverage('nba_career_stats',        career_players, physical_key='physical')
    report_coverage('historical_college_stats', hist_players,  physical_key=None)

    # ------------------------------------------------------------------
    # Save
    # ------------------------------------------------------------------
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    with open(CAREER_FILE, 'w') as f:
        json.dump(career_players, f, indent=2)

    with open(HIST_FILE, 'w') as f:
        json.dump(hist_players, f, indent=2)

    nba_calls = (2025 - 2001 + 1) if combine_data else 1  # 1 = probe call
    total_calls = nba_calls + 1 + 26
    print(f'\nSaved both files → {PUBLIC_DIR}/')
    print(f'Total HTTP requests used: ~{total_calls} '
          f'(vs ~{len(career_players) + len(hist_players):,} for one-per-player)')


if __name__ == '__main__':
    main()
