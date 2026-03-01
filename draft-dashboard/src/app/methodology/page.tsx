/**
 * /methodology — Explains the comparison algorithm in full detail,
 * with precise weights, formulas, and tuning notes.
 */
import React from 'react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14">
      <h2 className="text-2xl font-bold text-gray-900 mb-5 pb-2 border-b border-gray-200">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-gray-950 text-green-300 text-sm rounded-lg px-5 py-4 overflow-x-auto font-mono leading-relaxed my-3">
      {children}
    </pre>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

function WeightRow({ facet, weight, fields, note }: {
  facet: string; weight: string; fields: string[]; note?: string
}) {
  return (
    <tr className="border-t border-gray-100">
      <td className="py-3 pr-4 font-semibold text-gray-800 whitespace-nowrap">{facet}</td>
      <td className="py-3 pr-6">
        <span className="font-mono text-blue-700 font-bold">{weight}</span>
      </td>
      <td className="py-3 pr-4 text-sm text-gray-600">{fields.join(', ')}</td>
      {note && <td className="py-3 text-sm text-gray-500 italic">{note}</td>}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link href="/" className="text-sm text-blue-600 hover:underline mb-1 inline-block">
                ← Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Comparison Methodology</h1>
              <p className="mt-1 text-gray-600 text-sm">
                Exact formulas, weights, and tuning knobs behind the player-comparison engine
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* TOC */}
        <nav className="mb-12 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contents</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-700">
            {[
              ['#overview',    'Overview — three comparison lenses'],
              ['#normalise',   'Step 1 — Z-score normalisation'],
              ['#stats',       'Step 2 — Statistical distance'],
              ['#physical',    'Step 3 — Physical distance'],
              ['#overall',     'Step 4 — Overall (blended) distance'],
              ['#similarity',  'Step 5 — Distance → similarity score'],
              ['#derived',     'Derived stats (TS%, AST/TOV)'],
              ['#coverage',    'Data coverage & known gaps'],
              ['#tuning',      'Tuning guide'],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:underline">{label}</a></li>
            ))}
          </ol>
        </nav>

        {/* ---------------------------------------------------------------- */}
        <Section id="overview" title="Overview — three comparison lenses">
          <p className="text-gray-700 mb-4">
            Every prospect is compared against a pool of ~6,800 historical college players
            (2005–2024) who subsequently entered the NBA draft. Three separate &ldquo;lenses&rdquo;
            produce three independent best matches:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {[
              { color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Statistical', desc: 'Who produced most similarly on the court? Per-36 stats + efficiency, no physical data.' },
              { color: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Physical', desc: 'Who shared the most similar size profile? Only considers historical players with measurements.' },
              { color: 'bg-green-50 border-green-200 text-green-800', label: 'Overall', desc: '65 % statistical + 35 % physical. Restricted to players who have both stat and physical data.' },
            ].map(c => (
              <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
                <p className="font-bold text-lg mb-1">{c.label}</p>
                <p className="text-sm">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            The overall lens is explicitly restricted to historical players who <em>also</em> have
            physical data. Without this restriction the overall winner is almost always identical
            to the statistical winner (because unmeasured players all have a physical distance of 0,
            dominating the sorted list).
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="normalise" title="Step 1 — Z-score normalisation">
          <p className="text-gray-700 mb-3">
            Raw stat values aren&apos;t comparable (e.g. rebounds/36 live on a different scale than
            usage rate). Every stat dimension is standardised to a z-score before any distance is
            computed:
          </p>
          <Formula>{`z(x) = (x − μ) / σ

μ  = mean of that stat across ALL historical players in the pool
σ  = standard deviation (if σ = 0, z = 0 to avoid division by zero)
`}</Formula>
          <p className="text-gray-700 mb-2">
            Norms are computed once at page load from the full historical dataset
            (<code>buildDatasetNorms()</code> in <code>comparison.ts</code>). They include:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2">
            <li>pts_per36, reb_per36, ast_per36, stl_per36, blk_per36, tov_per36</li>
            <li>true_shooting_pct, usage_rate, free_throw_rate, three_pt_attempts_per_game</li>
            <li>ast_tov_ratio, oreb_pct, win_shares_per40, net_rating</li>
            <li>height_inches, weight_pounds (physical norms — used for wingspan z-score too)</li>
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="stats" title="Step 2 — Statistical distance">
          <p className="text-gray-700 mb-4">
            Stats are grouped into five <em>basketball-analytics facets</em>. Each facet is a
            Euclidean distance (square root of sum of squared z-score differences) or absolute
            difference, then the five facets are combined with an analytics-informed weighted sum.
          </p>

          <div className="overflow-x-auto mb-5">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  <th className="pb-2 pr-4">Facet</th>
                  <th className="pb-2 pr-6">Weight</th>
                  <th className="pb-2 pr-4">Inputs</th>
                  <th className="pb-2">Distance formula</th>
                </tr>
              </thead>
              <tbody>
                <WeightRow
                  facet="Scoring Efficiency"
                  weight="28 %"
                  fields={['TS%', 'Usage', 'FT rate', '3PA rate']}
                  note="√(Δts² + Δusage² + Δftr² + Δ3pa²)"
                />
                <WeightRow
                  facet="Scoring Volume"
                  weight="18 %"
                  fields={['Pts/36']}
                  note="|Δpts36|"
                />
                <WeightRow
                  facet="Playmaking"
                  weight="22 %"
                  fields={['Ast/36', 'AST/TOV', 'TOV/36']}
                  note="√(Δast² + Δast_tov² + Δtov²)"
                />
                <WeightRow
                  facet="Rebounding"
                  weight="16 %"
                  fields={['Reb/36', 'OReb%']}
                  note="√(Δreb² + Δoreb_pct²)"
                />
                <WeightRow
                  facet="Defense"
                  weight="16 %"
                  fields={['Stl/36', 'Blk/36']}
                  note="√(Δstl² + Δblk²)"
                />
              </tbody>
            </table>
          </div>

          <Formula>{`stat_distance = 0.28 × eff_dist
             + 0.18 × vol_dist
             + 0.22 × play_dist
             + 0.16 × reb_dist
             + 0.16 × def_dist`}</Formula>

          <Sub title="Facet detail">
            <Formula>{`eff_dist  = √( Δts_pct² + Δusage² + Δft_rate² + Δthree_rate² )
vol_dist  = |Δpts_per36|
play_dist = √( Δast36² + Δast_tov² + Δtov36² )
reb_dist  = √( Δreb36² + Δoreb_pct² )
def_dist  = √( Δstl36² + Δblk36² )`}</Formula>
            <p className="text-sm text-gray-600">
              All Δ values are z-score differences (prospect z − historical z).
              A lower total = more similar statistical profile.
            </p>
          </Sub>

          <Sub title="Why these weights?">
            <p className="text-sm text-gray-600">
              Scoring efficiency (28 %) is weighted highest because TS% + usage captures
              both how often a player scores and how efficiently — the single strongest
              predictor of NBA role. Playmaking (22 %) is second because AST/TOV ratio
              is highly predictive of guard/wing scouting grades. Scoring volume (18 %)
              is deliberately below efficiency — raw PPG is context-dependent.
              Rebounding (16 %) and defense (16 %) round out the profile; steal/block
              rates at the college level are noisy but still position-discriminating.
            </p>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="physical" title="Step 3 — Physical distance">
          <p className="text-gray-700 mb-3">
            Physical comparison is only computed when the prospect <em>and</em> the historical
            player both have measured data. Otherwise the physical distance is treated as
            unavailable (not zero — so it doesn&apos;t pollute the overall ranking).
          </p>

          <Sub title="Without wingspan">
            <Formula>{`phys_dist = √( 0.55 × Δheight² + 0.45 × Δweight² )`}</Formula>
            <p className="text-sm text-gray-600">
              Height weighted slightly more than weight because positional fit
              (guard / wing / big) is height-determined more than weight.
            </p>
          </Sub>

          <Sub title="With wingspan (when available)">
            <Formula>{`phys_dist = √( 0.40 × Δheight² + 0.30 × Δweight² + 0.20 × Δwingspan² )`}</Formula>
            <p className="text-sm text-gray-600">
              Wingspan z-scores use the height norm (both are length measurements on
              the same scale). Note: no historical player currently has wingspan in the
              dataset — see the coverage section.
            </p>
          </Sub>

          <Sub title="Current physical data coverage">
            <div className="flex flex-wrap gap-2 text-sm">
              <Pill color="bg-green-100 text-green-800">~2,100 historical players have height + weight (≈30 %)</Pill>
              <Pill color="bg-yellow-100 text-yellow-800">~4,700 undrafted historical players have no measurements</Pill>
              <Pill color="bg-purple-100 text-purple-800">All 2026 prospects have ESPN roster measurements</Pill>
              <Pill color="bg-red-100 text-red-800">0 players have wingspan — data source not yet available</Pill>
            </div>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="overall" title="Step 4 — Overall (blended) distance">
          <p className="text-gray-700 mb-3">
            The overall lens blends statistical and physical distances:
          </p>
          <Formula>{`overall_dist = 0.65 × stat_dist + 0.35 × phys_dist`}</Formula>
          <p className="text-sm text-gray-600 mb-3">
            The search is restricted to historical players with physical data when the prospect
            has physical data. This ensures the overall winner is genuinely different from the
            statistical winner rather than collapsing into the same result.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Fallback:</strong> if the prospect has no physical data, overall falls
            back to statistical-only (same as stat_dist) across the full pool.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="similarity" title="Step 5 — Distance → similarity score">
          <p className="text-gray-700 mb-3">
            Raw distance is an unbounded, unitless number. We convert it to an intuitive
            0–100 similarity score using a decaying exponential:
          </p>
          <Formula>{`similarity = 100 × e^(−dist / k)

k controls how quickly the score decays with distance.
k = 3.0  →  used for statistical and overall distances
k = 2.0  →  used for scoring volume sub-component (tighter scale)
k = 1.5  →  used for physical distance (physical profiles are tighter)`}</Formula>
          <p className="text-sm text-gray-600 mb-2">
            A similarity score of 100 means identical profiles.
            Scores above 75 indicate a very strong match; below 45 is a loose comp.
          </p>
          <p className="text-sm text-gray-600">
            The facet breakdown bars (Scoring Eff., Playmaking, etc.) each convert their own
            sub-distance using the same formula with the facet-specific k so they&apos;re
            comparable within a card but not directly to the overall score.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="derived" title="Derived stats — TS% and AST/TOV">
          <p className="text-gray-700 mb-3">
            The CollegeBasketballData API does not return <code>trueShootingPct</code> or
            <code> assistsTurnoverRatio</code> — both are stored as 0 in the raw data for
            all players (current and historical). The dashboard derives them on load:
          </p>

          <Sub title="True Shooting % (TS%)">
            <Formula>{`TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100

We don't have raw FGA or FTA per game, so we back-solve from:
  PTS ≈ 2 × FG% × FGA  +  FT% × FTR × FGA
  (FTR = free_throw_rate = FTA/FGA stored as e.g. 38.9 → ratio 0.389)

  FGA_est = PTS / (2 × FG% + FT% × FTR)
  FTA_est = FTR × FGA_est
  TS%     = PTS / (2 × (FGA_est + 0.44 × FTA_est)) × 100

Accuracy note: this ignores the extra point from 3-pointers in the
denominator (no 3PA data). The resulting TS% slightly underestimates
true TS% for high-volume 3-point shooters (~1–2 pp off).`}</Formula>
          </Sub>

          <Sub title="AST/TOV ratio">
            <Formula>{`ast_tov = assists_per_game / turnovers_per_game
         (0 if turnovers_per_game = 0)`}</Formula>
          </Sub>

          <p className="text-sm text-gray-500">
            Both derived values are computed in <code>dataLoader.ts → toCollegeStats()</code>
            and apply equally to current prospects and all historical players.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="coverage" title="Data coverage & known gaps">
          <div className="space-y-4 text-sm text-gray-700">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="font-semibold text-yellow-800 mb-1">Historical physical data (30 % coverage)</p>
              <p>
                Of ~6,800 historical players, only ~2,100 (mostly drafted 2005–2024) have
                height/weight from Basketball Reference. The remaining ~4,700 are undrafted
                players who never appeared in the NBA player index.
                Run <code className="bg-yellow-100 px-1 rounded">scripts/enrich_historical_physical.py</code> to
                fill in measurements from ESPN&apos;s historical college roster API (no auth required).
                Expected to increase coverage to 60–80 %.
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-semibold text-orange-800 mb-1">Wingspan — not yet available</p>
              <p>
                Wingspan data appears in the physical comparison formula but no player in the
                database currently has it. The NBA Draft Combine publishes wingspan measurements
                each May. International prospects (Tankathon ranks 22, 35, 44, 69, 82, etc.)
                have no college database entry and are excluded from all comparisons.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-1">Dead fields — 3PA and OReb%</p>
              <p>
                <code>three_pt_attempts_per_game</code> is 0 for all players (CBBD API returns
                aggregate 3P% but not attempt counts). <code>oreb_pct</code> is also 0 (requires
                team rebound totals not available in the player endpoint). These slots contribute
                nothing to the distance calculation today — the algorithm is effectively running
                without them. Fixing either would require enrichment from a second data source.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-800 mb-1">International prospects</p>
              <p>
                Players who have not played college basketball in a major US conference
                (e.g. Karim López / New Zealand, Sergio de Larrea / Valencia,
                Mouhamed Faye / Reggio Emilia) are on the Tankathon board but have no
                college stats entry and therefore no comparison. They appear in the rankings
                view but clicking them produces no profile.
              </p>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="tuning" title="Tuning guide">
          <p className="text-gray-700 mb-4">
            All weights are in <code>draft-dashboard/src/lib/utils/comparison.ts</code>.
            Here are the specific lines to change for common adjustments:
          </p>

          <div className="space-y-5">
            <Sub title="Change facet weights (statistical distance)">
              <Formula>{`// statDistance() — line ~115
const total = eff * 0.28 + vol * 0.18 + play * 0.22 + reb * 0.16 + def * 0.16;
//                  ^^^^        ^^^^         ^^^^        ^^^^        ^^^^
// Must sum to 1.0  (e.g. emphasise defense: def * 0.25, reduce others)`}</Formula>
            </Sub>

            <Sub title="Change physical weighting in overall blend">
              <Formula>{`// getProspectComparisons() — line ~177
const oDist = pDist != null ? s.total * 0.65 + pDist * 0.35 : s.total;
//                                      ^^^^            ^^^^
// Higher pDist weight = physical matters more in overall comp
// Typical useful range: 0.20–0.50`}</Formula>
            </Sub>

            <Sub title="Change physical dimension weights">
              <Formula>{`// physDistance() — lines ~130–136
// Without wingspan:
return Math.sqrt(0.55 * sq(h1,h2) + 0.45 * sq(w1,w2));
//               ^^^^                ^^^^
// With wingspan:
return Math.sqrt(0.40 * sq(h1,h2) + 0.30 * sq(w1,w2) + 0.20 * sq(ws1,ws2));`}</Formula>
            </Sub>

            <Sub title="Change similarity decay rate (k)">
              <Formula>{`// sim() is called with different k values per use case
sim(sDist)          // stat / overall:  k = 3.0 (default)
sim(pDist, 1.5)     // physical:        k = 1.5 (tighter)
sim(volDist, 2)     // scoring volume:  k = 2.0

// Higher k  → scores decay slower → more players get high scores
// Lower  k  → harsher scale → only near-perfect matches score well`}</Formula>
            </Sub>

            <Sub title="Add a new stat dimension">
              <p className="text-sm text-gray-600 mb-2">
                To incorporate a new stat (e.g. offensive rating once the API provides it):
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                <li>Add the field to <code>StatVec</code> interface</li>
                <li>Add <code>{'zScore(s.offensive_rating, n.net_rating)'}</code> in <code>toStatVec()</code></li>
                <li>Include it in the relevant facet distance formula in <code>statDistance()</code></li>
                <li>Add its norm computation in <code>buildDatasetNorms()</code></li>
              </ol>
            </Sub>
          </div>
        </Section>

      </main>

      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-5 text-center text-sm text-gray-500">
          Comparison engine in <code>src/lib/utils/comparison.ts</code> ·
          Data loader in <code>src/lib/utils/dataLoader.ts</code>
        </div>
      </footer>
    </div>
  );
}
