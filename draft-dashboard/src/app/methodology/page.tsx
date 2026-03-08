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
              ['#overall',     'Step 4 — Overall (blended) similarity + facet floor'],
              ['#similarity',  'Step 5 — Distance → similarity score'],
              ['#derived',     'Derived stats (TS%, AST/TOV, 3P% vs FT rate)'],
              ['#statboxes',   'Profile stat box shading'],
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
            (2005–2024) who subsequently entered the NBA draft or played in the NBA.
            Three separate &ldquo;lenses&rdquo; produce three independent best matches:
          </p>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            {[
              { color: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Statistical', desc: 'Who produced most similarly on the court? Per-36 stats + efficiency rates. No physical data used.' },
              { color: 'bg-purple-50 border-purple-200 text-purple-800', label: 'Physical', desc: 'Who shared the most similar size profile? Only considers historical players with measured height/weight.' },
              { color: 'bg-green-50 border-green-200 text-green-800', label: 'Overall', desc: '70% stat + 25% physical + 5% age. Searched by maximising blended similarity — not by minimising blended distance.' },
            ].map(c => (
              <div key={c.label} className={`rounded-lg border p-4 ${c.color}`}>
                <p className="font-bold text-lg mb-1">{c.label}</p>
                <p className="text-sm">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            The overall lens is restricted to historical players who <em>also</em> have
            physical data. Without this restriction the overall winner is almost always
            identical to the statistical winner.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="normalise" title="Step 1 — Z-score normalisation">
          <p className="text-gray-700 mb-3">
            Raw stat values aren&apos;t comparable across dimensions.
            Every stat is standardised to a z-score before any distance is computed:
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
            <li>true_shooting_pct, usage_rate, free_throw_rate, three_point_pct</li>
            <li>ast_tov_ratio, oreb_pct, win_shares_per40, net_rating</li>
            <li>height_inches, weight_pounds, age_at_season_start</li>
          </ul>
          <p className="text-sm text-gray-500 mt-2">
            Note: <code>age_at_season_start</code> norms are used only in the overall blend
            (step 4), not in the statistical distance calculation.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="stats" title="Step 2 — Statistical distance">
          <p className="text-gray-700 mb-4">
            Stats are grouped into five <em>basketball-analytics facets</em>. Each facet is a
            Euclidean distance (or absolute difference) of z-score values, then the five facets
            are combined with an analytics-informed weighted sum. Defence and rebounding are
            weighted higher than in earlier versions because they are the strongest positional
            discriminators — a guard and a centre can have similar scoring profiles but radically
            different defensive footprints.
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
                  weight="25 %"
                  fields={['TS%', 'Usage', 'FT rate', '3P%']}
                  note="√(Δts² + Δusage² + Δftr² + Δ3p%²)"
                />
                <WeightRow
                  facet="Scoring Volume"
                  weight="16 %"
                  fields={['Pts/36']}
                  note="|Δpts36|"
                />
                <WeightRow
                  facet="Playmaking"
                  weight="20 %"
                  fields={['Ast/36', 'AST/TOV', 'TOV/36']}
                  note="√(Δast² + Δast_tov² + Δtov²)"
                />
                <WeightRow
                  facet="Rebounding"
                  weight="19 %"
                  fields={['Reb/36', 'OReb%']}
                  note="√(Δreb² + Δoreb_pct²)"
                />
                <WeightRow
                  facet="Defense"
                  weight="20 %"
                  fields={['Stl/36', 'Blk/36']}
                  note="√(Δstl² + Δblk²)"
                />
              </tbody>
            </table>
          </div>

          <Formula>{`stat_distance = 0.25 × eff_dist
             + 0.16 × vol_dist
             + 0.20 × play_dist
             + 0.19 × reb_dist
             + 0.20 × def_dist`}</Formula>

          <Sub title="Facet detail">
            <Formula>{`eff_dist  = √( Δts_pct² + Δusage² + Δft_rate² + Δthree_pct² )
vol_dist  = |Δpts_per36|
play_dist = √( Δast36² + Δast_tov² + Δtov36² )
reb_dist  = √( Δreb36² + Δoreb_pct² )
def_dist  = √( Δstl36² + Δblk36² )`}</Formula>
            <p className="text-sm text-gray-600">
              All Δ values are z-score differences (prospect z − historical z).
              A lower total = more similar statistical profile.
            </p>
          </Sub>

          <Sub title="Scoring profile: 3P% vs FT rate">
            <p className="text-sm text-gray-600">
              Inside vs outside scoring is captured through two complementary signals in
              the scoring efficiency facet:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 ml-2 mt-2">
              <li><strong>FT rate</strong> (FTA/FGA) — high FT rate flags an inside scorer who draws
                contact. A paint-oriented player will typically show FT rate 40–60 %; a
                perimeter player 20–35 %.</li>
              <li><strong>3P%</strong> — distinguishes a genuine perimeter shooter from a player
                who rarely attempts threes. This replaced the previously dead
                <code> three_pt_attempts_per_game</code> field (was 0 for all players because
                the CBBD API only returns aggregate 3P%, not attempt counts).</li>
            </ul>
            <p className="text-sm text-gray-600 mt-2">
              Together with TS% (overall shooting efficiency) and usage rate, these four
              metrics paint a clear inside/outside scoring profile for each player.
            </p>
          </Sub>

          <Sub title="Why these weights?">
            <p className="text-sm text-gray-600">
              Defense (20 %) and rebounding (19 %) are weighted highest alongside
              scoring efficiency (25 %) because steal/block rates and reb/36 are
              the strongest positional discriminators at the college level — an
              athletic wing who doesn&apos;t block shots matches very differently
              from a rim protector, even if their scoring lines look similar.
              Playmaking (20 %) is high because AST/TOV ratio is strongly predictive
              of guard/wing scouting grades. Scoring volume (16 %) is deliberately
              lower than efficiency — raw PPG is context-dependent (team pace,
              touches, role).
            </p>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="physical" title="Step 3 — Physical distance">
          <p className="text-gray-700 mb-3">
            Physical comparison is only computed when the prospect <em>and</em> the historical
            player both have measured data. Otherwise the physical distance is treated as
            unavailable (not zero).
          </p>

          <Sub title="Without wingspan">
            <Formula>{`phys_dist = √( 0.55 × Δheight² + 0.45 × Δweight² )`}</Formula>
            <p className="text-sm text-gray-600">
              Height weighted slightly more than weight because positional fit
              (guard / wing / big) is height-determined more than weight.
            </p>
          </Sub>

          <Sub title="With wingspan (NBA Draft Combine)">
            <Formula>{`phys_dist = √( 0.40 × Δheight² + 0.30 × Δweight² + 0.20 × Δwingspan² )`}</Formula>
            <p className="text-sm text-gray-600">
              Wingspan z-scores use the height norm (both are length measurements on
              the same scale). Wingspan data comes from the NBA Draft Combine API
              (<code>stats.nba.com/stats/draftcombinestats</code>) and covers
              drafted players from 2001–2024. Run{' '}
              <code>scripts/fetch_nba_data.py</code> to populate this field.
            </p>
          </Sub>

          <Sub title="Age as a tiebreaker (overall lens only)">
            <p className="text-sm text-gray-600">
              Age at the time of the college season is used as a 5 % contribution
              in the overall blend (Step 4). A prospect who was 19 in college
              compares more fairly against other 19-year-old college players than
              against 22-year-old seniors, even if the raw stats look similar.
              Age is <em>not</em> included in the pure statistical distance.
            </p>
          </Sub>

          <Sub title="Current physical data coverage">
            <div className="flex flex-wrap gap-2 text-sm">
              <Pill color="bg-green-100 text-green-800">~2,100 historical players have height + weight (≈30 %)</Pill>
              <Pill color="bg-yellow-100 text-yellow-800">~4,700 undrafted historical players have no measurements</Pill>
              <Pill color="bg-purple-100 text-purple-800">All 2026 prospects have ESPN roster measurements</Pill>
              <Pill color="bg-blue-100 text-blue-800">Wingspan: 2001–2024 drafted players via NBA Draft Combine</Pill>
            </div>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="overall" title="Step 4 — Overall (blended) similarity">
          <p className="text-gray-700 mb-3">
            The overall lens blends three similarity scores <em>after</em> applying exponential
            decay to each dimension independently. This is fundamentally different from blending
            raw distances, and produces more balanced results:
          </p>
          <Formula>{`overall_sim = 0.70 × stat_sim + 0.25 × phys_sim + 0.05 × age_sim

stat_sim = 100 × e^(−stat_dist / 3.0)      (statistical similarity)
phys_sim = 100 × e^(−phys_dist / 1.5)      (physical similarity)
age_sim  = 100 × e^(−age_dist  / 1.5)      (age similarity)

age_dist = |z_age_prospect − z_age_historical|   (absolute z-score gap)
         = 0 / neutral when either player is missing age data`}</Formula>

          <p className="text-sm text-gray-600 mb-3">
            <strong>Why similarity-based blending?</strong>{' '}
            Blending raw distances (the previous approach) allowed a player who was
            physically near-identical to the prospect to win the overall slot even
            when their statistical profile was substantially different — because a
            very small physical distance (near zero) could pull the combined distance
            below a statistically-better match. Blending similarity scores applies
            exponential decay to each dimension first, so no single dimension
            can produce an outsized advantage.
          </p>

          <p className="text-sm text-gray-600">
            <strong>Search method:</strong> the overall winner is the historical player
            with the <em>highest</em> <code>overall_sim</code> (not lowest combined distance).
          </p>

          <p className="text-sm text-gray-600 mt-2">
            <strong>Fallback:</strong> if the prospect has no physical data, overall falls
            back to statistical-only across the full pool.
            If age data is missing for either player, <code>age_sim</code> defaults
            to 100 (no penalty) and the weights redistribute to 70/30.
          </p>

          <Sub title="Minimum facet floor constraint">
            <p className="text-sm text-gray-600 mb-2">
              Before selecting the overall winner, candidates where <em>any single facet</em>{' '}
              similarity score falls below <strong>50 %</strong> are excluded from consideration.
              A player who is wildly dissimilar in one key dimension (e.g. a rim-protector matched
              to a perimeter scorer on defense) is not a meaningful overall comparable — even if
              their physical profile and other stats look similar.
            </p>
            <Formula>{`FACET_FLOOR = 50   // percent

passesFloor(row) =
  sim(sEff)    ≥ FACET_FLOOR  AND
  sim(sVol, 2) ≥ FACET_FLOOR  AND
  sim(sPlay)   ≥ FACET_FLOOR  AND
  sim(sReb)    ≥ FACET_FLOOR  AND
  sim(sDef)    ≥ FACET_FLOOR

// Fall back to full pool if no candidate passes the floor
// (rare — prevents "no match found" for unusual stat profiles)`}</Formula>
            <p className="text-sm text-gray-600">
              This constraint applies only to the <em>overall</em> lens. Statistical and physical
              comparisons are unrestricted — the best available match is always shown, even if it
              is a loose one.
            </p>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="similarity" title="Step 5 — Distance → similarity score">
          <p className="text-gray-700 mb-3">
            Raw distance is an unbounded, unitless number. We convert it to an intuitive
            0–100 similarity score using a decaying exponential:
          </p>
          <Formula>{`similarity = 100 × e^(−dist / k)

k controls how quickly the score decays with distance.
k = 3.0  →  statistical distance (broad tolerance)
k = 2.0  →  scoring volume sub-component (tighter, raw PPG matters)
k = 1.5  →  physical distance (body profiles are tighter / less variable)
k = 1.5  →  age distance (1 year of age is a meaningful development gap)`}</Formula>
          <p className="text-sm text-gray-600 mb-2">
            A similarity score of 100 means identical profiles.
            Scores above 75 indicate a very strong match; below 45 is a loose comp.
          </p>
          <p className="text-sm text-gray-600">
            The facet breakdown bars (Scoring Eff., Playmaking, etc.) each apply the same
            formula to their own sub-distance so they&apos;re independently interpretable.
            The overall card&apos;s top-line score is the blended similarity (Step 4),
            not a re-applied exponential on a combined distance.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="derived" title="Derived stats — TS%, AST/TOV, 3P%">
          <p className="text-gray-700 mb-3">
            Several stats are computed on load rather than stored raw:
          </p>

          <Sub title="True Shooting % (TS%)">
            <Formula>{`TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100

We don't have raw FGA or FTA, so we back-solve from:
  PTS ≈ 2 × FG% × FGA  +  FT% × FTR × FGA
  (FTR = free_throw_rate = FTA/FGA, stored as e.g. 38.9 → ratio 0.389)

  FGA_est = PTS / (2 × FG% + FT% × FTR)
  FTA_est = FTR × FGA_est
  TS%     = PTS / (2 × (FGA_est + 0.44 × FTA_est)) × 100

Accuracy: ignores the +1 point from 3-pointers in the denominator.
Underestimates TS% for high-volume 3-point shooters by ~1–2 pp.`}</Formula>
          </Sub>

          <Sub title="AST/TOV ratio">
            <Formula>{`ast_tov = assists_per_game / turnovers_per_game
         (0 if turnovers_per_game = 0)`}</Formula>
          </Sub>

          <Sub title="3P% as a scoring-profile signal">
            <p className="text-sm text-gray-600">
              <code>three_point_percentage</code> is used directly in the scoring efficiency
              facet as a perimeter-orientation signal. A player with 0 % from three (never
              attempts them) is strongly differentiated from a 38 % three-point shooter,
              even if their overall FG% is similar. This replaced the previously-stored
              <code> three_pt_attempts_per_game</code> field, which was 0 for every player
              because the CBBD API returns aggregate 3P% but not attempt counts.
            </p>
          </Sub>

          <p className="text-sm text-gray-500 mt-2">
            All derived values are computed in <code>dataLoader.ts → toCollegeStats()</code>
            and apply equally to current prospects and all historical players.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="statboxes" title="Profile stat box shading">
          <p className="text-gray-700 mb-3">
            Each stat box on a player&apos;s profile is coloured using the school&apos;s
            primary colour, with brightness adjusted to reflect how that stat compares to
            same-position peers in the current season:
          </p>
          <Formula>{`brightness_factor = 1.0 − 0.25 × clamp(z, −2.5, +2.5)

z ≥ +2.0  →  factor ≈ 0.50  →  darkened primary (elite)
z =  0.0  →  factor = 1.00  →  primary colour as-is (average)
z ≤ −2.0  →  factor ≈ 1.50  →  lightened toward white (below average)`}</Formula>
          <p className="text-sm text-gray-600 mb-2">
            <strong>Darker = better.</strong>{' '}
            A stat box that is a deep, saturated version of the school colour indicates
            an above-average (or elite) result; a washed-out, pale version indicates
            below-average performance for that position group.
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Text colour is chosen automatically for WCAG accessibility — white text on
            dark backgrounds, dark text on light backgrounds — so every box remains
            legible regardless of school colours or stat level.
          </p>
          <p className="text-sm text-gray-600">
            <strong>Comparison pool:</strong> stats are z-scored against the same position
            group (G / F / C) in the current 2026 prospect season. This means a centre&apos;s
            blocks are compared to other centres, not to guards, giving a more meaningful
            relative reading. The pool falls back to all positions if a group has fewer
            than 20 players.
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="font-semibold text-blue-800 mb-1">Wingspan — NBA Draft Combine (2001–2024)</p>
              <p>
                Wingspan measurements are fetched from{' '}
                <code>stats.nba.com/stats/draftcombinestats</code> during the data pipeline run.
                Coverage is limited to players who attended the official NBA Draft Combine
                (most top-60 picks each year). Undrafted players and international prospects
                who skipped the combine have no wingspan. Re-run{' '}
                <code className="bg-blue-100 px-1 rounded">scripts/fetch_nba_data.py</code> to
                populate the current dataset.
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-semibold text-orange-800 mb-1">Dead fields — 3PA count and OReb%</p>
              <p>
                <code>three_pt_attempts_per_game</code> (per-game 3PA count) is 0 for all
                players — the CBBD API only returns aggregate 3P%, not attempt counts.
                The algorithm now uses <code>three_point_percentage</code> instead, which
                is populated.
                <br />
                <code>oreb_pct</code> is also 0 (requires team rebound totals not available
                in the player endpoint). These slots contribute nothing to the distance
                calculation today.
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="font-semibold text-green-800 mb-1">Undrafted NBA players</p>
              <p>
                Players who entered the NBA as undrafted free agents (e.g., Trendon Watford)
                previously showed 0 career stats because they never appeared in the BBRef
                draft pages. The pipeline now fetches individual BBRef player pages for
                undrafted college players who appear in the BBRef player registry (indicating
                they played in the NBA). Re-run{' '}
                <code className="bg-green-100 px-1 rounded">scripts/fetch_nba_data.py</code> to apply.
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="font-semibold text-purple-800 mb-1">Draft matching failures (e.g. Nique Clifford)</p>
              <p>
                A small number of drafted players show as &quot;Undrafted&quot; because the college
                database (CBBD) uses a different name than Basketball Reference&apos;s draft page
                (e.g. nickname vs. legal name). Fix by adding an entry to{' '}
                <code>DRAFT_NAME_CORRECTIONS</code> in{' '}
                <code className="bg-purple-100 px-1 rounded">scripts/fetch_nba_data.py</code>{' '}
                and re-running the pipeline.
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-semibold text-red-800 mb-1">International prospects</p>
              <p>
                Players who have not played college basketball in a major US conference
                are on the Tankathon board but have no college stats entry and therefore
                no comparison. They appear in the rankings view but clicking them produces
                no profile.
              </p>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="tuning" title="Tuning guide">
          <p className="text-gray-700 mb-4">
            All weights are in <code>draft-dashboard/src/lib/utils/comparison.ts</code>.
          </p>

          <div className="space-y-5">
            <Sub title="Change facet weights (statistical distance)">
              <Formula>{`// statDistance() — const total line
const total = eff * 0.25 + vol * 0.16 + play * 0.20 + reb * 0.19 + def * 0.20;
//                  ^^^^        ^^^^         ^^^^        ^^^^        ^^^^
// Must sum to 1.0  (e.g. emphasise playmaking: play * 0.25, reduce others)`}</Formula>
            </Sub>

            <Sub title="Change the overall blend (stat / physical / age)">
              <Formula>{`// getProspectComparisons() — oSim computation
const oSim = pDist != null
  ? 0.70 * sSim + 0.25 * pSim + 0.05 * ageSim
  : sSim;
//  ^^^^           ^^^^          ^^^^
// Physical useful range: 0.15–0.35.  Age useful range: 0.03–0.10.
// Weights must sum to 1.0 (when physical is available)`}</Formula>
            </Sub>

            <Sub title="Change physical dimension weights">
              <Formula>{`// physDistance() — lines ~130–136
// Without wingspan:
return Math.sqrt(0.55 * sq(h1,h2) + 0.45 * sq(w1,w2));
//               ^^^^                ^^^^
// With wingspan (when both players have it):
return Math.sqrt(0.40 * sq(h1,h2) + 0.30 * sq(w1,w2) + 0.20 * sq(ws1,ws2));`}</Formula>
            </Sub>

            <Sub title="Change age sensitivity">
              <Formula>{`// ageSim in getProspectComparisons()
ageSim = sim(Math.abs(zA - zB), 1.5);
//                               ^^^
// Lower k → age matters more (harsher on age gaps)
// Higher k → age matters less (more forgiving)`}</Formula>
            </Sub>

            <Sub title="Change similarity decay rate (k)">
              <Formula>{`sim(sDist)          // stat similarity:   k = 3.0 (default)
sim(pDist, 1.5)     // physical:           k = 1.5 (tighter)
sim(volDist, 2)     // scoring volume:     k = 2.0
sim(ageDist, 1.5)   // age:                k = 1.5

// Higher k → scores decay slower → more players get high scores
// Lower  k → harsher scale → only near-perfect matches score well`}</Formula>
            </Sub>

            <Sub title="Add a new stat dimension">
              <p className="text-sm text-gray-600 mb-2">
                To incorporate a new stat (e.g. offensive rating once the API provides it):
              </p>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
                <li>Add the field to <code>DatasetNorms</code> in <code>player.ts</code></li>
                <li>Add the field to the <code>StatVec</code> interface</li>
                <li>Add <code>{'zScore(s.offensive_rating, n.net_rating)'}</code> in <code>toStatVec()</code></li>
                <li>Include it in the relevant facet formula in <code>statDistance()</code></li>
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
