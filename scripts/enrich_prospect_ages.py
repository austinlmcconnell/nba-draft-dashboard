#!/usr/bin/env python3
"""
Enrich 2026 college prospects in historical_college_stats.json with
age_at_season_start from Tankathon big board data.

Tankathon reports age at the projected draft date (~June 26, 2026).
We back-calculate age on November 1, 2025 (season start):
  June 26, 2026 − November 1, 2025 ≈ 7.83 months ≈ 0.653 years
  age_at_season_start = floor(draft_age − 0.653)

Usage:
    cd scripts/
    python3 enrich_prospect_ages.py
"""

import json
import math
import os
import re
import shutil

STATS_FILE = '../data/historical_college_stats.json'
PUBLIC_DIR = '../draft-dashboard/public/data'

# ---------------------------------------------------------------------------
# Tankathon 2026 big board — name: age_at_draft (decimal years)
# Source: tankathon.com/big_board, scraped 2026-03-02
# ---------------------------------------------------------------------------
TANKATHON = {
    'Cameron Boozer':       18.9,
    'Darryn Peterson':      19.4,
    'AJ Dybantsa':          19.4,
    'Caleb Wilson':         19.9,
    'Kingston Flemings':    19.5,
    'Darius Acuff':         19.6,
    'Mikel Brown Jr.':      20.2,
    'Keaton Wagler':        19.4,
    'Nate Ament':           19.5,
    'Braylon Mullins':      20.2,
    'Hannes Steinbach':     20.1,
    'Labaron Philon':       20.6,
    'Yaxel Lendeborg':      23.7,
    'Brayden Burries':      20.8,
    'Thomas Haugh':         22.9,
    'Koa Peat':             19.4,
    'Tounde Yessoufou':     20.1,
    'Jayden Quaintance':    18.9,
    'Bennett Stirtz':       22.7,
    'Patrick Ngongba II':   20.3,
    'Chris Cenac Jr.':      19.4,
    'Karim Lopez':          19.2,   # accent stripped
    'Christian Anderson':   20.2,
    'Cameron Carr':         21.6,
    'Tyler Tanner':         20.4,
    'Joshua Jefferson':     22.6,
    'Amari Allen':          20.4,
    'Alijah Arenas':        19.3,
    'Aday Mara':            21.2,
    'Flory Bidunga':        21.1,
    'Ebuka Okorie':         19.2,
    'Malachi Moreno':       19.7,
    'Morez Johnson Jr.':    20.4,
    'Dailyn Swain':         20.9,
    'Sergio de Larrea':     20.5,
    'Meleek Thomas':        19.9,
    'Henri Veesaar':        22.2,
    'Zuby Ejiofor':         22.2,
    'Isaiah Evans':         20.5,
    'Braden Smith':         22.9,
    'JT Toppin':            21.0,
    'Juke Harris':          20.9,
    'Richie Saunders':      24.8,
    'Dash Daniels':         18.5,
    'Alex Karaban':         23.6,
    'JoJo Tugler':          21.1,
    'Ryan Conwell':         22.0,
    'Paul McNeil Jr.':      20.2,
    'Tarris Reed Jr.':      22.9,
    'Motiejus Krivas':      21.6,
    'Alex Condon':          21.9,
    'Rueben Chinyelu':      22.7,
    'Keyshawn Hall':        23.2,
    'Milan Momcilovic':     21.7,
    'Bruce Thornton':       22.8,
    'Tamin Lipsey':         22.9,
    'Jaden Bradley':        22.8,
    'Miles Byrd':           21.8,
    'Nate Bittle':          23.0,
    'Zvonimir Ivisic':      22.8,
    'Darrion Williams':     23.2,
    'Tomislav Ivisic':      22.8,
    'Milos Uzan':           23.5,
    'Otega Oweh':           22.9,
    'Dillon Mitchell':      22.7,
    'Baba Miller':          22.4,
    'Johann Grunloh':       20.8,   # accent stripped
    'Tahaad Pettiford':     20.9,
    'Mouhamed Faye':        21.4,
    'Tucker DeVries':       23.5,
    'Karter Knox':          21.1,
    'Andrej Stojakovic':    21.8,
    'KJ Lewis':             21.9,
    'Malik Reneau':         23.2,
    'Kylan Boswell':        21.2,
    'Coen Carr':            21.6,
    'Trevon Brazile':       23.4,
    'Mark Mitchell':        22.8,
    'Magoon Gwath':         20.9,
    'Boogie Fland':         19.9,
    'Solo Ball':            22.5,
    'Michael Ruzic':        19.7,
    'Kwame Evans':          21.9,
}

# Months from Nov 1, 2025 to projected draft date ~June 26, 2026
# = 7 months 25 days ≈ 0.653 years
DRAFT_TO_SEASON_START_OFFSET = 0.653

# Tankathon name → exact name in historical_college_stats.json
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


def draft_age_to_season_age(draft_age: float) -> int:
    """Convert Tankathon draft-day age to integer age at Nov 1, 2025."""
    return math.floor(draft_age - DRAFT_TO_SEASON_START_OFFSET)


def main():
    with open(STATS_FILE) as f:
        players = json.load(f)

    prospects_2026 = [p for p in players if p.get('season') == 2026]
    print(f'Total 2026 prospects: {len(prospects_2026)}')
    print(f'Tankathon entries: {len(TANKATHON)}')

    # Build normalised lookup: norm_name → draft_age (applying aliases first)
    resolved = {NAME_ALIASES.get(name, name): age for name, age in TANKATHON.items()}
    tank_norm = {_norm(name): age for name, age in resolved.items()}

    updated = 0
    unmatched = []

    for p in prospects_2026:
        norm = _norm(p['name'])
        draft_age = tank_norm.get(norm)

        if draft_age is None:
            # Try last-name + first-4 fuzzy match
            parts = norm.split()
            if len(parts) >= 2:
                last = parts[-1]
                fp   = parts[0][:4]
                for key, age in tank_norm.items():
                    kp = key.split()
                    if len(kp) >= 2 and kp[-1] == last and kp[0][:4] == fp:
                        draft_age = age
                        break

        if draft_age is None:
            unmatched.append(p['name'])
            continue

        season_age = draft_age_to_season_age(draft_age)
        # Sanity-check: college players should be 17-26 at season start
        if not (17 <= season_age <= 26):
            print(f'  SKIP {p["name"]}: computed age {season_age} out of range')
            continue

        p['age_at_season_start'] = season_age
        updated += 1

    print(f'\nAges added: {updated} / {len(prospects_2026)}')
    print(f'Unmatched (not on Tankathon big board): {len(unmatched)}')
    if unmatched[:10]:
        print('  Sample unmatched:', unmatched[:10])

    # Save
    with open(STATS_FILE, 'w') as f:
        json.dump(players, f, indent=2)

    os.makedirs(PUBLIC_DIR, exist_ok=True)
    shutil.copy(STATS_FILE, f'{PUBLIC_DIR}/historical_college_stats.json')
    print(f'\nSaved → {STATS_FILE}  +  {PUBLIC_DIR}/')

    # Coverage summary
    has_age = sum(1 for p in prospects_2026 if p.get('age_at_season_start'))
    print(f'Age coverage: {has_age}/{len(prospects_2026)} 2026 prospects')


if __name__ == '__main__':
    main()
