#!/usr/bin/env python3
"""
Master Data Collection Script
Runs the complete data collection pipeline:
1. Fetch historical college stats
2. Fetch NBA career stats
3. Generate summary report
"""

import os
import sys
import json
import subprocess
from datetime import datetime

def print_header(text):
    """Print a formatted header"""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70 + "\n")

def run_script(script_name, description):
    """Run a Python script and handle errors"""
    print_header(description)
    print(f"Running: {script_name}\n")
    
    try:
        result = subprocess.run(
            [sys.executable, script_name],
            check=True,
            capture_output=False,
            text=True
        )
        print(f"\n✅ {description} - COMPLETE")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n❌ {description} - FAILED")
        print(f"Error: {e}")
        return False
    except FileNotFoundError:
        print(f"\n❌ Script not found: {script_name}")
        return False

def generate_summary():
    """Generate a summary report of collected data"""
    print_header("GENERATING SUMMARY REPORT")
    
    try:
        # Load college data
        with open('../data/historical_college_stats.json', 'r') as f:
            college_data = json.load(f)
        
        # Load NBA data
        with open('../data/nba_career_stats.json', 'r') as f:
            nba_data = json.load(f)
        
        # Calculate statistics
        total_college_players = len(college_data)
        unique_names = len(set(p['name'] for p in college_data))
        matched_to_nba = len(nba_data)
        
        seasons = sorted(set(p['season'] for p in college_data))
        conferences = sorted(set(p['conference'] for p in college_data))
        
        # NBA career stats
        active_players = sum(1 for p in nba_data if p.get('is_active', False))
        avg_nba_seasons = sum(p['nba_career']['seasons_played'] for p in nba_data) / len(nba_data) if nba_data else 0
        
        # Create summary
        summary = {
            'generated_at': datetime.now().isoformat(),
            'college_data': {
                'total_player_records': total_college_players,
                'unique_players': unique_names,
                'seasons_covered': f"{seasons[0]}-{seasons[-1]}",
                'total_seasons': len(seasons),
                'conferences': len(conferences),
                'conference_list': conferences
            },
            'nba_data': {
                'matched_players': matched_to_nba,
                'match_rate_pct': round(matched_to_nba * 100 / unique_names, 1),
                'active_players': active_players,
                'retired_players': matched_to_nba - active_players,
                'avg_seasons_played': round(avg_nba_seasons, 1)
            },
            'top_college_scorers': sorted(
                college_data,
                key=lambda x: x['points_per_game'],
                reverse=True
            )[:10],
            'top_nba_careers': sorted(
                nba_data,
                key=lambda x: x['nba_career']['career_ppg'],
                reverse=True
            )[:10]
        }
        
        # Save summary
        with open('../data/collection_summary.json', 'w') as f:
            json.dump(summary, f, indent=2)
        
        # Print summary
        print("📊 DATA COLLECTION SUMMARY")
        print("-" * 70)
        print(f"\n🎓 COLLEGE DATA:")
        print(f"   Total player records: {summary['college_data']['total_player_records']:,}")
        print(f"   Unique players: {summary['college_data']['unique_players']:,}")
        print(f"   Seasons: {summary['college_data']['seasons_covered']}")
        print(f"   Conferences: {summary['college_data']['conferences']}")
        
        print(f"\n🏀 NBA DATA:")
        print(f"   Matched to NBA: {summary['nba_data']['matched_players']:,}")
        print(f"   Match rate: {summary['nba_data']['match_rate_pct']}%")
        print(f"   Active players: {summary['nba_data']['active_players']}")
        print(f"   Retired players: {summary['nba_data']['retired_players']}")
        print(f"   Avg NBA career: {summary['nba_data']['avg_seasons_played']} seasons")
        
        print(f"\n📈 TOP COLLEGE SCORERS:")
        for i, player in enumerate(summary['top_college_scorers'][:5], 1):
            print(f"   {i}. {player['name']} ({player['team']}, {player['season']}) - {player['points_per_game']} PPG")
        
        print(f"\n🌟 TOP NBA CAREERS (by PPG):")
        for i, player in enumerate(summary['top_nba_careers'][:5], 1):
            ppg = player['nba_career']['career_ppg']
            print(f"   {i}. {player['name']} - {ppg} PPG")
        
        print(f"\n💾 Summary saved to: ../data/collection_summary.json")
        
        return True
        
    except FileNotFoundError as e:
        print(f"❌ Data file not found: {e}")
        return False
    except Exception as e:
        print(f"❌ Error generating summary: {e}")
        return False

def main():
    """Main execution"""
    print("\n" + "🏀" * 35)
    print("  NBA DRAFT DASHBOARD - MASTER DATA COLLECTION")
    print("🏀" * 35)
    
    # Check API key
    if not os.environ.get('CBBD_API_KEY'):
        print("\n❌ ERROR: CBBD_API_KEY environment variable not set!")
        print("Set it with: export CBBD_API_KEY='your_key_here'")
        sys.exit(1)
    
    # Create data directory
    os.makedirs('../data', exist_ok=True)
    
    print("\n⚡ Starting data collection pipeline...")
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    start_time = datetime.now()
    
    # Step 1: Fetch college data
    success_college = run_script(
        'fetch_college_data.py',
        'STEP 1: Fetching Historical College Stats'
    )
    
    if not success_college:
        print("\n❌ Pipeline failed at Step 1")
        sys.exit(1)
    
    # Step 2: Fetch NBA data
    success_nba = run_script(
        'fetch_nba_data.py',
        'STEP 2: Fetching NBA Career Stats'
    )
    
    if not success_nba:
        print("\n❌ Pipeline failed at Step 2")
        sys.exit(1)
    
    # Step 3: Generate summary
    print_header("STEP 3: Generating Summary Report")
    success_summary = generate_summary()
    
    # Final report
    end_time = datetime.now()
    duration = end_time - start_time
    
    print_header("PIPELINE COMPLETE")
    print(f"✅ All steps completed successfully!")
    print(f"⏱️  Total time: {duration}")
    print(f"\n📁 Output files:")
    print(f"   • ../data/historical_college_stats.json")
    print(f"   • ../data/nba_career_stats.json")
    print(f"   • ../data/collection_summary.json")
    
    print(f"\n🎯 NEXT STEPS:")
    print(f"   1. Review the summary report")
    print(f"   2. Build the comparison algorithm (Day 3)")
    print(f"   3. Start building the dashboard UI")
    
    print("\n" + "🏀" * 35 + "\n")

if __name__ == "__main__":
    main()
