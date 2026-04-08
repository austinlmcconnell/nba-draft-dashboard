#!/usr/bin/env python3
"""
Update 2026 prospect stats to full-season final numbers using ESPN's public API.

The CBBD data was fetched mid-season.  This script replaces per-game counting
stats and derived metrics for every 2026 record that has a valid athlete_id,
using the final season totals from:
  site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/athletes/{id}/stats

Advanced metrics that come from CBBD (usage_rate, net_rating, porpag, etc.) are
intentionally left untouched — ESPN doesn't provide them and they were already
at season-end quality from the last CBBD pull.

Fields updated per player:
  games, minutes_per_game
  points_per_game, rebounds_per_game, assists_per_game,
  steals_per_game, blocks_per_game, turnovers_per_game,
  offensive_rebounds_per_game, defensive_rebounds_per_game,
  field_goal_percentage, three_point_percentage, free_throw_percentage,
  three_pt_attempts_per_game,
  true_shooting_pct, effective_fg_pct          (calculated from totals)
  pts_per36, reb_per36, ast_per36, stl_per36, blk_per36, tov_per36
"""

import json
import os
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import requests

# ── Paths ──────────────────────────────────────────────────────────────────────
COLLEGE_DATA_FILE = '../draft-dashboard/public/data/historical_college_stats.json'
PUBLIC_DATA_DIR   = '../draft-dashboard/public/data'
CURRENT_SEASON    = 2026
MAX_WORKERS       = 12

HEADERS = {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                       '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept':          'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin':          'https://www.espn.com',
    'Referer':         'https://www.espn.com/',
}
ESPN_BASE = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball'


# ── ESPN fetch ─────────────────────────────────────────────────────────────────
def fetch_espn_stats(athlete_id: int) -> Optional[Dict]:
    """Return parsed stats dict from ESPN, or None on failure."""
    url = f'{ESPN_BASE}/athletes/{athlete_id}/stats'
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def parse_fraction(s: str) -> Tuple[float, float]:
    """'8.0-16.5'  →  (8.0, 16.5)   |   fallback (0, 0)"""
    if not isinstance(s, str):
        return 0.0, 0.0
    parts = s.split('-')
    if len(parts) == 2:
        try:
            return float(parts[0]), float(parts[1])
        except ValueError:
            pass
    return 0.0, 0.0


def _pick_season_row(stats_rows: List[Dict], labels: List[str],
                     cbbd_games: int, cbbd_ppg: float) -> int:
    """
    ESPN returns one row per season (or per school for transfers).
    The correct row for the CURRENT season satisfies two conditions:
      1. games >= cbbd_games  (the full season has at least as many games as
         the mid-season CBBD snapshot we already have)
      2. PPG closest to cbbd_ppg  (the same season → the full-season average
         stays close to the partial-season average; a completely different
         season would have a very different PPG)

    Returns the index of the best row, defaulting to 0.
    """
    if len(stats_rows) <= 1:
        return 0

    def _f(d, k):
        try:
            return float(d.get(k, 0) or 0)
        except (TypeError, ValueError):
            return 0.0

    candidates = []
    for i, row in enumerate(stats_rows):
        sd = dict(zip(labels, row.get('stats', [])))
        gp = int(_f(sd, 'GP'))
        tot_pts_row = _f(sd, 'PTS')  # per-game PTS label in averages is absent; calculate below
        # PTS is not in averages labels; derive from FG + 3PT + FT totals isn't clean.
        # Instead use FG% / FG fractions: skip; we'll rely on gp match and FG% proximity.
        # Use REB / AST as secondary signals.
        reb  = _f(sd, 'REB')
        ast  = _f(sd, 'AST')
        fg_m, fg_a = parse_fraction(sd.get('FG', '0-0'))
        ft_m, ft_a = parse_fraction(sd.get('FT', '0-0'))
        tp_m, tp_a = parse_fraction(sd.get('3PT', '0-0'))
        # approximate PPG from fractions
        ppg_est = round((fg_m * 2 + tp_m + ft_m) / max(gp, 1), 1) if gp else 0.0
        candidates.append((i, gp, ppg_est))

    # Filter: only rows with games >= cbbd_games
    qualified = [(i, gp, ppg) for i, gp, ppg in candidates if gp >= cbbd_games]
    if not qualified:
        # Fallback: just pick the one with games closest to cbbd_games (below)
        qualified = sorted(candidates, key=lambda x: abs(x[1] - cbbd_games))

    # Among qualified, pick row whose PPG is closest to cbbd_ppg
    best = min(qualified, key=lambda x: abs(x[2] - cbbd_ppg))
    return best[0]


def extract_stats(data: Dict, cbbd_games: int = 0, cbbd_ppg: float = 0.0) -> Optional[Dict]:
    """
    Pull averages + totals from the ESPN response dict and return a flat
    stats dict, or None if we can't find the needed categories.

    cbbd_games / cbbd_ppg are used to pick the correct season row when the
    player has stats from multiple seasons (transfers, upperclassmen).
    """
    cats = data.get('categories', [])
    avg_cat = next((c for c in cats if c.get('name') == 'averages'), None)
    tot_cat = next((c for c in cats if c.get('name') == 'totals'), None)

    if not avg_cat:
        return None

    avg_labels: List[str] = avg_cat.get('labels', [])
    avg_stats_rows = avg_cat.get('statistics', [])

    # Pick the correct season row
    row_idx = _pick_season_row(avg_stats_rows, avg_labels, cbbd_games, cbbd_ppg)
    avg_row: List[str] = avg_stats_rows[row_idx].get('stats', []) if avg_stats_rows else avg_cat.get('totals', [])
    avg = dict(zip(avg_labels, avg_row))

    tot_labels: List[str] = tot_cat.get('labels', []) if tot_cat else []
    tot_stats_rows = tot_cat.get('statistics', []) if tot_cat else []
    tot_row: List[str] = tot_stats_rows[row_idx].get('stats', []) if (tot_stats_rows and row_idx < len(tot_stats_rows)) else (tot_cat.get('totals', []) if tot_cat else [])
    tot = dict(zip(tot_labels, tot_row))

    def _float(d: Dict, key: str, default: float = 0.0) -> float:
        try:
            return float(d.get(key, default))
        except (TypeError, ValueError):
            return default

    games = int(_float(avg, 'GP', 0))
    if games == 0:
        return None

    mpg = _float(avg, 'MIN')

    # Shooting fractions (averages are per-game as "made-attempted")
    fg_m, fg_a   = parse_fraction(avg.get('FG', '0-0'))
    tp_m, tp_a   = parse_fraction(avg.get('3PT', '0-0'))
    ft_m, ft_a   = parse_fraction(avg.get('FT', '0-0'))

    # Percentages — ESPN returns values like "48.4" (0-100 scale).
    # Keep in percentage (0-100) form to match historical CBBD data format,
    # which stores e.g. 49.9 for 49.9% FG.  The TypeScript computeTS helper
    # divides by 100 when it reads these fields.
    def _pct(d, key):
        v = _float(d, key)
        # Normalise edge case: if somehow stored as 0-1 decimal, scale up
        return round(v * 100.0, 2) if 0 < v < 1.0 else round(v, 2)

    fg_pct  = _pct(avg, 'FG%')
    tp_pct  = _pct(avg, '3P%')
    ft_pct  = _pct(avg, 'FT%')

    # Per-game box stats
    or_pg  = _float(avg, 'OR')
    dr_pg  = _float(avg, 'DR')
    reb_pg = _float(avg, 'REB')
    ast_pg = _float(avg, 'AST')
    blk_pg = _float(avg, 'BLK')
    stl_pg = _float(avg, 'STL')

    # Points and turnovers come from totals (more accurate than parsing MIN)
    pts_total = _float(tot, 'PTS')
    to_total  = _float(tot, 'TO')
    ppg       = round(pts_total / games, 1) if pts_total > 0 else _float(avg, 'PTS')
    tov_pg    = round(to_total  / games, 1)

    # Per-36
    scale = (36.0 / mpg) if mpg > 0 else 0.0
    def per36(base: float) -> float:
        return round(base * scale, 1) if scale > 0 else 0.0

    # Advanced efficiency (calculated from box totals).
    # Stored in PERCENTAGE form (0-100) to match the scale used by
    # dataLoader.ts computeTS(), which also returns (value * 100).
    # TS% = PTS / (2 * (FGA + 0.44 * FTA))
    total_fga = fg_a * games
    total_fta = ft_a * games
    ts_pct    = round(pts_total / (2 * (total_fga + 0.44 * total_fta)) * 100, 2) \
                if (total_fga + total_fta) > 0 else 0.0

    # eFG% = (FGM + 0.5 * 3PM) / FGA  — also stored as percentage (0-100)
    total_fgm = fg_m * games
    total_3pm = tp_m * games
    efg_pct   = round((total_fgm + 0.5 * total_3pm) / total_fga * 100, 2) \
                if total_fga > 0 else 0.0

    return {
        'games':                         games,
        'minutes_per_game':              round(mpg, 1),
        'points_per_game':               round(ppg, 1),
        'rebounds_per_game':             round(reb_pg, 1),
        'offensive_rebounds_per_game':   round(or_pg, 1),
        'defensive_rebounds_per_game':   round(dr_pg, 1),
        'assists_per_game':              round(ast_pg, 1),
        'steals_per_game':               round(stl_pg, 1),
        'blocks_per_game':               round(blk_pg, 1),
        'turnovers_per_game':            round(tov_pg, 1),
        'field_goal_percentage':         fg_pct,
        'three_point_percentage':        tp_pct,
        'free_throw_percentage':         ft_pct,
        'three_pt_attempts_per_game':    round(tp_a, 1),
        'true_shooting_pct':             ts_pct,
        'effective_fg_pct':              efg_pct,
        'pts_per36':  per36(ppg),
        'reb_per36':  per36(reb_pg),
        'ast_per36':  per36(ast_pg),
        'stl_per36':  per36(stl_pg),
        'blk_per36':  per36(blk_pg),
        'tov_per36':  per36(tov_pg),
    }


# ── Worker ─────────────────────────────────────────────────────────────────────
def fetch_player_update(record: Dict) -> Tuple[str, int, Optional[Dict]]:
    """Returns (name, athlete_id, updated_stats_or_None)."""
    aid = record.get('athlete_id')
    name = record.get('name', 'Unknown')
    if not aid:
        return name, 0, None

    espn_data = fetch_espn_stats(int(aid))
    if not espn_data:
        return name, aid, None

    cbbd_games = record.get('games', 0)
    cbbd_ppg   = record.get('points_per_game', 0.0)
    stats = extract_stats(espn_data, cbbd_games=cbbd_games, cbbd_ppg=cbbd_ppg)
    return name, aid, stats


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print('=' * 60)
    print(f'ESPN FINAL-SEASON STATS UPDATER  (season={CURRENT_SEASON})')
    print('=' * 60)

    with open(COLLEGE_DATA_FILE) as f:
        all_players = json.load(f)

    current = [p for p in all_players if p.get('season') == CURRENT_SEASON]
    with_id  = [p for p in current if p.get('athlete_id')]
    no_id    = [p for p in current if not p.get('athlete_id')]
    print(f'\nTotal 2026 records  : {len(current)}')
    print(f'  With athlete_id   : {len(with_id)}')
    print(f'  Without athlete_id: {len(no_id)} (skipped)')

    # Build a quick lookup: athlete_id → index in all_players
    idx_by_aid: Dict[int, int] = {}
    for i, p in enumerate(all_players):
        if p.get('season') == CURRENT_SEASON and p.get('athlete_id'):
            idx_by_aid[int(p['athlete_id'])] = i

    # Fetch in parallel
    print(f'\nFetching ESPN stats for {len(with_id)} players ({MAX_WORKERS} threads)...\n')
    updated = 0
    failed  = 0
    skipped_same_games = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {pool.submit(fetch_player_update, p): p for p in with_id}
        done_count = 0

        for fut in as_completed(futures):
            orig = futures[fut]
            name, aid, new_stats = fut.result()
            done_count += 1

            if new_stats is None:
                failed += 1
                if done_count % 50 == 0 or done_count == len(with_id):
                    print(f'  {done_count}/{len(with_id)} processed  |  updated={updated}  failed={failed}')
                continue

            idx = idx_by_aid.get(int(aid))
            if idx is None:
                failed += 1
                continue

            old_games = all_players[idx].get('games', 0)
            new_games = new_stats['games']

            if new_games < old_games:
                # ESPN returned fewer games than we already have — skip
                skipped_same_games += 1
                continue

            # Patch in the new stats (preserve all other fields)
            all_players[idx].update(new_stats)
            updated += 1

            if done_count <= 10 or done_count % 100 == 0 or done_count == len(with_id):
                delta = new_games - old_games
                tag   = f'+{delta}g' if delta else 'same'
                print(f'  [{done_count:3d}/{len(with_id)}] {name:<30s}  {old_games}g → {new_games}g ({tag})  '
                      f'{new_stats["points_per_game"]} PPG  {new_stats["rebounds_per_game"]} RPG  '
                      f'{new_stats["assists_per_game"]} APG')

    print()
    print('=' * 60)
    print('RESULTS')
    print('=' * 60)
    print(f'  Updated  : {updated}')
    print(f'  Failed   : {failed}')
    print(f'  Skipped  : {skipped_same_games} (ESPN had fewer games than current data)')
    print(f'  No ID    : {len(no_id)}')

    # Verify top prospects
    print('\nTop prospects — final stats:')
    updated_current = {p['name']: p for p in all_players if p.get('season') == CURRENT_SEASON}
    spot_check = [
        'Cameron Boozer', 'AJ Dybantsa', 'Darryn Peterson',
        'Kingston Flemings', 'Keaton Wagler', 'Thomas Haugh',
        'Darius Acuff Jr.', 'Labaron Philon Jr.',
    ]
    for name in spot_check:
        if name in updated_current:
            p = updated_current[name]
            print(f'  {name:<28s} {p["games"]:2d}g  '
                  f'{p["points_per_game"]:5.1f} PPG  '
                  f'{p["rebounds_per_game"]:4.1f} RPG  '
                  f'{p["assists_per_game"]:4.1f} APG  '
                  f'FG%={p["field_goal_percentage"]:.3f}  '
                  f'TS%={p.get("true_shooting_pct", 0):.3f}')

    # Save
    print(f'\nSaving {COLLEGE_DATA_FILE} ...')
    with open(COLLEGE_DATA_FILE, 'w') as f:
        json.dump(all_players, f, indent=2)

    os.makedirs(PUBLIC_DATA_DIR, exist_ok=True)
    dest = os.path.join(PUBLIC_DATA_DIR, 'historical_college_stats.json')
    if os.path.abspath(COLLEGE_DATA_FILE) != os.path.abspath(dest):
        shutil.copy(COLLEGE_DATA_FILE, dest)
        print(f'Copied → {dest}')

    print('\nDone.')


if __name__ == '__main__':
    main()
