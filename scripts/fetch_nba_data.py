#!/usr/bin/env python3
"""
Fetch NBA Career Statistics + Physical Attributes from Basketball Reference.

Strategy (46 total HTTP requests):
  1. Scrape BBRef player index pages a-z (26 pages) → name, height, weight, position
  2. Scrape BBRef draft pages 2005-2024 (20 pages) → pick, career stats per player
  3. Match college players to BBRef players by name
  4. Enrich college stats with per-36 minute stats
"""

import json
import os
import re
import sys
import time
import requests
from bs4 import BeautifulSoup
from typing import Dict, List, Optional

COLLEGE_DATA_FILE = '../data/historical_college_stats.json'
OUTPUT_FILE = '../data/nba_career_stats.json'
BBREF_BASE = 'https://www.basketball-reference.com'
HEADERS = {'User-Agent': 'Mozilla/5.0 (research / educational project)'}
DELAY = 1.2   # seconds between requests — stay polite

# ---------------------------------------------------------------------------
# Manual name-correction table.
# Some college stats sources (CBBD) use a different first name than BBRef.
# Format: { college_db_name: bbref_name }
# ---------------------------------------------------------------------------
DRAFT_NAME_CORRECTIONS: dict = {
    # Add entries here when a player shows as "Undrafted" but should be drafted.
    # Example: 'Nique Clifford': 'Dominique Clifford',
}


def get(url: str) -> Optional[BeautifulSoup]:
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=20)
            r.raise_for_status()
            return BeautifulSoup(r.text, 'html.parser')
        except requests.RequestException as e:
            wait = 2 ** attempt
            print(f'    retrying {url} in {wait}s ({e})')
            time.sleep(wait)
    return None


# ---------------------------------------------------------------------------
# Step 1 — Build player registry from BBRef player index (a-z)
# Returns: dict[normalized_name] → {height_inches, weight_pounds, position, bbref_id}
# ---------------------------------------------------------------------------
def build_player_registry() -> Dict[str, dict]:
    registry: Dict[str, dict] = {}
    letters = 'abcdefghijklmnopqrstuvwxyz'

    print(f'Building player registry from BBRef index ({len(letters)} pages)...')
    for letter in letters:
        soup = get(f'{BBREF_BASE}/players/{letter}/')
        if not soup:
            continue

        table = soup.find('table', {'id': 'players'})
        if not table:
            continue

        for row in table.find('tbody').find_all('tr'):
            cells = {td.get('data-stat'): td for td in row.find_all(['td', 'th'])}
            player_cell = cells.get('player')
            if not player_cell or not player_cell.text.strip():
                continue

            name = player_cell.text.strip()
            link = player_cell.find('a')
            bbref_id = ''
            if link and link.get('href'):
                m = re.search(r'/players/\w+/(\w+)\.html', link['href'])
                if m:
                    bbref_id = m.group(1)

            def parse_height(s: str) -> Optional[int]:
                m = re.match(r'(\d+)-(\d+)', s or '')
                return int(m.group(1)) * 12 + int(m.group(2)) if m else None

            registry[name.lower()] = {
                'name': name,
                'bbref_id': bbref_id,
                'height_inches': parse_height(cells.get('height', {}).text.strip() if cells.get('height') else ''),
                'weight_pounds': int(cells['weight'].text.strip()) if cells.get('weight') and cells['weight'].text.strip().isdigit() else None,
                'position': cells.get('pos', {}).text.strip() if cells.get('pos') else '',
                'birth_date': cells.get('birth_date', {}).text.strip() if cells.get('birth_date') else '',
                'year_min': int(cells['year_min'].text) if cells.get('year_min') and cells['year_min'].text.isdigit() else None,
                'year_max': int(cells['year_max'].text) if cells.get('year_max') and cells['year_max'].text.isdigit() else None,
            }

        count = len(registry)
        print(f'  /players/{letter}/ — registry total: {count}')
        time.sleep(DELAY)

    print(f'Registry complete: {len(registry)} NBA players\n')
    return registry


# ---------------------------------------------------------------------------
# Step 2 — Scrape BBRef draft pages 2005-2024 for career stats
# Returns: dict[normalized_name] → career stats dict
# ---------------------------------------------------------------------------
def fetch_draft_career_stats(start: int = 2005, end: int = 2024) -> Dict[str, dict]:
    career_by_name: Dict[str, dict] = {}

    print(f'Fetching draft career stats ({start}–{end})...')
    for year in range(start, end + 1):
        soup = get(f'{BBREF_BASE}/draft/NBA_{year}.html')
        if not soup:
            print(f'  {year}: failed')
            continue

        table = soup.find('table', {'id': 'stats'})
        if not table:
            print(f'  {year}: table not found')
            continue

        count = 0
        for row in table.find('tbody').find_all('tr'):
            if 'thead' in (row.get('class') or []):
                continue
            cells = {td.get('data-stat'): td.text.strip() for td in row.find_all(['td', 'th'])}
            name = cells.get('player', '').strip()
            if not name:
                continue

            def safe_float(v):
                try:
                    return float(v) if v else None
                except ValueError:
                    return None

            def safe_int(v):
                try:
                    return int(v) if v else None
                except ValueError:
                    return None

            career_by_name[name.lower()] = {
                'name': name,
                'draft_year': year,
                'draft_pick': safe_int(cells.get('pick_overall')),
                'college': cells.get('college_name', ''),
                'nba_career': {
                    'seasons_played': safe_int(cells.get('seasons')) or 0,
                    'games_played': safe_int(cells.get('g')) or 0,
                    'career_ppg': safe_float(cells.get('pts_per_g')) or 0,
                    'career_rpg': safe_float(cells.get('trb_per_g')) or 0,
                    'career_apg': safe_float(cells.get('ast_per_g')) or 0,
                    'career_fg_pct': safe_float(cells.get('fg_pct')) or 0,
                    'career_3p_pct': safe_float(cells.get('fg3_pct')) or 0,
                    'career_ft_pct': safe_float(cells.get('ft_pct')) or 0,
                    'career_spg': None,  # not on draft page
                    'career_bpg': None,
                    'career_tov': None,
                    'win_shares': safe_float(cells.get('ws')) or 0,
                    'ws_per_48': safe_float(cells.get('ws_per_48')) or 0,
                    'bpm': safe_float(cells.get('bpm')),
                    'vorp': safe_float(cells.get('vorp')),
                    'is_active': False,  # will be inferred from year_max
                },
            }
            count += 1

        print(f'  {year}: {count} drafted players')
        time.sleep(DELAY)

    print(f'Draft data complete: {len(career_by_name)} total\n')
    return career_by_name


# ---------------------------------------------------------------------------
# Step 3 — Name matching (exact → last + first-3-chars fallback)
# ---------------------------------------------------------------------------
import re as _re
_SUFFIX_RE = _re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', _re.IGNORECASE)
_PUNCT_RE  = _re.compile(r"[,\.']")


def _norm(name: str) -> str:
    """Strip name suffixes (Jr/Sr/II/III), punctuation, lowercase."""
    name = _SUFFIX_RE.sub('', name)
    name = _PUNCT_RE.sub('', name)
    return ' '.join(name.lower().split())


def build_normed_lookup(lookup: Dict[str, dict]) -> Dict[str, dict]:
    """Return a new dict keyed by normalised name."""
    result: Dict[str, dict] = {}
    for k, v in lookup.items():
        nk = _norm(k)
        if nk not in result:          # first occurrence wins on collision
            result[nk] = v
    return result


def match_name(college_name: str, lookup: Dict[str, dict],
               normed_lookup: Optional[Dict[str, dict]] = None) -> Optional[dict]:
    if normed_lookup is None:
        normed_lookup = build_normed_lookup(lookup)

    normed = _norm(college_name)

    # Exact match on normalised key
    if normed in normed_lookup:
        return normed_lookup[normed]

    # Fallback: last name + first 4 chars of first name (4 prevents
    # Jarrius/Jaren, Antoine/Anthony, Marshall/Markel collisions)
    parts = normed.split()
    if len(parts) >= 2:
        last = parts[-1]
        fp   = parts[0][:4]
        for key, val in normed_lookup.items():
            kparts = key.split()
            if len(kparts) >= 2 and kparts[-1] == last and kparts[0][:4] == fp:
                return val

    return None


# ---------------------------------------------------------------------------
# Step 4 — Per-36 enrichment for college stats
# ---------------------------------------------------------------------------
def enrich_per36(stats: dict) -> dict:
    """Add per-36 minute keys to a stats dict (mutates and returns)."""
    mpg = stats.get('minutes_per_game') or 0
    if mpg <= 0:
        for key in ['pts_per36', 'reb_per36', 'ast_per36', 'stl_per36', 'blk_per36', 'tov_per36']:
            stats[key] = 0
        return stats

    scale = 36.0 / mpg
    for base, key36 in [
        ('points_per_game',   'pts_per36'),
        ('rebounds_per_game', 'reb_per36'),
        ('assists_per_game',  'ast_per36'),
        ('steals_per_game',   'stl_per36'),
        ('blocks_per_game',   'blk_per36'),
        ('turnovers_per_game','tov_per36'),
    ]:
        stats[key36] = round((stats.get(base) or 0) * scale, 1)

    # Alias field names to match TypeScript types
    stats['true_shooting_pct'] = stats.pop('true_shooting_percentage', 0) or 0
    stats['effective_fg_pct']  = stats.pop('effective_field_goal_percentage', 0) or 0
    stats['net_rating']        = stats.pop('net_rating', 0) or 0
    stats['win_shares_per40']  = stats.pop('win_shares_per_40', 0) or 0
    stats['three_pt_attempts_per_game'] = stats.pop('three_point_attempts_per_game', 0) or 0
    stats['ast_tov_ratio']     = stats.pop('assists_turnover_ratio', 0) or 0
    stats['oreb_pct']          = stats.pop('offensive_rebound_pct', 0) or 0
    stats['offensive_rating']  = stats.pop('offensive_rating', 0) or 0
    stats['defensive_rating']  = stats.pop('defensive_rating', 0) or 0
    # usage_rate, porpag, free_throw_rate already correctly named

    # Keep per-game shooting fields under TypeScript names
    stats['field_goal_percentage']    = stats.get('field_goal_percentage', 0) or 0
    stats['three_point_percentage']   = stats.get('three_point_percentage', 0) or 0
    stats['free_throw_percentage']    = stats.get('free_throw_percentage', 0) or 0
    return stats


# ---------------------------------------------------------------------------
# Step 5 — NBA Draft Combine wingspan (stats.nba.com)
# The NBA publishes combine measurements each May.  The API covers 2001-2024.
# ---------------------------------------------------------------------------
_NBA_STATS_HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ),
    'Referer':              'https://www.nba.com/',
    'Origin':               'https://www.nba.com',
    'Accept':               'application/json, text/plain, */*',
    'x-nba-stats-origin':   'stats',
    'x-nba-stats-token':    'true',
}


def fetch_combine_wingspans(start: int = 2001, end: int = 2024) -> Dict[str, float]:
    """Return a dict of {normalized_player_name: wingspan_inches} from the
    NBA Draft Combine API.  Covers draft years *start* through *end*.

    The API SeasonYear format is the post-draft NBA season, e.g. draft year
    2024 → SeasonYear 2024-25.  Some early years may return empty data.
    """
    wingspans: Dict[str, float] = {}
    print(f'Fetching NBA Draft Combine wingspans ({start}–{end})...')

    for draft_year in range(start, end + 1):
        season = f'{draft_year}-{str(draft_year + 1)[-2:]}'
        url = (
            'https://stats.nba.com/stats/draftcombinestats'
            f'?LeagueID=00&SeasonYear={season}'
        )
        try:
            resp = requests.get(url, headers=_NBA_STATS_HEADERS, timeout=20)
            if resp.status_code in (400, 404):
                time.sleep(DELAY * 0.5)
                continue
            resp.raise_for_status()
            data = resp.json()

            rs = (data.get('resultSets') or [{}])[0]
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
                # Sanity: wingspan should be > 60 inches (5 ft) and < 108 (9 ft)
                if name and isinstance(ws, (int, float)) and 60 < ws < 108:
                    wingspans[_norm(str(name))] = float(ws)
                    found += 1

            print(f'  Combine {season}: {found} wingspans')
        except Exception as e:
            print(f'  Combine {season}: {e}')

        time.sleep(DELAY)

    print(f'Total combine wingspans collected: {len(wingspans)}\n')
    return wingspans


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print('=' * 60)
    print('NBA DATA COLLECTOR (Basketball Reference)')
    print('=' * 60)

    os.makedirs('../data', exist_ok=True)

    # Load college data
    try:
        with open(COLLEGE_DATA_FILE) as f:
            college_players = json.load(f)
    except FileNotFoundError:
        print(f'ERROR: {COLLEGE_DATA_FILE} not found. Run fetch_college_data.py first.')
        sys.exit(1)

    print(f'Loaded {len(college_players)} college player-seasons')

    # Pick best (highest-minutes) season per unique player
    best: Dict[str, dict] = {}
    for cp in college_players:
        name = cp['name']
        if name not in best or (cp.get('minutes_per_game') or 0) > (best[name].get('minutes_per_game') or 0):
            best[name] = cp
    unique = list(best.values())
    print(f'Unique players: {len(unique)}\n')

    # Step 1: Build player registry
    registry = build_player_registry()

    # Step 2: Fetch draft career stats
    draft_stats = fetch_draft_career_stats(2005, 2024)

    # Step 3 & 4: Match and assemble
    print('Matching and assembling records...')
    # Pre-build normalised lookups once (avoids O(n²) re-normalisation)
    normed_draft    = build_normed_lookup(draft_stats)
    normed_registry = build_normed_lookup(registry)

    matched = []
    unmatched = 0

    for cp in unique:
        name = cp['name']

        # Apply manual name corrections before matching (handles CBBD ↔ BBRef mismatches)
        lookup_name = DRAFT_NAME_CORRECTIONS.get(name, name)

        # Try to find in draft stats (primary source for career data)
        draft_match = match_name(lookup_name, draft_stats, normed_draft)
        if not draft_match:
            unmatched += 1
            continue

        # Enrich with physical from registry
        reg_match = match_name(name, registry, normed_registry)
        physical = {
            'height_inches': reg_match['height_inches'] if reg_match else None,
            'weight_pounds': reg_match['weight_pounds'] if reg_match else None,
            'wingspan_inches': None,
            'age_at_season_start': None,
        }

        # Infer is_active from registry year_max
        career = dict(draft_match['nba_career'])
        if reg_match and reg_match.get('year_max'):
            career['is_active'] = reg_match['year_max'] >= 2024

        # Build enriched college stats
        enriched = enrich_per36(dict(cp))

        record = {
            'id': f"hist_{name.replace(' ', '_').lower()}_{draft_match['draft_year']}",
            'name': name,
            'college_team': cp.get('team'),
            'college_season': cp.get('season'),
            'college_stats': enriched,
            'physical': physical,
            'nba_career': career,
            'draft_year': draft_match.get('draft_year'),
            'draft_round': None,  # not on draft page we scraped
            'draft_pick': draft_match.get('draft_pick'),
        }
        matched.append(record)

    print(f'\nMatched:   {len(matched)}')
    print(f'Unmatched: {unmatched}')
    rate = len(matched) * 100 // (len(matched) + unmatched) if (matched or unmatched) else 0
    print(f'Rate:      {rate}%')

    # Deduplicate: if multiple college players matched the same NBA pick,
    # keep the one with more college minutes (more likely the real match).
    seen: Dict[tuple, dict] = {}
    for rec in matched:
        slot = (rec.get('draft_year'), rec.get('draft_pick'))
        if slot not in seen:
            seen[slot] = rec
        else:
            prev_mpg = seen[slot]['college_stats'].get('minutes_per_game', 0) or 0
            this_mpg = rec['college_stats'].get('minutes_per_game', 0) or 0
            if this_mpg > prev_mpg:
                seen[slot] = rec
    pre_dedup = len(matched)
    matched = list(seen.values())
    if pre_dedup != len(matched):
        print(f'Deduplicated: {pre_dedup} → {len(matched)} (removed {pre_dedup - len(matched)} collisions)')

    # Enrich all college players with per-36 stats (for prospect pool).
    # NOTE: run fetch_physical_data.py AFTER this script — it adds
    # athlete_id, height_inches, weight_pounds for the current season and
    # must not be overwritten by this step.
    print('\nEnriching all college player-seasons with per-36 stats...')
    enriched_all = [enrich_per36(dict(cp)) for cp in college_players]
    with open('../data/historical_college_stats.json', 'w') as f:
        json.dump(enriched_all, f, indent=2)
    print(f'Updated {len(enriched_all)} records in historical_college_stats.json')

    # Add undrafted historical players as additional comps.
    # Any player who wasn't matched to a draft pick but had a real college
    # career (≥15 MPG, ≥10 games) is still a valid comparison target —
    # they'll appear as "Undrafted" with zero NBA career stats.
    print('\nAdding undrafted historical players ...')
    MIN_MPG, MIN_GAMES = 15.0, 10
    matched_norms = {_norm(r['name']) for r in matched}

    undrafted = []
    seen_undrafted: set = set()
    for cp in unique:
        norm = _norm(cp['name'])
        if norm in matched_norms or norm in seen_undrafted:
            continue
        mpg   = cp.get('minutes_per_game') or 0
        games = cp.get('games') or 0
        if mpg < MIN_MPG or games < MIN_GAMES:
            continue
        reg_match = match_name(cp['name'], registry, normed_registry)
        physical = {
            'height_inches':       reg_match['height_inches']  if reg_match else None,
            'weight_pounds':       reg_match['weight_pounds']  if reg_match else None,
            'wingspan_inches':     None,
            'age_at_season_start': None,
        }
        enriched = enrich_per36(dict(cp))
        undrafted.append({
            'id':             f"hist_{cp['name'].replace(' ', '_').lower()}_{cp.get('season', 'unk')}",
            'name':           cp['name'],
            'college_team':   cp.get('team'),
            'college_season': cp.get('season'),
            'college_stats':  enriched,
            'physical':       physical,
            'nba_career': {
                'career_ppg': 0.0, 'career_rpg': 0.0, 'career_apg': 0.0,
                'seasons_played': 0, 'is_active': False,
            },
            'draft_year':  None,
            'draft_round': None,
            'draft_pick':  None,
        })
        seen_undrafted.add(norm)

    print(f'Undrafted players added: {len(undrafted)} '
          f'(min {MIN_MPG} mpg / {MIN_GAMES} games)')

    # -----------------------------------------------------------------------
    # Extra step: enrich undrafted-but-NBA-playing players with career stats.
    # Any undrafted player who appears in the BBRef registry (year_min set)
    # actually played in the NBA — fetch their per-game career stats from
    # their BBRef player page so they don't incorrectly show 0 career PPG.
    # -----------------------------------------------------------------------
    print('\nEnriching undrafted NBA players with BBRef career stats...')
    enriched_undrafted = 0
    for rec in undrafted:
        reg_match = match_name(rec['name'], registry, normed_registry)
        if not reg_match or not reg_match.get('bbref_id') or not reg_match.get('year_min'):
            continue  # not in BBRef index → genuinely never played in NBA

        bbref_id = reg_match['bbref_id']
        letter   = bbref_id[0]
        soup     = get(f'{BBREF_BASE}/players/{letter}/{bbref_id}.html')
        if not soup:
            time.sleep(DELAY)
            continue

        # The per-game career summary is in a table#per_g, last row with class "partial_table" or the tfoot
        per_g = soup.find('table', {'id': 'per_game'})
        if not per_g:
            time.sleep(DELAY)
            continue

        # Look for the "Career" row
        career_row = None
        for row in per_g.find_all('tr'):
            th = row.find('th')
            if th and th.text.strip() == 'Career':
                career_row = row
                break

        if not career_row:
            time.sleep(DELAY)
            continue

        def safe_float(td_id):
            td = career_row.find('td', {'data-stat': td_id})
            try:
                return float(td.text.strip()) if td and td.text.strip() else None
            except ValueError:
                return None

        def safe_int(td_id):
            td = career_row.find('td', {'data-stat': td_id})
            try:
                return int(td.text.strip()) if td and td.text.strip() else None
            except ValueError:
                return None

        seasons  = safe_int('season')
        games    = safe_int('g')
        ppg      = safe_float('pts_per_g')
        rpg      = safe_float('trb_per_g')
        apg      = safe_float('ast_per_g')
        fg_pct   = safe_float('fg_pct')
        fg3_pct  = safe_float('fg3_pct')
        ft_pct   = safe_float('ft_pct')

        if ppg is None and rpg is None:
            time.sleep(DELAY)
            continue

        rec['nba_career'] = {
            'seasons_played': seasons or 0,
            'games_played':   games   or 0,
            'career_ppg':     ppg     or 0,
            'career_rpg':     rpg     or 0,
            'career_apg':     apg     or 0,
            'career_fg_pct':  fg_pct  or 0,
            'career_3p_pct':  fg3_pct or 0,
            'career_ft_pct':  ft_pct  or 0,
            'career_spg':     None,
            'career_bpg':     None,
            'career_tov':     None,
            'win_shares':     None,
            'ws_per_48':      None,
            'bpm':            None,
            'vorp':           None,
            'is_active':      (reg_match.get('year_max') or 0) >= 2024,
        }
        enriched_undrafted += 1
        time.sleep(DELAY)

    print(f'Undrafted NBA players enriched: {enriched_undrafted}')
    matched.extend(undrafted)

    # -----------------------------------------------------------------------
    # Wingspan enrichment — NBA Draft Combine measurements.
    # Adds wingspan_inches to all players where available.
    # -----------------------------------------------------------------------
    wingspans = fetch_combine_wingspans()
    if wingspans:
        wing_count = 0
        for rec in matched:
            normed = _norm(rec['name'])
            if normed in wingspans:
                if rec.get('physical') is None:
                    rec['physical'] = {'height_inches': None, 'weight_pounds': None,
                                       'wingspan_inches': None, 'age_at_season_start': None}
                rec['physical']['wingspan_inches'] = wingspans[normed]
                wing_count += 1
        print(f'Wingspan enriched: {wing_count} players')

    with open(OUTPUT_FILE, 'w') as f:
        json.dump(matched, f, indent=2)
    print(f'\nSaved {len(matched)} total players to {OUTPUT_FILE} '
          f'({len(matched) - len(undrafted)} drafted + {len(undrafted)} undrafted)')


if __name__ == '__main__':
    main()
