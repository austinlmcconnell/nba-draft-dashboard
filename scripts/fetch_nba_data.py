#!/usr/bin/env python3
"""
Fetch NBA Career Statistics
This script fetches NBA career stats for all players in the historical database.
Uses the free nba_api package.
"""

import json
import time
import sys
from typing import Dict, List, Any, Optional

try:
    from nba_api.stats.static import players
    from nba_api.stats.endpoints import playercareerstats, commonplayerinfo
except ImportError:
    print("❌ Please install nba_api: pip install nba_api")
    sys.exit(1)

# Configuration
COLLEGE_DATA_FILE = '../data/historical_college_stats.json'
OUTPUT_FILE = '../data/nba_career_stats.json'
RATE_LIMIT_DELAY = 0.6  # Seconds between requests (be nice to NBA.com)


def load_college_players() -> List[Dict]:
    """Load the college players data"""
    try:
        with open(COLLEGE_DATA_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ College data file not found: {COLLEGE_DATA_FILE}")
        print("   Run fetch_college_data.py first!")
        sys.exit(1)


def get_all_nba_players() -> List[Dict]:
    """Get list of all NBA players (past and present)"""
    print("Fetching NBA player list...")
    all_players = players.get_players()
    print(f"✅ Found {len(all_players)} NBA players in database")
    return all_players


def find_nba_player(college_name: str, nba_players: List[Dict]) -> Optional[Dict]:
    """
    Try to match a college player name to an NBA player
    
    Args:
        college_name: Name from college stats
        nba_players: List of NBA player dictionaries
    
    Returns:
        Matching NBA player dict or None
    """
    # Normalize the college name
    college_name_norm = college_name.lower().strip()
    
    # Try exact match on full name
    for nba_player in nba_players:
        if nba_player['full_name'].lower() == college_name_norm:
            return nba_player
    
    # Try matching last name + first initial
    # (Some college databases use abbreviated names)
    college_parts = college_name_norm.split()
    if len(college_parts) >= 2:
        last_name = college_parts[-1]
        first_initial = college_parts[0][0] if college_parts[0] else ''
        
        for nba_player in nba_players:
            nba_name_lower = nba_player['full_name'].lower()
            nba_parts = nba_name_lower.split()
            
            if len(nba_parts) >= 2:
                nba_last = nba_parts[-1]
                nba_first_initial = nba_parts[0][0] if nba_parts[0] else ''
                
                if last_name == nba_last and first_initial == nba_first_initial:
                    return nba_player
    
    return None


def fetch_player_career(player_id: int) -> Optional[Dict]:
    """
    Fetch career statistics for a specific NBA player
    
    Args:
        player_id: NBA player ID
    
    Returns:
        Dictionary with career stats or None if error
    """
    try:
        # Get career stats
        career = playercareerstats.PlayerCareerStats(
            player_id=str(player_id),
            timeout=30
        )
        
        career_dict = career.get_dict()
        
        if not career_dict or 'resultSets' not in career_dict:
            return None
        
        result_sets = career_dict['resultSets']
        if not result_sets or len(result_sets) == 0:
            return None
        
        # Extract career totals (regular season)
        career_totals = result_sets[0]
        if 'rowSet' not in career_totals or not career_totals['rowSet']:
            return None
        
        headers = career_totals['headers']
        rows = career_totals['rowSet']
        
        # Calculate career averages
        total_games = 0
        total_points = 0
        total_rebounds = 0
        total_assists = 0
        total_steals = 0
        total_blocks = 0
        total_turnovers = 0
        seasons_played = len(rows)
        
        for row in rows:
            stats = dict(zip(headers, row))
            games = stats.get('GP', 0)
            
            total_games += games
            total_points += stats.get('PTS', 0)
            total_rebounds += stats.get('REB', 0)
            total_assists += stats.get('AST', 0)
            total_steals += stats.get('STL', 0)
            total_blocks += stats.get('BLK', 0)
            total_turnovers += stats.get('TOV', 0)
        
        if total_games == 0:
            return None
        
        # Calculate career averages
        career_stats = {
            'player_id': player_id,
            'seasons_played': seasons_played,
            'games_played': total_games,
            'career_ppg': round(total_points / total_games, 1),
            'career_rpg': round(total_rebounds / total_games, 1),
            'career_apg': round(total_assists / total_games, 1),
            'career_spg': round(total_steals / total_games, 1),
            'career_bpg': round(total_blocks / total_games, 1),
            'career_tov': round(total_turnovers / total_games, 1),
        }
        
        # Get additional player info (All-Star selections, etc.)
        try:
            player_info = commonplayerinfo.CommonPlayerInfo(player_id=str(player_id))
            info_dict = player_info.get_dict()
            
            # This would require parsing the player info response
            # For now, we'll leave these as 0 and can enhance later
            career_stats['all_star_selections'] = 0
            career_stats['all_nba_selections'] = 0
            career_stats['championships'] = 0
            
        except:
            pass
        
        return career_stats
        
    except Exception as e:
        print(f"    ❌ Error fetching stats: {e}")
        return None


def main():
    """Main execution function"""
    print("=" * 60)
    print("NBA CAREER STATISTICS COLLECTOR")
    print("=" * 60)
    print()
    
    # Load college data
    college_players = load_college_players()
    print(f"Loaded {len(college_players)} college player records")
    print()
    
    # Get NBA player list
    nba_players = get_all_nba_players()
    print()
    
    # Match and fetch stats
    print("Matching college players to NBA careers...")
    print("-" * 60)
    
    matched_players = []
    unmatched_count = 0
    processed = 0
    
    # Get unique college player names
    unique_players = {}
    for cp in college_players:
        name = cp['name']
        if name not in unique_players:
            unique_players[name] = cp
    
    total_unique = len(unique_players)
    print(f"Processing {total_unique} unique players...\n")
    
    for idx, (name, college_data) in enumerate(unique_players.items(), 1):
        if idx % 10 == 0:
            print(f"Progress: {idx}/{total_unique} ({idx*100//total_unique}%)")
        
        # Find matching NBA player
        nba_player = find_nba_player(name, nba_players)
        
        if not nba_player:
            unmatched_count += 1
            continue
        
        print(f"  ✅ {name} → NBA ID: {nba_player['id']}")
        
        # Fetch career stats
        career_stats = fetch_player_career(nba_player['id'])
        
        if career_stats:
            # Combine college and NBA data
            matched_data = {
                'name': name,
                'nba_player_id': nba_player['id'],
                'college_team': college_data['team'],
                'college_season': college_data['season'],
                'college_stats': college_data,
                'nba_career': career_stats,
                'is_active': nba_player.get('is_active', False)
            }
            
            matched_players.append(matched_data)
        
        # Rate limiting
        time.sleep(RATE_LIMIT_DELAY)
        processed += 1
    
    # Save results
    print("\n" + "=" * 60)
    print("DATA COLLECTION COMPLETE")
    print("=" * 60)
    print(f"Total unique college players: {total_unique}")
    print(f"Matched to NBA: {len(matched_players)}")
    print(f"Unmatched: {unmatched_count}")
    print(f"Match rate: {len(matched_players)*100//total_unique}%")
    print(f"Output file: {OUTPUT_FILE}")
    print()
    
    # Save to file
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(matched_players, f, indent=2)
    
    # Show sample
    if matched_players:
        print("Sample matched player:")
        sample = matched_players[0]
        print(f"  Name: {sample['name']}")
        print(f"  College: {sample['college_team']} ({sample['college_season']})")
        print(f"  College PPG: {sample['college_stats']['points_per_game']}")
        print(f"  NBA Career PPG: {sample['nba_career']['career_ppg']}")
    
    print("\n✅ Data saved successfully!")
    print("\n💡 Next step: Use this data to build the comparison algorithm")


if __name__ == "__main__":
    main()
