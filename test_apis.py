#!/usr/bin/env python3
"""
NBA Draft Dashboard - API Test Script
This script tests your API access and shows sample data from both APIs.
"""

import os
import sys

print("=" * 60)
print("NBA DRAFT DASHBOARD - API TESTING")
print("=" * 60)
print()

# Check for required packages
required_packages = ['cbbd', 'nba_api']
missing_packages = []

for package in required_packages:
    try:
        __import__(package)
        print(f"✅ {package} is installed")
    except ImportError:
        print(f"❌ {package} is NOT installed")
        missing_packages.append(package)

if missing_packages:
    print("\n⚠️  Please install missing packages:")
    print(f"   pip install {' '.join(missing_packages)}")
    print("\nFor reference:")
    print("   pip install cbbd nba_api pandas")
    sys.exit(1)

print("\n" + "=" * 60)
print("STEP 1: Testing CollegeBasketballData API")
print("=" * 60)

# Import after checking
import cbbd
from cbbd.rest import ApiException

# Get API key from environment variable
api_key = os.environ.get('CBBD_API_KEY')

if not api_key:
    print("\n⚠️  API Key not found in environment variables!")
    print("\nTo set your API key:")
    print("  macOS/Linux:  export CBBD_API_KEY='your_api_key_here'")
    print("  Windows:      set CBBD_API_KEY=your_api_key_here")
    print("\nYou can get your API key from CollegeFootballData.com")
    print("(Same key works for basketball API)")
    
    # Allow manual entry for testing
    print("\n" + "-" * 60)
    api_key = input("Enter your API key now (or press Enter to skip): ").strip()
    
    if not api_key:
        print("\n⚠️  Skipping CollegeBasketballData tests...")
        print("Note: You'll need this API key for the actual dashboard.")
    else:
        print("✅ API key entered (not stored permanently)")

if api_key:
    try:
        # Configure API
        configuration = cbbd.Configuration(access_token=api_key)
        
        # Test 1: Get conference list
        print("\nTest 1: Fetching conferences...")
        with cbbd.ApiClient(configuration) as api_client:
            conferences_api = cbbd.ConferencesApi(api_client)
            conferences = conferences_api.get_conferences()
            
            if conferences:
                print(f"✅ Success! Found {len(conferences)} conferences")
                print(f"   Sample: {conferences[0].name if conferences else 'None'}")
            else:
                print("⚠️  No conferences returned")
        
        # Test 2: Get teams
        print("\nTest 2: Fetching teams...")
        with cbbd.ApiClient(configuration) as api_client:
            teams_api = cbbd.TeamsApi(api_client)
            teams = teams_api.get_teams(conference='ACC')  # Test with ACC
            
            if teams:
                print(f"✅ Success! Found {len(teams)} ACC teams")
                print(f"   Sample teams: {', '.join([t.school for t in teams[:3]])}")
            else:
                print("⚠️  No teams returned")
        
        # Test 3: Get current season player stats
        print("\nTest 3: Fetching current season stats (2025)...")
        with cbbd.ApiClient(configuration) as api_client:
            stats_api = cbbd.StatsApi(api_client)
            try:
                # Try to get some stats for 2025 season
                stats = stats_api.get_player_season_stats(
                    season=2025,
                    team='Duke'  # Example: Duke players
                )
                
                if stats:
                    print(f"✅ Success! Found stats for {len(stats)} players")
                    if stats:
                        player = stats[0]
                        print(f"   Sample: {player.player} - {player.ppg:.1f} PPG, {player.rpg:.1f} RPG, {player.apg:.1f} APG")
                else:
                    print("⚠️  No stats returned (season may not have started)")
            except ApiException as e:
                print(f"⚠️  Could not fetch current season stats: {str(e)}")
                print("   (This might be because the 2025 season hasn't started)")
        
        print("\n✅ CollegeBasketballData API is working!")
        print(f"   Remaining calls this month: Check your account dashboard")
        
    except ApiException as e:
        print(f"\n❌ API Error: {str(e)}")
        print("   Please check your API key is correct")
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")

print("\n" + "=" * 60)
print("STEP 2: Testing NBA API (nba_api)")
print("=" * 60)

try:
    from nba_api.stats.static import players, teams
    from nba_api.stats.endpoints import playercareerstats, commonplayerinfo
    
    print("\nTest 1: Getting all active NBA players...")
    all_players = players.get_active_players()
    print(f"✅ Success! Found {len(all_players)} active NBA players")
    
    # Find a specific player for testing
    print("\nTest 2: Getting LeBron James' career stats...")
    lebron = [p for p in all_players if 'LeBron' in p['full_name']][0]
    print(f"   Player ID: {lebron['id']}")
    print(f"   Full name: {lebron['full_name']}")
    
    # Get career stats
    career = playercareerstats.PlayerCareerStats(player_id=lebron['id'])
    career_df = career.get_dict()
    
    if 'resultSets' in career_df and len(career_df['resultSets']) > 0:
        print("✅ Successfully retrieved career stats!")
        
        # Show latest season
        seasons = career_df['resultSets'][0]
        if 'rowSet' in seasons and len(seasons['rowSet']) > 0:
            latest = seasons['rowSet'][-1]  # Last season
            headers = seasons['headers']
            
            # Create a dict for easier access
            stats = dict(zip(headers, latest))
            print(f"   Latest season: {stats.get('SEASON_ID', 'N/A')}")
            print(f"   PPG: {stats.get('PTS', 0) / stats.get('GP', 1):.1f}")
            print(f"   RPG: {stats.get('REB', 0) / stats.get('GP', 1):.1f}")
            print(f"   APG: {stats.get('AST', 0) / stats.get('GP', 1):.1f}")
    
    print("\nTest 3: Getting NBA teams...")
    all_teams = teams.get_teams()
    print(f"✅ Success! Found {len(all_teams)} NBA teams")
    print(f"   Sample: {all_teams[0]['full_name']}")
    
    # Test player headshot URL
    print("\nTest 4: NBA Player headshot URLs...")
    headshot_url = f"https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/{lebron['id']}.png"
    print(f"   LeBron's headshot URL: {headshot_url}")
    print("   (You can test this URL in a browser)")
    
    print("\n✅ NBA API is working perfectly!")
    print("   Note: nba_api is completely free with no rate limits")
    
except ImportError as e:
    print(f"\n❌ Import error: {str(e)}")
    print("   Please install: pip install nba_api")
except Exception as e:
    print(f"\n❌ Unexpected error: {str(e)}")

print("\n" + "=" * 60)
print("NEXT STEPS")
print("=" * 60)
print("""
1. ✅ Verify both APIs are working (see results above)

2. 📊 Explore the data:
   - Check what stats are available for college players
   - Review NBA career statistics format
   - Identify any missing data fields

3. 🔧 Set up your development environment:
   - Initialize Next.js project: npx create-next-app@latest draft-dashboard
   - Install required packages
   - Set up TypeScript and Tailwind CSS

4. 📝 Create data collection scripts:
   - Fetch historical college player stats (2000-2024)
   - Fetch corresponding NBA career stats
   - Process and normalize the data

5. 🧮 Build the comparison algorithm:
   - Implement stat normalization
   - Calculate weighted distances
   - Test with known player comparisons

Want me to help with any of these steps? Just ask!
""")

print("\n" + "=" * 60)
print("SAMPLE DATA FOR YOUR REFERENCE")
print("=" * 60)
print("""
Example College Stats Format:
{
  "player": "Cooper Flagg",
  "team": "Duke",
  "season": 2025,
  "games": 35,
  "ppg": 18.2,
  "rpg": 8.5,
  "apg": 4.1,
  "fg_pct": 47.5,
  "three_pct": 35.8,
  "ft_pct": 74.2,
  "spg": 1.5,
  "bpg": 1.3,
  "tov": 2.8
}

Example NBA Career Stats Format:
{
  "player_id": "1629673",
  "player_name": "Jayson Tatum",
  "seasons_played": 7,
  "career_ppg": 23.1,
  "career_rpg": 7.2,
  "career_apg": 3.5,
  "career_fg_pct": 45.8,
  "all_star_selections": 6,
  "current_team": "Boston Celtics"
}
""")

print("\nTest complete! 🎉")
