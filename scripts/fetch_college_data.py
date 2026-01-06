#!/usr/bin/env python3
"""
Fetch Historical College Basketball Data
This script fetches college statistics for players who later entered the NBA.
Target: Players from major conferences (2000-2024 seasons)
"""

import os
import sys
import json
import time
from typing import List, Dict, Any
from datetime import datetime

try:
    import cbbd
    from cbbd.rest import ApiException
except ImportError:
    print("❌ Please install cbbd: pip install cbbd")
    sys.exit(1)

# Configuration
API_KEY = os.environ.get('CBBD_API_KEY')
OUTPUT_FILE = '../data/historical_college_stats.json'
START_YEAR = 2000
END_YEAR = 2024

# Major conferences to focus on (for draft prospects)
MAJOR_CONFERENCES = [
    'ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12', 
    'Big East', 'American', 'Mountain West', 'Atlantic 10',
    'WCC', 'Conference USA'
]

# Minimum thresholds to filter out low-usage players
MIN_GAMES = 15
MIN_MINUTES_PER_GAME = 15.0


def setup_api():
    """Initialize the API client"""
    if not API_KEY:
        print("❌ API key not found!")
        print("Set it with: export CBBD_API_KEY='your_key_here'")
        sys.exit(1)
    
    configuration = cbbd.Configuration()
    configuration.api_key["Authorization"] = f"Bearer {API_KEY}"
    return cbbd.ApiClient(configuration)


def fetch_season_stats(api_client, season: int, conference: str = None) -> List[Dict]:
    """
    Fetch player statistics for a specific season
    
    Args:
        api_client: CBBD API client
        season: Year (e.g., 2024)
        conference: Optional conference filter
    
    Returns:
        List of player stat dictionaries
    """
    stats_api = cbbd.StatsApi(api_client)
    
    try:
        print(f"  Fetching {season} season", end='')
        if conference:
            print(f" - {conference}", end='')
        print("...", end='', flush=True)
        
        stats = stats_api.get_player_season_stats(
            season=season,
            conference=conference
        )
        
        print(f" ✅ {len(stats)} players")
        return stats
        
    except ApiException as e:
        print(f" ❌ API Error: {e}")
        return []
    except Exception as e:
        print(f" ❌ Error: {e}")
        return []


def filter_prospects(stats_list: List[Any]) -> List[Dict]:
    """
    Filter for legitimate prospects (remove low-usage players)
    
    Args:
        stats_list: Raw stats from API
    
    Returns:
        Filtered list of player dictionaries
    """
    filtered = []
    
    for stat in stats_list:
        # Convert API object to dict
        player_data = {
            'name': getattr(stat, 'player', 'Unknown'),
            'team': getattr(stat, 'team', 'Unknown'),
            'season': getattr(stat, 'season', None),
            'conference': getattr(stat, 'conference', 'Unknown'),
            'games': getattr(stat, 'games', 0),
            'minutes_per_game': getattr(stat, 'minutes_per_game', 0) or getattr(stat, 'mpg', 0),
            'points_per_game': getattr(stat, 'points_per_game', 0) or getattr(stat, 'ppg', 0),
            'rebounds_per_game': getattr(stat, 'rebounds_per_game', 0) or getattr(stat, 'rpg', 0),
            'assists_per_game': getattr(stat, 'assists_per_game', 0) or getattr(stat, 'apg', 0),
            'steals_per_game': getattr(stat, 'steals_per_game', 0) or getattr(stat, 'spg', 0),
            'blocks_per_game': getattr(stat, 'blocks_per_game', 0) or getattr(stat, 'bpg', 0),
            'turnovers_per_game': getattr(stat, 'turnovers_per_game', 0) or getattr(stat, 'tov', 0),
            'field_goal_percentage': getattr(stat, 'field_goal_percentage', 0) or getattr(stat, 'fg_pct', 0),
            'three_point_percentage': getattr(stat, 'three_point_percentage', 0) or getattr(stat, 'three_pct', 0),
            'free_throw_percentage': getattr(stat, 'free_throw_percentage', 0) or getattr(stat, 'ft_pct', 0),
        }
        
        # Apply filters
        games = player_data['games']
        mpg = player_data['minutes_per_game']
        
        if games >= MIN_GAMES and mpg >= MIN_MINUTES_PER_GAME:
            filtered.append(player_data)
    
    return filtered


def main():
    """Main execution function"""
    print("=" * 60)
    print("HISTORICAL COLLEGE BASKETBALL DATA COLLECTOR")
    print("=" * 60)
    print(f"Target seasons: {START_YEAR}-{END_YEAR}")
    print(f"Conferences: {', '.join(MAJOR_CONFERENCES)}")
    print(f"Filters: Min {MIN_GAMES} games, {MIN_MINUTES_PER_GAME} MPG")
    print()
    
    # Setup
    api_client = setup_api()
    all_players = []
    
    # Create data directory if it doesn't exist
    os.makedirs('../data', exist_ok=True)
    
    # Fetch data year by year
    print("Fetching data...")
    print("-" * 60)
    
    for year in range(START_YEAR, END_YEAR + 1):
        print(f"\n📅 Season {year}:")
        
        # Strategy: Fetch by conference to manage rate limits
        for conf in MAJOR_CONFERENCES:
            stats = fetch_season_stats(api_client, year, conf)
            
            if stats:
                filtered = filter_prospects(stats)
                all_players.extend(filtered)
            
            # Rate limiting: Small delay between requests
            time.sleep(0.5)
        
        print(f"  Total players for {year}: {len([p for p in all_players if p['season'] == year])}")
        
        # Save progress after each year (in case of interruption)
        with open(OUTPUT_FILE, 'w') as f:
            json.dump(all_players, f, indent=2)
    
    # Final summary
    print("\n" + "=" * 60)
    print("DATA COLLECTION COMPLETE")
    print("=" * 60)
    print(f"Total players collected: {len(all_players)}")
    print(f"Seasons covered: {END_YEAR - START_YEAR + 1}")
    print(f"Output file: {OUTPUT_FILE}")
    print()
    
    # Show sample
    if all_players:
        print("Sample player:")
        print(json.dumps(all_players[0], indent=2))
    
    print("\n✅ Data saved successfully!")
    print("\n💡 Next step: Run fetch_nba_data.py to get NBA career stats")


if __name__ == "__main__":
    main()
