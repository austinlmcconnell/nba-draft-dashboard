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
              ['#draftboard',  'Draft Board ranking — RAPTOR-weighted comps'],
              ['#raptor',      'RAPTOR explained'],
              ['#pool',        'Comparison pool (drafted players only)'],
              ['#normalise',   'Z-score normalisation'],
              ['#stats',       'Statistical distance — five facets'],
              ['#sort',        'Ranking the comps'],
              ['#similarity',  'Distance → similarity score'],
              ['#derived',     'Derived stats (TS%, AST/TOV, 3P%)'],
              ['#statboxes',   'Profile stat box shading'],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:text-[#4ade80] hover:underline transition-colors">{label}</a></li>
            ))}
          </ol>
        </nav>

        {/* ---------------------------------------------------------------- */}
        <Section id="draftboard" title="Draft Board ranking — RAPTOR-weighted comps">
          <p className="text-[#d1d5db] mb-4">
            The Draft Board ranks every prospect on the Big Board by the{' '}
            <strong>average career RAPTOR</strong> of their 10 closest historical college
            statistical comparisons. The intuition: if a prospect&apos;s college production
            most resembles 10 historical players who became high-impact NBA pros,
            that&apos;s a much stronger signal than if they resemble 10 journeymen.
          </p>

          <Formula>{`For each Big Board prospect:
  1. Find 10 closest college statistical comps
     (restricted to drafted players who have RAPTOR data)
  2. Look up each comp's career RAPTOR (FiveThirtyEight dataset)
  3. avg_raptor = mean(comp.career_raptor for comp in 10)
  4. Rank the board by avg_raptor descending`}</Formula>

          <p className="text-[#d1d5db] mt-4">
            Higher avg RAPTOR = prospect resembles historical players who had more
            NBA impact per 100 possessions. A +4 avg means their 10 comps averaged
            All-Star-level impact; a −1 avg means they averaged below replacement level.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="raptor" title="RAPTOR explained">
          <p className="text-[#d1d5db] mb-4">
            RAPTOR (Robust Algorithm using Player Tracking and On/Off Ratings) is
            FiveThirtyEight&apos;s impact metric, expressed as points above
            average per 100 possessions. It combines:
          </p>
          <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2 mb-4">
            <li><strong>On/off regularized plus-minus (RAPM)</strong> — how the team performs with the player on vs. off the court, regularized to reduce noise</li>
            <li><strong>Player-tracking inputs</strong> (2014+ only) — spatial and movement data that capture off-ball defense and positioning</li>
          </ul>

          <Sub title="Career RAPTOR used here">
            <Formula>{`career_raptor = Σ(season_raptor × minutes_played)
                / Σ(minutes_played)

Regular-season games only. Playoffs excluded.`}</Formula>
            <p className="text-sm text-[#9ca3af]">
              Weighting by minutes played ensures a single monster season doesn&apos;t
              dominate a long career, and a short stint doesn&apos;t weight as heavily
              as a 20-year career.
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

          <Sub title="Source">
            <p className="text-sm text-[#9ca3af]">
              RAPTOR data comes from FiveThirtyEight&apos;s open-source
              <a href="https://github.com/fivethirtyeight/nba-player-advanced-metrics"
                target="_blank" rel="noopener noreferrer"
                className="text-[#4ade80] hover:underline mx-1">nba-player-advanced-metrics</a>
              repository, processed into a lookup table at{' '}
              <code>public/data/raptor_lookup.json</code> via{' '}
              <code>scripts/build_raptor_lookup.py</code>. The script computes minute-weighted
              career averages for every NBA player with at least 100 career minutes.
            </p>
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
         AND normalized_name IN raptor_lookup
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
            <li>true_shooting_pct, usage_rate, free_throw_rate, three_point_pct</li>
            <li>ast_tov_ratio, oreb_pct, win_shares_per40, net_rating</li>
            <li>height_inches, weight_pounds, age_at_season_start</li>
          </ul>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="stats" title="Statistical distance — five facets">
          <p className="text-[#d1d5db] mb-4">
            Stats are grouped into five <em>basketball-analytics facets</em>. Each facet is a
            Euclidean distance (or absolute difference) of z-score values, then the five facets
            are combined with an analytics-informed weighted sum. Defence and rebounding are
            weighted highly because steal/block rates and reb/36 are the strongest positional
            discriminators at the college level.
          </p>

          <div className="overflow-x-auto mb-5">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
                  <th className="pb-2 pr-4">Facet</th>
                  <th className="pb-2 pr-6">Weight</th>
                  <th className="pb-2 pr-4">Inputs</th>
                  <th className="pb-2">Distance formula</th>
                </tr>
              </thead>
              <tbody>
                <WeightRow facet="Scoring Efficiency" weight="25 %" fields={['TS%', 'Usage', 'FT rate', '3P%']} note="√(Δts² + Δusage² + Δftr² + Δ3p%²)" />
                <WeightRow facet="Scoring Volume"     weight="16 %" fields={['Pts/36']}                         note="|Δpts36|" />
                <WeightRow facet="Playmaking"         weight="20 %" fields={['Ast/36', 'AST/TOV', 'TOV/36']}    note="√(Δast² + Δast_tov² + Δtov²)" />
                <WeightRow facet="Rebounding"         weight="19 %" fields={['Reb/36', 'OReb%']}                note="√(Δreb² + Δoreb_pct²)" />
                <WeightRow facet="Defense"            weight="20 %" fields={['Stl/36', 'Blk/36']}               note="√(Δstl² + Δblk²)" />
              </tbody>
            </table>
          </div>

          <Formula>{`stat_distance = 0.25 × eff_dist
             + 0.16 × vol_dist
             + 0.20 × play_dist
             + 0.19 × reb_dist
             + 0.20 × def_dist`}</Formula>

          <Sub title="Scoring profile: 3P% vs FT rate">
            <p className="text-sm text-[#9ca3af]">
              Inside vs outside scoring is captured through two complementary signals:
            </p>
            <ul className="list-disc list-inside text-sm text-[#9ca3af] space-y-1 ml-2 mt-2">
              <li><strong>FT rate</strong> (FTA/FGA) — high FT rate flags an inside scorer who draws contact. Paint-oriented players typically show FT rate 40–60%; perimeter players 20–35%.</li>
              <li><strong>3P%</strong> — distinguishes a genuine perimeter shooter from a player who rarely attempts threes.</li>
            </ul>
            <p className="text-sm text-[#9ca3af] mt-2">
              Together with TS% and usage rate, these four metrics paint a clear
              inside/outside scoring profile for each player.
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

weighted_avg = sEff×0.25 + sVol×0.16 + sPlay×0.20 + sReb×0.19 + sDef×0.20
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
        <Section id="derived" title="Derived stats — TS%, AST/TOV, 3P%">
          <p className="text-[#d1d5db] mb-3">Several stats are computed on load rather than stored raw:</p>

          <Sub title="True Shooting % (TS%)">
            <Formula>{`TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100

FGA is back-solved from:
  PTS ≈ 2 × FG% × FGA  +  FT% × FTR × FGA
  (FTR = free_throw_rate = FTA/FGA)

  FGA_est = PTS / (2 × FG% + FT% × FTR)
  FTA_est = FTR × FGA_est
  TS%     = PTS / (2 × (FGA_est + 0.44 × FTA_est)) × 100`}</Formula>
          </Sub>

          <Sub title="AST/TOV ratio">
            <Formula>{`ast_tov = assists_per_game / turnovers_per_game
         (0 if turnovers_per_game = 0)`}</Formula>
          </Sub>

          <p className="text-sm text-[#6b7280] mt-2">
            All derived values are computed in <code>dataLoader.ts → toCollegeStats()</code>
            and apply equally to current prospects and all historical players.
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
