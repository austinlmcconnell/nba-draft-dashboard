#!/usr/bin/env python3
import os
import cbbd

API_KEY = os.getenv('CBBD_API_KEY')

# Try different configuration method
configuration = cbbd.Configuration()
configuration.api_key['Authorization'] = API_KEY
configuration.api_key_prefix['Authorization'] = 'Bearer'

api_client = cbbd.ApiClient(configuration)
stats_api = cbbd.StatsApi(api_client)

print("Testing 2024 ACC...")
try:
    stats = stats_api.get_player_season_stats(season=2024, conference='ACC')
    print(f"✅ Success! Found {len(stats)} players")
    
    if stats:
        print(f"\nFirst player: {stats[0].name}")
        print(f"Team: {stats[0].team}")
        print(f"Points: {stats[0].points}")
        
except Exception as e:
    print(f"❌ Error: {e}")
