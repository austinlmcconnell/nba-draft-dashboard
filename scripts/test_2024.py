#!/usr/bin/env python3
"""
Quick test script - fetch only 2024 season
"""

import os
import sys
import json
import cbbd
from cbbd.rest import ApiException

API_KEY = os.getenv('CBBD_API_KEY')

def main():
    if not API_KEY:
        print("❌ API key not found!")
        sys.exit(1)
    
    # Setup API with Bearer token
    configuration = cbbd.Configuration()
    configuration.api_key['Authorization'] = f'Bearer {API_KEY}'
    api_client = cbbd.ApiClient(configuration)
    stats_api = cbbd.StatsApi(api_client)
    
    print("Testing 2024 ACC...")
    try:
        stats = stats_api.get_player_season_stats(season=2024, conference='ACC')
        print(f"✅ Success! Found {len(stats)} players")
        
        if stats:
            first = stats[0]
            print(f"\nSample player:")
            print(f"  Name: {first.player}")
            print(f"  Team: {first.team}")
            print(f"  Games: {first.games}")
            print(f"  PPG: {first.points_per_game}")
            
    except ApiException as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    main()
