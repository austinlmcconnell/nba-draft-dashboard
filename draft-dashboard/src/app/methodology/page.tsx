/**
 * /methodology — Explains the comparison algorithms powering both the
 * prospect profiles and the Draft Board ranking.
 */
import React from 'react';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14">
      <h2 className="text-2xl font-bold text-[#f9fafb] mb-5 pb-2 border-b border-[#1f2937]">{title}</h2>
      {children}
    </section>
  );
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-[#d1d5db] mb-2">{title}</h3>
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

function WeightRow({ facet, weight, fields, note }: {
  facet: string; weight: string; fields: string[]; note?: string
}) {
  return (
    <tr className="border-t border-[#1f2937]">
      <td className="py-3 pr-4 font-semibold text-[#d1d5db] whitespace-nowrap">{facet}</td>
      <td className="py-3 pr-6">
        <span className="font-mono text-[#4ade80] font-bold">{weight}</span>
      </td>
      <td className="py-3 pr-4 text-sm text-[#9ca3af]">{fields.join(', ')}</td>
      {note && <td className="py-3 text-sm text-[#6b7280] italic">{note}</td>}
    </tr>
  );
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">

      <div className="bg-[#111827] border-b border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">Documentation</p>
          <h1 className="text-3xl sm:text-4xl font-black text-[#f9fafb]">Methodology</h1>
          <p className="mt-2 text-[#9ca3af] text-sm">
            How the Draft Board ranks prospects and how the comparison engine finds their historical matches
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* TOC */}
        <nav className="mb-12 cb-panel p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">Contents</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#9ca3af]">
            {[
              ['#draftboard',  'Draft Board ranking — BPM-weighted comps'],
              ['#bpm',         'BPM explained'],
              ['#pool',        'Comparison pool (drafted players only)'],
              ['#normalise',   'Z-score normalisation'],
              ['#stats',       'Statistical distance — five facets'],
              ['#sort',        'Ranking the comps'],
              ['#similarity',  'Distance → similarity score'],
              ['#derived',     'Derived stats (AST/TOV, ORB/36, DRB/36)'],
              ['#statboxes',   'Profile stat box shading'],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:text-[#4ade80] hover:underline transition-colors">{label}</a></li>
            ))}
          </ol>
        </nav>

        {/* ---------------------------------------------------------------- */}
        <Section id="draftboard" title="Draft Board ranking — BPM-weighted comps">
          <p className="text-[#d1d5db] mb-4">
            The Draft Board ranks every prospect on the Big Board by the{' '}
            <strong>average career BPM</strong> of their 10 closest historical college
            statistical comparisons. The intuition: if a prospect&apos;s college production
            most resembles 10 historical players who became high-impact NBA pros,
            that&apos;s a much stronger signal than if they resemble 10 journeymen.
          </p>

          <Formula>{`For each Big Board prospect:
  1. Find 10 closest college statistical comps
     (restricted to drafted players who have BPM data)
  2. Look up each comp's career BPM (Basketball Reference dataset)
  3. avg_bpm = mean(comp.career_bpm for comp in 10)
  4. Rank the board by avg_bpm descending`}</Formula>

          <p className="text-[#d1d5db] mt-4">
            Higher avg BPM = prospect resembles historical players who had more
            NBA impact per 100 possessions. A +4 avg means their 10 comps averaged
            All-Star-level impact; a −1 avg means they averaged below replacement level.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="bpm" title="BPM explained">
          <p className="text-[#d1d5db] mb-4">
            BPM (Box Plus-Minus) is Basketball Reference&apos;s impact metric, expressed
            as points above average per 100 possessions. It estimates a player&apos;s
            contribution using box-score statistics and team performance context,
            without requiring play-by-play or tracking data.
          </p>

          <Sub title="Career BPM used here">
            <Formula>{`career_bpm = Σ(season_bpm × minutes_played)
              / Σ(minutes_played)

Regular-season games only. Playoffs excluded.
Source: Basketball Reference per-season advanced stats (2005–06 through present).
Built by scripts/build_bpm_lookup.py — runs against all 20 seasons and recomputes
whenever re-run.`}</Formula>
            <p className="text-sm text-[#9ca3af]">
              Weighting by minutes played ensures a single breakout season doesn&apos;t
              distort a long career, and brief stints don&apos;t weigh as heavily as
              full seasons of regular starter minutes.
            </p>
          </Sub>

          <Sub title="Scale">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {[
                { range: '≥ +4.0', label: 'Elite / All-Star',    cls: 'text-emerald-400' },
                { range: '+1.5',   label: 'Solid Starter',       cls: 'text-[#4ade80]' },
                { range: '0',      label: 'Average',             cls: 'text-[#9ca3af]' },
                { range: '−2',     label: 'Below Average',       cls: 'text-amber-400' },
                { range: '< −2',   label: 'Replacement Level',   cls: 'text-red-400' },
              ].map(({ range, label, cls }) => (
                <div key={range} className="p-3 bg-[#0d1117] rounded-lg border border-[#1f2937]">
                  <p className={`text-sm font-black ${cls}`}>{range}</p>
                  <p className="text-[10px] text-[#4b5563] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="pool" title="Comparison pool — drafted players only">
          <p className="text-[#d1d5db] mb-3">
            The historical comparison pool is restricted to players who were
            <strong> drafted to the NBA</strong> and have career RAPTOR data. This ensures
            every comparison represents a player with meaningful NBA exposure — and a
            real RAPTOR score to contribute to the prospect&apos;s avg RAPTOR ranking.
          </p>
          <Formula>{`pool = historical_players WHERE
         draft_pick IS NOT NULL
         AND normalized_name IN bpm_lookup
         AND college_season < 2026`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            Position groups (G / F / C, plus hybrid G-F and F-C) further restrict the pool
            so guards are compared against guards, forwards against forwards, etc.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="normalise" title="Z-score normalisation">
          <p className="text-[#d1d5db] mb-3">
            Raw stat values aren&apos;t comparable across dimensions.
            Every stat is standardised to a z-score before any distance is computed:
          </p>
          <Formula>{`z(x) = (x − μ) / σ

μ  = mean of that stat across ALL historical players in the pool
σ  = standard deviation (if σ = 0, z = 0 to avoid division by zero)`}</Formula>
          <p className="text-[#d1d5db] mb-2">
            Norms are computed once at page load from the full historical dataset
            (<code>buildDatasetNorms()</code> in <code>comparison.ts</code>). They include:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2">
            <li>pts_per36, reb_per36, ast_per36, stl_per36, blk_per36, tov_per36</li>
            <li>orb_per36, drb_per36 (derived from per-game ÷ mpg × 36)</li>
            <li>field_goal_pct, free_throw_pct, three_point_pct, usage_rate, free_throw_rate</li>
            <li>ast_tov_ratio (derived: ast_per36 ÷ tov_per36), offensive_rating, defensive_rating</li>
            <li>height_inches, weight_pounds, age_at_season_start</li>
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="stats" title="Statistical distance — five facets">
          <p className="text-[#d1d5db] mb-4">
            Stats are grouped into five <em>basketball-analytics facets</em> covering the full
            skill set — shooting, scoring, playmaking, rebounding, and defense. Each facet is a
            Euclidean distance of z-score values (or absolute difference for volume), then the
            five facets are combined with an analytics-informed weighted sum.
          </p>

          <div className="overflow-x-auto mb-5">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
                  <th className="pb-2 pr-4">Facet</th>
                  <th className="pb-2 pr-6">Weight</th>
                  <th className="pb-2 pr-4">Inputs</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                <WeightRow facet="Scoring &amp; Shooting" weight="26 %" fields={['FG%', 'FT%', 'FT rate', '3P%', 'Usage', 'Off Rtg']}  note="Off Rtg at 0.5× (team-context signal)" />
                <WeightRow facet="Scoring Volume"         weight="11 %" fields={['Pts/36']}                                             note="|Δpts36|" />
                <WeightRow facet="Playmaking"             weight="18 %" fields={['Ast/36', 'AST/TOV', 'TOV/36']}                        note="AST/TOV derived live" />
                <WeightRow facet="Rebounding"             weight="20 %" fields={['Reb/36', 'ORB/36', 'DRB/36']}                         note="ORB and DRB derived from per-game ÷ mpg" />
                <WeightRow facet="Defense"                weight="25 %" fields={['Stl/36', 'Blk/36', 'Def Rtg']}                        note="Def Rtg at 0.5× (team-context signal)" />
              </tbody>
            </table>
          </div>

          <Formula>{`stat_distance = 0.26 × eff_dist
             + 0.11 × vol_dist
             + 0.18 × play_dist
             + 0.20 × reb_dist
             + 0.25 × def_dist`}</Formula>

          <Sub title="Shooting: percentages and profile">
            <p className="text-sm text-[#9ca3af]">
              The scoring &amp; shooting facet captures the complete shooting profile through six inputs:
            </p>
            <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2 mt-2">
              <li><strong>FG%</strong> — overall field goal accuracy, the primary efficiency signal</li>
              <li><strong>FT%</strong> — free throw accuracy; a player who earns foul calls but can&apos;t convert them is distinct from one who can</li>
              <li><strong>FT rate</strong> (FTA/FGA) — how aggressively a player attacks the basket and draws contact</li>
              <li><strong>3P%</strong> — three-point shooting accuracy</li>
              <li><strong>Usage</strong> — what fraction of possessions the player is the primary ball-handler</li>
              <li><strong>Offensive rating</strong> (half-weighted) — points the team scores per 100 possessions with this player on court; team-context signal weighted at 0.5× to reduce noise</li>
            </ul>
          </Sub>

          <Sub title="Rebounding: splitting ORB and DRB">
            <p className="text-sm text-[#9ca3af]">
              Total Reb/36, ORB/36, and DRB/36 are all included in the rebounding facet.
              Using all three rather than just the total ensures the algorithm distinguishes between
              a glass-crashing offensive rebounder and a positioning-based defensive rebounder —
              two meaningfully different archetypes that can share identical total rebound numbers.
            </p>
          </Sub>

          <Sub title="Defense: counting stats + team rating">
            <p className="text-sm text-[#9ca3af]">
              Stl/36 and Blk/36 are the primary individual defensive signals. Defensive rating
              (points allowed per 100 possessions) is added at half-weight to provide team-context
              context for defenders who don&apos;t generate steals/blocks but anchor strong units.
            </p>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="sort" title="Ranking the comps">
          <p className="text-[#d1d5db] mb-3">
            Comps are ranked by a <strong>blended similarity</strong> that combines the
            weighted-average facet score with the worst single facet (70/30). This
            penalises lopsided comps without letting one weak dimension dominate
            the ranking the way a 50/50 split would:
          </p>
          <Formula>{`blended_sim = 0.70 × weighted_avg + 0.30 × min_facet

weighted_avg = sEff×0.26 + sVol×0.11 + sPlay×0.18 + sReb×0.20 + sDef×0.25
min_facet    = min(sEff, sVol, sPlay, sReb, sDef)`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            A perfectly balanced comp is unaffected (min_facet ≈ weighted_avg). A comp
            that is strong in four facets but weak in one is penalised by roughly
            30% of the gap — enough to prefer a more balanced match, but not enough
            to bury an otherwise excellent comp.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="similarity" title="Distance → similarity score">
          <p className="text-[#d1d5db] mb-3">
            Raw distance is an unbounded, unitless number. It&apos;s converted to an
            intuitive 0–100 similarity score using a decaying exponential:
          </p>
          <Formula>{`similarity = 100 × e^(−dist / k)

K_STAT = 5.0  →  statistical facets (broad tolerance)
K_VOL  = 3.0  →  scoring volume sub-component
K_PHYS = 2.0  →  physical distance (body profiles less variable)
K_AGE  = 1.5  →  age distance (1 year is a meaningful development gap)`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            A similarity score of 100 means identical profiles.
            Scores above 80 indicate a very strong match; below 55 is a loose comp.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="derived" title="Derived stats — AST/TOV, ORB/36, DRB/36">
          <p className="text-[#d1d5db] mb-3">
            Three stats are not stored in the dataset and are computed on the fly inside
            the comparison engine before any z-scoring:
          </p>

          <Sub title="AST/TOV ratio">
            <Formula>{`ast_tov = ast_per36 / max(tov_per36, 0.1)
         (floor at 0.1 to avoid division by zero)`}</Formula>
            <p className="text-sm text-[#9ca3af]">
              Computed from the per-36 values rather than raw per-game counts so it is
              already playing-time–normalised and consistent with every other input.
            </p>
          </Sub>

          <Sub title="ORB/36 and DRB/36">
            <Formula>{`orb_per36 = (offensive_rebounds_per_game / minutes_per_game) × 36
drb_per36 = (defensive_rebounds_per_game / minutes_per_game) × 36`}</Formula>
            <p className="text-sm text-[#9ca3af]">
              Splitting the total rebound rate into offensive and defensive components lets
              the algorithm identify distinct rebounder archetypes — an offensive glass-crasher
              and a positioning-based defensive rebounder can share identical total Reb/36 numbers
              but represent very different skillsets.
            </p>
          </Sub>

          <p className="text-sm text-[#6b7280] mt-2">
            All three are computed in <code>comparison.ts → derivedStats()</code> and
            apply equally to current prospects and all historical players.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="statboxes" title="Profile stat box shading">
          <p className="text-[#d1d5db] mb-3">
            On individual prospect profiles, each stat box is coloured using the school&apos;s
            primary colour, with brightness adjusted to reflect how that stat compares to
            same-position peers in the current season:
          </p>
          <Formula>{`brightness_factor = 1.0 − 0.25 × clamp(z, −2.5, +2.5)

z ≥ +2.0  →  factor ≈ 0.50  →  darkened primary (elite)
z =  0.0  →  factor = 1.00  →  primary colour as-is (average)
z ≤ −2.0  →  factor ≈ 1.50  →  lightened toward white (below average)`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            <strong>Darker = better.</strong> Stats are z-scored against the same position
            group (G / F / C) in the current 2026 prospect season, so a centre&apos;s
            blocks are compared to other centres, not to guards. Text colour is chosen
            automatically for WCAG contrast.
          </p>
        </Section>

      </main>

      <div className="border-t border-[#1f2937] mt-6">
        <div className="max-w-5xl mx-auto px-4 py-5 text-center text-sm text-[#6b7280]">
          Comparison engine in <code>src/lib/utils/comparison.ts</code> ·
          Draft Board ranking in <code>src/app/api/draft-board/route.ts</code>
        </div>
      </div>
    </div>
  );
}
