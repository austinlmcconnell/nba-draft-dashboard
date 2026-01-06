# 🧮 Player Comparison Algorithm

The core algorithm that matches current prospects to historical NBA players based on their college statistics.

---

## 📊 How It Works

### 1. **Statistical Normalization (Z-Scores)**

All statistics are converted to z-scores to enable fair comparisons across different eras:

```
z-score = (value - mean) / standard_deviation
```

**Why normalize?**
- Compare players from different eras fairly
- Account for pace of play changes
- Handle different scales (PPG vs FG%)

**Example:**
- 2005: Average PPG = 12.3
- 2024: Average PPG = 15.1
- A player scoring 18 PPG in 2005 is more impressive than in 2024

### 2. **Weighted Euclidean Distance**

Calculate similarity using weighted distance across categories:

```typescript
distance = √(
  (scoring_diff × scoring_weight)² +
  (rebounding_diff × rebounding_weight)² +
  (playmaking_diff × playmaking_weight)² +
  (defense_diff × defense_weight)² +
  (physical_diff × physical_weight)²
)
```

**Lower distance = More similar**

### 3. **Similarity Score (0-100)**

Convert distance to an intuitive percentage:

```typescript
similarity = 100 × e^(-distance / 10)
```

- 100% = Perfect match (impossible in practice)
- 80-90% = Extremely similar
- 70-80% = Very similar
- 60-70% = Moderately similar
- <60% = Different players

---

## 🎯 Default Weights

```typescript
{
  scoring: 1.5,      // Most important
  efficiency: 1.3,   // Shooting percentages
  playmaking: 1.2,   // Passing ability
  defense: 1.1,      // Steals and blocks
  rebounding: 1.0,   // Standard weight
  physical: 0.8,     // Least important (size similarities)
}
```

**Why these weights?**
- **Scoring** matters most for NBA projection
- **Physical** matters least (fit can vary by team/system)
- **Efficiency** separates good from great

---

## 📁 File Structure

```
src/lib/utils/
├── normalize.ts              # Statistical normalization
├── comparison.ts             # Main comparison algorithm
└── comparison-examples.ts    # Usage examples

src/types/
└── player.ts                 # TypeScript types
```

---

## 🚀 Basic Usage

### Import

```typescript
import { findSimilarPlayers, buildDatasetStats } from '@/lib/utils/comparison';
import { buildDatasetStats } from '@/lib/utils/normalize';
```

### Step 1: Load Data

```typescript
// Load historical players (with NBA careers)
import historicalData from '@/data/nba_career_stats_lite.json';
const historicalPlayers: HistoricalPlayer[] = historicalData;

// Extract college profiles for normalization
const allCollegePlayers = historicalPlayers.map(h => h.college_profile);
```

### Step 2: Build Dataset Statistics

```typescript
// Calculate mean and std dev for all stats (do this ONCE)
const datasetStats = buildDatasetStats(allCollegePlayers);

// Save this! You'll reuse it for every comparison
```

### Step 3: Find Comparisons

```typescript
// Get a prospect (current player)
const prospect: CollegePlayer = {
  name: 'Cooper Flagg',
  team: 'Duke',
  season: 2025,
  // ... full stats
};

// Find similar players
const matches = findSimilarPlayers(
  prospect,
  historicalPlayers,
  datasetStats,
  {
    topN: 10,                    // Return top 10 matches
    requireSamePosition: false,  // Allow position flexibility
  }
);

// Get just the best match
const bestMatch = matches[0];
```

### Step 4: Display Results

```typescript
matches.forEach((match, index) => {
  console.log(`${index + 1}. ${match.historical_player.name}`);
  console.log(`   Similarity: ${match.similarity_score}%`);
  console.log(`   NBA Career: ${match.historical_player.nba_career.career_ppg} PPG`);
  
  // Category breakdown
  console.log(`   Scoring: ${match.stat_breakdown.scoring_similarity}%`);
  console.log(`   Rebounding: ${match.stat_breakdown.rebounding_similarity}%`);
  // ... etc
});
```

---

## 🎨 Advanced Usage

### Custom Weights

Emphasize different aspects for different player types:

```typescript
// For a pure scorer
const scorerWeights = {
  scoring: 3.0,
  efficiency: 2.5,
  playmaking: 0.5,
  defense: 0.5,
  rebounding: 0.5,
  physical: 0.7,
};

// For a defensive specialist
const defenderWeights = {
  scoring: 0.5,
  efficiency: 0.8,
  playmaking: 0.7,
  defense: 3.0,      // Heavy emphasis!
  rebounding: 1.5,
  physical: 1.2,
};

// Use custom weights
const matches = findSimilarPlayers(prospect, historical, datasetStats, {
  weights: scorerWeights,
  topN: 5,
});
```

### Position Filtering

```typescript
// Only compare to same position
const matches = findSimilarPlayers(prospect, historical, datasetStats, {
  requireSamePosition: true,  // PG only compares to PG
});

// Manual position check
import { arePositionsCompatible } from '@/lib/utils/comparison';

if (arePositionsCompatible('SG', 'SF')) {
  // These positions can be compared
}
```

### Category-Specific Comparisons

```typescript
import { findSimilarByCategory } from '@/lib/utils/comparison';

// Find best shooters
const bestShooters = findSimilarByCategory(
  prospect,
  historical,
  datasetStats,
  'scoring',
  5  // Top 5
);

// Find best passers
const bestPassers = findSimilarByCategory(
  prospect,
  historical,
  datasetStats,
  'playmaking',
  5
);
```

---

## 📈 Understanding Results

### Similarity Scores

| Score | Meaning | Example |
|-------|---------|---------|
| 90-100% | Nearly identical | Rare - only with very similar players |
| 80-90% | Extremely similar | Strong comp (e.g., Tatum → Pierce) |
| 70-80% | Very good match | Solid comp with minor differences |
| 60-70% | Moderate match | Useful reference point |
| <60% | Different styles | Not a meaningful comparison |

### Category Breakdown

Each comparison includes similarity percentages for:

```typescript
{
  scoring_similarity: 85,        // How similar their scoring is
  rebounding_similarity: 72,     // Rebounding comparison
  playmaking_similarity: 68,     // Passing ability
  defense_similarity: 91,        // Defensive stats
  physical_similarity: 95,       // Size and athleticism
  efficiency_similarity: 88,     // Shooting percentages
}
```

**Interpreting:**
- 80-100%: Very similar in this category
- 60-80%: Somewhat similar
- <60%: Different in this category

---

## 🔧 Customization

### Adjust Weights

Edit `DEFAULT_WEIGHTS` in `comparison.ts`:

```typescript
export const DEFAULT_WEIGHTS: ComparisonWeights = {
  scoring: 1.5,      // Increase for scoring emphasis
  rebounding: 1.0,
  playmaking: 1.2,
  defense: 1.1,
  physical: 0.8,
  efficiency: 1.3,
};
```

### Add New Stats

1. Add to `CollegeStats` type in `player.ts`
2. Update normalization in `normalize.ts`
3. Include in distance calculation in `comparison.ts`

Example - Adding "steals per game":
```typescript
// Already included! But here's the pattern:

// 1. Type (player.ts)
export interface CollegeStats {
  // ... existing stats
  steals_per_game: number;
}

// 2. Normalize (normalize.ts)
steals_per_game: calculateZScore(
  stats.steals_per_game,
  datasetStats.steals_per_game
),

// 3. Use in comparison (comparison.ts)
const defenseDist = Math.sqrt(
  Math.pow(prospect.steals_per_game - historical.steals_per_game, 2) +
  // ... other defensive stats
) * weights.defense;
```

---

## 🧪 Testing

### Quick Test

```typescript
// Run the example file
import { exampleFindSimilarPlayers } from '@/lib/utils/comparison-examples';

exampleFindSimilarPlayers();
```

### Validate Results

```typescript
// Check known comparisons
const zionType = {
  name: 'Zion Williamson',
  // ... Zion's college stats
};

const matches = findSimilarPlayers(zionType, historical, datasetStats);

// Should find: Blake Griffin, Charles Barkley, Julius Randle
console.log(matches[0].historical_player.name);
// Expected: High similarity to other athletic, scoring bigs
```

---

## 💡 Tips & Best Practices

### Performance

**Do:**
- ✅ Build `datasetStats` once and reuse
- ✅ Cache comparison results
- ✅ Limit `topN` to 10-20 for UI display

**Don't:**
- ❌ Rebuild `datasetStats` for every comparison
- ❌ Return all matches (use `topN`)
- ❌ Run comparisons on every keystroke (debounce search)

### Accuracy

**Do:**
- ✅ Filter historical players by minimum games played
- ✅ Use position filtering for guards/wings/bigs
- ✅ Consider era adjustments (pace, 3-point line)

**Don't:**
- ❌ Compare players with <15 games
- ❌ Compare point guards to centers
- ❌ Rely solely on similarity score (check breakdown)

### UI Display

**Show:**
- ✅ Top 3-5 matches by default
- ✅ Similarity score and category breakdown
- ✅ NBA career stats for context
- ✅ College team and season

**Consider:**
- 💡 Radar charts for visual comparison
- 💡 "Alternative comps" with different weights
- 💡 Historical context (draft position, team success)

---

## 🔮 Future Enhancements

Potential improvements:

1. **Machine Learning**: Train a model to learn optimal weights
2. **Advanced Metrics**: Include BPM, VORP, Win Shares
3. **Play Style Tags**: "Shooter", "Slasher", "Facilitator"
4. **Team Context**: Adjust for teammates' strength
5. **Trajectory Prediction**: Predict NBA career arc
6. **Multi-Season**: Compare sophomore vs freshman years

---

## 📚 References

**Statistical Methods:**
- Basketball Reference similarity scores
- Kevin Pelton's WARP system
- FiveThirtyEight's CARMELO projections

**Academic:**
- Euclidean distance in multi-dimensional space
- Z-score normalization
- Weighted similarity measures

---

**Ready to use the algorithm in your dashboard!** 🎉

Next steps:
1. Load your data files
2. Build the UI components
3. Display comparisons beautifully
