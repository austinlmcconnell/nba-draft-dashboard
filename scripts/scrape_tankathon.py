"""
Scrape the Tankathon NBA Draft Big Board.

The page is server-side rendered (Rails + Turbo) — the player data is embedded
in the page text, not in a JSON blob.  We parse the body text directly.

Outputs: draft-dashboard/public/data/draft_rankings.json

Each entry:
  {
    "rank":     int,
    "name":     str,
    "position": str,          # e.g. "PF", "SG/PG"
    "school":   str,          # e.g. "Duke"
    "height":   str | null,   # e.g. "6'9\""
    "weight":   int | null,   # lbs
    "class":    str | null,   # "Freshman" | "Sophomore" | …
  }
"""

import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

OUT_FILE = (
    Path(__file__).parent.parent
    / "draft-dashboard"
    / "public"
    / "data"
    / "draft_rankings.json"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

CLASSES = {"Freshman", "Sophomore", "Junior", "Senior", "Other"}

# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_tankathon(html: str) -> list[dict]:
    """
    Tankathon's big board renders each player row as a block of text.
    Example (pipe-separated after joining text nodes):
        1 | Cameron Boozer | PF | Duke | 6'9" | 250 | lbs | Freshman | 18.9 yrs | …
    """
    soup = BeautifulSoup(html, "html.parser")
    players: list[dict] = []

    # Strategy A: each player has a rank + name in a labelled div/td structure
    # Look for the big-board table or list container
    # The visible text of each row looks like:
    #   "<rank>  <name>  <pos> | <school>  <height>  <weight> lbs  <class>  <age> yrs  …"

    # Remove script/style/nav noise
    for tag in soup.find_all(["script", "style", "header", "footer", "nav"]):
        tag.decompose()

    body_text = soup.get_text(separator="\n", strip=True)

    # Split into lines and walk through them
    lines = [ln.strip() for ln in body_text.splitlines() if ln.strip()]

    i = 0
    while i < len(lines):
        line = lines[i]

        # A rank line is just a small integer (1-150)
        if re.fullmatch(r"\d{1,3}", line) and int(line) <= 150:
            rank = int(line)

            # The next non-empty line should be the player name
            j = i + 1
            while j < len(lines) and not lines[j]:
                j += 1

            if j >= len(lines):
                i += 1
                continue

            name_line = lines[j]

            # Skip if name_line looks like a tier label ("TIER 1", "THE REST", etc.)
            if re.match(r"(TIER|THE\s+REST|LOTTERY|TOP)", name_line, re.I):
                i += 1
                continue

            # name could be multi-word — accept anything with letters that isn't a stat
            if not re.search(r"[A-Za-z]{2}", name_line):
                i += 1
                continue

            name = name_line

            # Collect the next few lines to find pos/school, height, weight, class
            context_lines = lines[j + 1 : j + 10]

            position = ""
            school = ""
            height = None
            weight = None
            player_class = None

            for cl in context_lines:
                # "PF | Duke"  or "SG/PG | Kansas"
                m = re.match(
                    r"^([A-Z]{1,2}(?:/[A-Z]{1,2})?) \| (.+)$", cl
                )
                if m and not position:
                    position = m.group(1).strip()
                    school = m.group(2).strip()
                    continue

                # Height "6'9"" or "6'9.75\""
                if re.match(r"^\d'[\d.]+\"?$", cl) and height is None:
                    height = cl.rstrip('"') + '"' if not cl.endswith('"') else cl
                    continue

                # Weight line is just digits (e.g. "250")
                if re.fullmatch(r"\d{2,3}", cl) and weight is None:
                    weight = int(cl)
                    continue

                # Class
                if cl in CLASSES and player_class is None:
                    player_class = cl
                    continue

            # Only add if we got at least a school
            if school or position:
                players.append(
                    {
                        "rank": rank,
                        "name": name,
                        "position": position,
                        "school": school,
                        "height": height,
                        "weight": weight,
                        "class": player_class,
                    }
                )

        i += 1

    return players


# ---------------------------------------------------------------------------
# Strategy B: find player rows by rank span / element
# ---------------------------------------------------------------------------

def parse_tankathon_dom(html: str) -> list[dict]:
    """DOM-based fallback: look for elements whose text is a rank number
    adjacent to a player-name element."""
    soup = BeautifulSoup(html, "html.parser")
    players: list[dict] = []
    seen: set[int] = set()

    for el in soup.find_all(string=re.compile(r"^\s*\d{1,3}\s*$")):
        text = el.strip()
        if not text.isdigit():
            continue
        rank = int(text)
        if rank < 1 or rank > 150 or rank in seen:
            continue

        # Walk up to find a row container
        container = el.parent
        for _ in range(4):
            if container is None:
                break
            container = container.parent

        if container is None:
            continue

        row_text = container.get_text(separator="|", strip=True)

        # Parse pos|school pattern
        m = re.search(r"([A-Z]{1,2}(?:/[A-Z]{1,2})?)\s*\|\s*([A-Za-z &'.]+)", row_text)
        position = m.group(1) if m else ""
        school   = m.group(2).strip() if m else ""

        # Height
        hm = re.search(r"(\d)'([\d.]+\"?)", row_text)
        height = f"{hm.group(1)}'{hm.group(2)}" if hm else None
        if height and not height.endswith('"'):
            height += '"'

        # Weight (3-digit number after rank)
        wm = re.search(r"\|(\d{2,3})\|lbs", row_text)
        weight = int(wm.group(1)) if wm else None

        # Class
        player_class = next(
            (c for c in CLASSES if c in row_text), None
        )

        # Player name — hard to isolate; look for a link or bold element
        name_el = container.find("a") or container.find("b") or container.find("strong")
        name = name_el.get_text(strip=True) if name_el else ""

        if not name:
            continue

        seen.add(rank)
        players.append(
            {
                "rank": rank,
                "name": name,
                "position": position,
                "school": school,
                "height": height,
                "weight": weight,
                "class": player_class,
            }
        )

    return players


# ---------------------------------------------------------------------------
# Fetch & run
# ---------------------------------------------------------------------------

def fetch_tankathon() -> list[dict]:
    url = "https://www.tankathon.com/big_board"
    print(f"Fetching {url} …")
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    html = resp.text

    players = parse_tankathon(html)
    print(f"  Text-parse found {len(players)} players")

    if len(players) < 10:
        players = parse_tankathon_dom(html)
        print(f"  DOM-parse found {len(players)} players")

    return players


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    players = fetch_tankathon()

    if not players:
        print("ERROR: no players found.", file=sys.stderr)
        sys.exit(1)

    # Deduplicate by rank (keep first occurrence)
    seen: set[int] = set()
    unique: list[dict] = []
    for p in players:
        if p["rank"] not in seen:
            seen.add(p["rank"])
            unique.append(p)

    unique.sort(key=lambda p: p["rank"])

    # Re-sequence ranks to be consecutive 1-N
    for i, p in enumerate(unique, 1):
        p["rank"] = i

    # Cap at 120
    unique = unique[:120]

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as fh:
        json.dump(unique, fh, indent=2, ensure_ascii=False)

    print(f"\nWrote {len(unique)} players → {OUT_FILE}")
    for p in unique[:10]:
        print(f"  #{p['rank']:3d}  {p['name']:<28}  {p['position']:<7}  {p['school']}")


if __name__ == "__main__":
    main()
