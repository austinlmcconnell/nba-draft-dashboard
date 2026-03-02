#!/usr/bin/env python3
"""
Enrich 2026 college prospects in historical_college_stats.json with
wingspan_inches gathered from pre-combine scouting events.

Sources: NBADraft.net player profiles, 2024-2025 Nike Hoop Summit,
Adidas Eurocamp/All-American Camp, NBA Draft Combine measurements for players
who declared and withdrew from the 2025 draft.

Usage:
    cd scripts/
    python3 enrich_prospect_wingspans.py
"""

import json
import os
import re
import shutil

STATS_FILE = '../data/historical_college_stats.json'
PUBLIC_DIR = '../draft-dashboard/public/data'

# ---------------------------------------------------------------------------
# Wingspan data — all values in inches
# Sources:
#   NCAA = official event measurement (Nike/Adidas showcase, combine)
#   Reported = widely cited scouting figure, no single official source
# ---------------------------------------------------------------------------
WINGSPANS: dict = {
    # name (as on Tankathon):  wingspan_inches
    'AJ Dybantsa':        83.0,   # 6'11"    Nike Hoop Summit 2024
    'Darryn Peterson':    82.5,   # 6'10.5"  Adidas Eurocamp 2024
    'Caleb Wilson':       84.0,   # 7'0"     listed / scouting consensus
    'Darius Acuff':       77.5,   # 6'5.5"   Nike Elite 100 2023
    'Mikel Brown Jr.':    78.5,   # 6'6.5"   Adidas All-American Camp 2024
    'Labaron Philon':     78.25,  # 6'6.25"  2025 NBA Draft Combine
    'Yaxel Lendeborg':    88.0,   # 7'4"     2025 NBA Draft Combine
    'Tounde Yessoufou':   81.0,   # 6'9"     Nike Elite 100 2023
    'Flory Bidunga':      86.0,   # 7'2"     Nike Hoop Summit 2024
    'Malachi Moreno':     85.75,  # 7'1.75"  Adidas Eurocamp 2024
    'Chris Cenac Jr.':    88.0,   # 7'4"     NBADraft.net
    'Meleek Thomas':      77.0,   # 6'5"     Nike Elite 100 2023
    'Aday Mara':          90.75,  # 7'6.75"  BWB Global measurements
    'JT Toppin':          84.5,   # 7'0.5"   2024 NBA Draft Combine
    'Alex Karaban':       83.0,   # 6'11"    2024 NBA Draft Combine
    'Milos Uzan':         77.25,  # 6'5.25"  2025 NBA Draft Combine
    'Dillon Mitchell':    82.0,   # 6'10"    2023 NBA Draft Combine
    'Trevon Brazile':     87.75,  # 7'3.75"  2024 NBA Draft Combine
    'Amari Allen':        79.75,  # 6'7.75"  Adidas All-American Camp 2024
    'Otega Oweh':         80.5,   # 6'8.5"   2025 NBA Draft Combine
}

# Name aliases: Tankathon name → JSON name
NAME_ALIASES = {
    'JoJo Tugler': 'Joseph Tugler',
}


# ---------------------------------------------------------------------------
# Name normalisation (mirrors other scripts)
# ---------------------------------------------------------------------------
_ACCENT_MAP = str.maketrans(
    'àáâãäåèéêëìíîïòóôõöøùúûüñçý',
    'aaaaaaeeeeiiiioooooouuuuncy'
)
_SUFFIX_RE = re.compile(r'\s*\b(jr\.?|sr\.?|ii|iii|iv|v)\b\.?\s*$', re.IGNORECASE)
_PUNCT_RE  = re.compile(r"[,\.'']")


def _norm(name: str) -> str:
    name = name.translate(_ACCENT_MAP)
    name = _SUFFIX_RE.sub('', name)
    name = _PUNCT_RE.sub('', name)
    return ' '.join(name.lower().split())


def main():
    with open(STATS_FILE) as f:
        players = json.load(f)

    prospects_2026 = [p for p in players if p.get('season') == 2026]
    print(f'Total 2026 prospects: {len(prospects_2026)}')
    print(f'Wingspan entries available: {len(WINGSPANS)}')

    # Build normalised lookup
    resolved = {NAME_ALIASES.get(name, name): ws for name, ws in WINGSPANS.items()}
    ws_norm  = {_norm(name): ws for name, ws in resolved.items()}

    updated = 0
    for p in prospects_2026:
        norm = _norm(p['name'])
        ws = ws_norm.get(norm)

        if ws is None:
            # Fuzzy: last name + first-4
            parts = norm.split()
            if len(parts) >= 2:
                last = parts[-1]
                fp   = parts[0][:4]
                for key, val in ws_norm.items():
                    kp = key.split()
                    if len(kp) >= 2 and kp[-1] == last and kp[0][:4] == fp:
                        ws = val
                        break

        if ws is None:
            continue

        # Sanity check: realistic wingspan range for basketball players
        if not (72 < ws < 100):
            print(f'  SKIP {p["name"]}: wingspan {ws} out of range')
            continue

        p['wingspan_inches'] = ws
        updated += 1

    print(f'\nWingspans added: {updated} / {len(prospects_2026)}')

    # Save
    with open(STATS_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy(STATS_FILE, f'{PUBLIC_DIR}/historical_college_stats.json')
    print(f'\nSaved → {STATS_FILE}  +  {PUBLIC_DIR}/')

    # Coverage summary
    has_ws  = sum(1 for p in prospects_2026 if p.get('wingspan_inches'))
    has_age = sum(1 for p in prospects_2026 if p.get('age_at_season_start'))
    has_ht  = sum(1 for p in prospects_2026 if p.get('height_inches'))
    print(f'\nCoverage (2026 prospects):')
    print(f'  height:   {has_ht}/{len(prospects_2026)}')
    print(f'  age:      {has_age}/{len(prospects_2026)}')
    print(f'  wingspan: {has_ws}/{len(prospects_2026)}')

    # Show top prospects with measurements
    tank_top = ['Cameron Boozer', 'Darryn Peterson', 'AJ Dybantsa', 'Caleb Wilson',
                'Kingston Flemings', 'Darius Acuff', 'Mikel Brown Jr.', 'Flory Bidunga',
                'Malachi Moreno', 'Yaxel Lendeborg']
    print('\nTop prospect measurements:')
    tank_norm_set = {_norm(n) for n in tank_top}
    for p in prospects_2026:
        if _norm(p['name']) in tank_norm_set:
            print(f"  {p['name']}: ht={p.get('height_inches')}, "
                  f"ws={p.get('wingspan_inches')}, age={p.get('age_at_season_start')}")


if __name__ == '__main__':
    main()
