# 📊 Data Collection Scripts

These Python scripts collect historical college basketball and NBA data for the comparison algorithm.

---

## 🎯 Quick Start

**Run everything at once:**
```bash
# Make sure you're in the scripts directory
cd ~/Desktop/draft-project/scripts

# Activate your virtual environment
source ../venv/bin/activate

# Set your API key
export CBBD_API_KEY='your_key_here'

# Run the master script (this will take 30-60 minutes)
python run_all.py
```

---

## 📁 Scripts Overview

### `run_all.py` - Master Script ⭐
Runs the entire pipeline in order:
1. Fetches college data
2. Fetches NBA data
3. Generates summary report

**Usage:**
```bash
python run_all.py
```

**Output:**
- `../data/historical_college_stats.json` - All college player stats (2000-2024)
- `../data/nba_career_stats.json` - Matched players with NBA careers
- `../data/collection_summary.json` - Summary statistics

---

### `fetch_college_data.py` - College Stats
Fetches historical college basketball statistics from CollegeBasketballData API.

**What it does:**
- Collects data from 2000-2024 seasons
- Focuses on major conferences (ACC, Big Ten, SEC, etc.)
- Filters for legitimate prospects (15+ games, 15+ MPG)
- Saves progress after each season

**Usage:**
```bash
python fetch_college_data.py
```

**Configuration** (edit at top of file):
```python
START_YEAR = 2000          # First season to fetch
END_YEAR = 2024            # Last season to fetch
MIN_GAMES = 15             # Minimum games played
MIN_MINUTES_PER_GAME = 15  # Minimum minutes per game
```

**⚠️ Rate Limits:**
- Free tier: 1,000 calls/month
- Each season × conference = 1 call
- ~25 years × 11 conferences = ~275 calls
- Includes 0.5s delay between requests

---

### `fetch_nba_data.py` - NBA Career Stats
Matches college players to NBA players and fetches career statistics.

**What it does:**
- Loads college player data
- Matches names to NBA player database
- Fetches career stats for each player
- Calculates career averages

**Usage:**
```bash
python fetch_nba_data.py
```

**Requirements:**
- Must run `fetch_college_data.py` first
- Uses free nba_api (no key needed)

**⚠️ Rate Limits:**
- No official limit, but be respectful
- Includes 0.6s delay between requests
- ~1,000 players = ~10-15 minutes

---

## 📊 Data Formats

### College Stats Format
```json
{
  "name": "Cooper Flagg",
  "team": "Duke",
  "season": 2025,
  "conference": "ACC",
  "games": 35,
  "minutes_per_game": 32.5,
  "points_per_game": 18.2,
  "rebounds_per_game": 8.5,
  "assists_per_game": 4.1,
  "steals_per_game": 1.5,
  "blocks_per_game": 1.3,
  "turnovers_per_game": 2.8,
  "field_goal_percentage": 47.5,
  "three_point_percentage": 35.8,
  "free_throw_percentage": 74.2
}
```

### NBA Career Stats Format
```json
{
  "name": "Jayson Tatum",
  "nba_player_id": 1628369,
  "college_team": "Duke",
  "college_season": 2017,
  "college_stats": { ... },
  "nba_career": {
    "player_id": 1628369,
    "seasons_played": 7,
    "games_played": 565,
    "career_ppg": 23.1,
    "career_rpg": 7.2,
    "career_apg": 3.5,
    "career_spg": 1.1,
    "career_bpg": 0.7,
    "career_tov": 2.3,
    "all_star_selections": 6,
    "all_nba_selections": 4,
    "championships": 1
  },
  "is_active": true
}
```

---

## ⚙️ Configuration

### Environment Variables
```bash
# Required
export CBBD_API_KEY='your_college_basketball_api_key'

# Optional - customize output location
export DATA_DIR='path/to/data/directory'
```

### Minimum Thresholds
Edit these in `fetch_college_data.py`:
```python
MIN_GAMES = 15              # Filter out low-usage players
MIN_MINUTES_PER_GAME = 15.0 # Minimum MPG for inclusion
```

### Conferences to Include
Edit `MAJOR_CONFERENCES` list in `fetch_college_data.py`:
```python
MAJOR_CONFERENCES = [
    'ACC', 'Big Ten', 'Big 12', 'SEC', 'Pac-12',
    # Add more as needed...
]
```

---

## 🐛 Troubleshooting

### "API key not found"
```bash
export CBBD_API_KEY='your_key_here'
# Verify it's set:
echo $CBBD_API_KEY
```

### "Rate limit exceeded"
- Wait until next month or upgrade tier
- Reduce year range: `START_YEAR = 2015` instead of 2000
- Comment out some conferences in `MAJOR_CONFERENCES`

### "No module named 'cbbd'"
```bash
# Make sure virtual environment is activated
source ../venv/bin/activate
pip install cbbd nba_api
```

### Script crashes mid-run
- Don't worry! `fetch_college_data.py` saves after each year
- Just run again - it will resume
- Check `../data/historical_college_stats.json` for partial data

### Low match rate (<50%)
- Name matching isn't perfect
- Some college players never made NBA
- Junior college transfers may not match
- International players may have name variations

---

## 📈 Expected Results

### Typical Output Sizes:
- **College records**: 8,000-12,000 player-seasons
- **Unique players**: 5,000-7,000 players
- **NBA matches**: 800-1,200 players (~15-20% match rate)

### Data Quality:
- ✅ Major conference players: >95% coverage
- ✅ High-major draft prospects: >98% coverage
- ⚠️ Mid-major players: 70-80% coverage
- ⚠️ Low-major players: 50-60% coverage

---

## 🔄 Updating Data

To update with current season data:

```bash
# Update END_YEAR in fetch_college_data.py
END_YEAR = 2025  # Current season

# Re-run the pipeline
python run_all.py
```

**Note**: Only need to re-run if:
- Current season progresses
- Want to add more historical years
- Need to refresh NBA career stats

---

## 💡 Tips & Best Practices

1. **Run overnight**: Full collection takes 30-60 minutes
2. **Save your API key**: Add to `~/.zshrc` for persistence
3. **Check summary first**: Review `collection_summary.json` before building algorithm
4. **Backup data**: Copy `../data/` folder after successful run
5. **Version control**: Don't commit data files (too large), only scripts

---

## 📞 Need Help?

**Common issues:**
- API errors → Check your key is valid
- Import errors → Activate venv and reinstall packages
- No matches → Names may not match exactly (this is normal for ~20%)

**Ask Claude for help with:**
- Modifying filters
- Adding new data sources
- Fixing name matching
- Optimizing performance

---

## ✅ Next Steps

Once data collection is complete:

1. **Review the summary** (`../data/collection_summary.json`)
2. **Check data quality** (review sample records)
3. **Move to Day 3**: Build the comparison algorithm
4. **Start frontend**: Create dashboard UI

---

**Happy data collecting! 🏀📊**
