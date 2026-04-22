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
            How the comparison engine finds each prospect&apos;s historical matches, and how the Draft Board ranks them
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* TOC */}
        <nav className="mb-12 cb-panel p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">Contents</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#9ca3af]">
            {[
              ['#overview',    'Overview — what drives the comparisons'],
              ['#prpg',        'PRPG! — the primary signal'],
              ['#pool',        'Comparison pool — drafted, 2008+, same age ±1'],
              ['#weighting',   'Weighting — PRPG! primary (65%), archetype (35%)'],
              ['#archetype',   'Archetype facets — the five raw-stat dimensions'],
              ['#normalise',   'Z-score normalisation'],
              ['#similarity',  'Distance → similarity score'],
              ['#derived',     'Derived stats (AST/TOV, ORB/36, DRB/36)'],
              ['#draftboard',  'Draft Board ranking (TBD metric)'],
              ['#statboxes',   'Profile stat box shading'],
            ].map(([href, label]) => (
              <li key={href}><a href={href} className="hover:text-[#4ade80] hover:underline transition-colors">{label}</a></li>
            ))}
          </ol>
        </nav>

        {/* ---------------------------------------------------------------- */}
        <Section id="overview" title="Overview — what drives the comparisons">
          <p className="text-[#d1d5db] mb-3">
            Every prospect comparison is driven by two lenses that work together:
          </p>
          <ol className="list-decimal list-inside text-[#d1d5db] space-y-2 ml-2 mb-4">
            <li>
              <strong>PRPG!</strong> — BartTorvik&apos;s Points per Replacement Player per Game.
              A single-number, per-possession, tempo- and competition-adjusted metric capturing
              <em> both offensive and defensive impact</em>. This is the <strong>primary signal
              (65% weight)</strong>.
            </li>
            <li>
              <strong>Five raw-stat archetype facets</strong> — shooting, volume, playmaking,
              rebounding, defense. These keep comps tethered to the right play style after
              PRPG! filters for quality. <strong>Secondary signal (35% weight)</strong>.
            </li>
          </ol>
          <p className="text-[#d1d5db]">
            The pool itself is narrowed to <strong>drafted players (2008–present) within ±1 year
            of the prospect&apos;s age</strong>, so comps are always scouted peers who produced
            at a similar career stage.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="prpg" title="PRPG! — the primary signal">
          <p className="text-[#d1d5db] mb-3">
            PRPG! (Points per Replacement Player per Game) is Bart Torvik&apos;s single-number
            player value. It estimates how many points per game a team gains by replacing a
            D1-average bench player with this player, adjusted for pace and the strength of
            the opponents faced. In one number it captures offense, defense, usage, and
            the quality of competition.
          </p>
          <Formula>{`source   : https://barttorvik.com/getadvstats.php?year=YYYY&csv=1
coverage : 2008 season through present, ~5,000 D1 players per year
built by : scripts/build_barttorvik_lookup.py
stored   : draft-dashboard/public/data/barttorvik_lookup.json
join key : normalize(player_name) + '|' + season`}</Formula>

          <Sub title="Why PRPG! and not raw box-score comparisons?">
            <p className="text-sm text-[#9ca3af]">
              Raw per-36 stats cannot distinguish a 26 pts/36 wing in the Big 12 from a 26 pts/36
              wing at a mid-major — the former is facing dramatically tougher opponents, so the
              production is worth more. PRPG! adjusts for opponent strength and tempo, so
              same-number PRPG! means same-level impact regardless of conference.
            </p>
          </Sub>

          <Sub title="PRPG! similarity">
            <Formula>{`sim_prpg = 100 × e^(−|Δ PRPG!| / K_PRPG)      K_PRPG = 1.5

Examples:
  Δ = 0.0 →  100   (identical production level)
  Δ = 0.5 →  ~72
  Δ = 1.5 →  ~37
  Δ = 3.0 →  ~14`}</Formula>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="pool" title="Comparison pool — drafted, 2008+, same age ±1">
          <p className="text-[#d1d5db] mb-3">
            Every comparison is drawn from a pool defined by three filters:
          </p>
          <Formula>{`pool = historical_players WHERE
         draft_pick IS NOT NULL            -- drafted only (scouted prospects)
         AND 2008 ≤ college_season < 2026  -- matches BartTorvik coverage
         AND normalized_name+season IN barttorvik_lookup
         AND |prospect_age - player_age| ≤ 1`}</Formula>

          <Sub title="Drafted only">
            <p className="text-sm text-[#9ca3af]">
              Restricting the pool to drafted players removes mid-major statistical doppelgangers
              whose raw stats look similar but whose NBA trajectories are not analogous. Every
              comp was someone scouts identified as an NBA-caliber prospect.
            </p>
          </Sub>

          <Sub title="2008–present">
            <p className="text-sm text-[#9ca3af]">
              BartTorvik&apos;s earliest season is 2007-08. Restricting the pool to seasons with
              PRPG! coverage ensures every comp can be scored on the primary signal.
            </p>
          </Sub>

          <Sub title="Same age ±1">
            <p className="text-sm text-[#9ca3af]">
              An 18-year-old freshman producing elite stats is very different from a
              22-year-old senior producing the same stats; the ceiling implications
              diverge sharply. We use <code>age_at_season_start</code> when available
              (~18% of players); otherwise fall back to mapping <code>class_year</code>
              to an approximate age (Fr→19, So→20, Jr→21, Sr→22). The filter is relaxed
              automatically if too few candidates remain after age-gating (fewer than 30).
            </p>
          </Sub>

          <p className="text-sm text-[#9ca3af] mt-3">
            Position groups (G / F / C, plus hybrid G-F and F-C) further restrict the pool so
            guards are compared against guards, forwards against forwards, etc.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="weighting" title="Weighting — PRPG! primary (65 %), archetype (35 %)">
          <p className="text-[#d1d5db] mb-3">
            Each candidate is scored by blending PRPG! similarity with the five-facet raw-stat
            archetype similarity:
          </p>
          <Formula>{`blended_sim = 0.65 × sim_prpg  +  0.35 × archetype_avg

archetype_avg = sEff×0.26 + sVol×0.11 + sPlay×0.18 + sReb×0.20 + sDef×0.25`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            If a candidate has no BartTorvik record (no PRPG!), the algorithm falls back to
            pure archetype similarity. Within the 35% archetype budget, the original facet
            proportions are preserved — so <code>scoring &amp; shooting</code> contributes
            26 × 35 = <strong>9.1%</strong> of the final score, and so on.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="archetype" title="Archetype facets — the five raw-stat dimensions">
          <p className="text-[#d1d5db] mb-4">
            The raw-stat archetype keeps comps anchored to the right play style. Each facet
            is a Euclidean distance of z-score values (or absolute difference for volume),
            with the proportions below.
          </p>

          <div className="overflow-x-auto mb-5">
            <table className="text-sm w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-[#6b7280] uppercase tracking-wide">
                  <th className="pb-2 pr-4">Facet</th>
                  <th className="pb-2 pr-6">Share of 35%</th>
                  <th className="pb-2 pr-4">Inputs</th>
                  <th className="pb-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                <WeightRow facet="Scoring & Shooting" weight="9.1 %"  fields={['FG%', 'FT%', 'FT rate', '3P%', 'Usage', 'Off Rtg']}  note="Off Rtg at 0.5× (team-context signal)" />
                <WeightRow facet="Scoring Volume"     weight="3.85 %" fields={['Pts/36']}                                           note="|Δpts36|" />
                <WeightRow facet="Playmaking"         weight="6.3 %"  fields={['Ast/36', 'AST/TOV', 'TOV/36']}                      note="AST/TOV derived live" />
                <WeightRow facet="Rebounding"         weight="7.0 %"  fields={['Reb/36', 'ORB/36', 'DRB/36']}                       note="ORB and DRB derived from per-game ÷ mpg" />
                <WeightRow facet="Defense"            weight="8.75 %" fields={['Stl/36', 'Blk/36', 'Def Rtg']}                      note="Def Rtg at 0.5× (team-context signal)" />
              </tbody>
            </table>
          </div>

          <Sub title="Rebounding — splitting ORB and DRB">
            <p className="text-sm text-[#9ca3af]">
              Total Reb/36 plus ORB/36 and DRB/36. Using all three lets the algorithm
              distinguish a glass-crashing offensive rebounder from a positioning-based
              defensive rebounder — two meaningfully different archetypes that can share
              identical total rebound numbers.
            </p>
          </Sub>

          <Sub title="Defense — counting stats + team rating">
            <p className="text-sm text-[#9ca3af]">
              Stl/36 and Blk/36 are the primary individual signals. Def Rtg is added at
              half-weight for context on anchor defenders who don&apos;t rack up blocks or
              steals but shrink a team&apos;s points-allowed.
            </p>
          </Sub>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="normalise" title="Z-score normalisation">
          <p className="text-[#d1d5db] mb-3">
            Raw stat values aren&apos;t comparable across dimensions. Every raw-archetype input
            is standardised to a z-score before any distance is computed:
          </p>
          <Formula>{`z(x) = (x − μ) / σ

μ  = mean of that stat across ALL historical players in the pool
σ  = standard deviation (if σ = 0, z = 0 to avoid division by zero)`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            PRPG! is <strong>not</strong> z-scored — it&apos;s already on a calibrated scale
            (replacement = 0) that&apos;s interpretable across eras. Raw |Δ PRPG!| is used
            directly with an exponential decay.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="similarity" title="Distance → similarity score">
          <p className="text-[#d1d5db] mb-3">
            Raw distances are unbounded. They&apos;re converted to intuitive 0–100 similarity
            scores using a decaying exponential:
          </p>
          <Formula>{`similarity = 100 × e^(−dist / k)

K_PRPG = 1.5  →  PRPG! similarity (primary)
K_STAT = 5.0  →  archetype facets (Euclidean in z-space)
K_VOL  = 3.0  →  scoring volume sub-component
K_PHYS = 2.0  →  physical distance`}</Formula>
          <p className="text-sm text-[#9ca3af]">
            A similarity score of 100 means identical profiles. Above 80 is a very strong
            match; below 55 is loose.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="derived" title="Derived stats — AST/TOV, ORB/36, DRB/36">
          <p className="text-[#d1d5db] mb-3">
            Three stats aren&apos;t stored in the raw dataset and are computed on the fly
            inside the comparison engine before any z-scoring:
          </p>

          <Sub title="AST/TOV ratio">
            <Formula>{`ast_tov = ast_per36 / max(tov_per36, 0.1)
         (floor at 0.1 to avoid division by zero)`}</Formula>
            <p className="text-sm text-[#9ca3af]">
              Computed from per-36 values rather than raw per-game counts, so it is already
              playing-time-normalised and consistent with every other input.
            </p>
          </Sub>

          <Sub title="ORB/36 and DRB/36">
            <Formula>{`orb_per36 = (offensive_rebounds_per_game / minutes_per_game) × 36
drb_per36 = (defensive_rebounds_per_game / minutes_per_game) × 36`}</Formula>
          </Sub>

          <p className="text-sm text-[#6b7280] mt-2">
            All three are computed in <code>comparison.ts → derivedStats()</code> and apply
            equally to current prospects and all historical players.
          </p>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section id="draftboard" title="Draft Board ranking — TBD metric">
          <p className="text-[#d1d5db] mb-3">
            The Draft Board sorts Big Board prospects by some NBA-outcome metric averaged
            across each prospect&apos;s 10 closest comps. The <em>which metric</em> is
            currently being reworked — earlier versions used career Box Plus-Minus (BPM),
            which proved to be structurally biased against wing players and was removed.
            A replacement outcome metric is pending.
          </p>
          <p className="text-sm text-[#9ca3af]">
            The comp <em>finding</em> is fully driven by the PRPG!-primary methodology above.
            Only the final ranking aggregation is in flux.
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
            group (G / F / C) in the current 2026 prospect season, so a centre&apos;s blocks
            are compared to other centres, not to guards. Text colour is chosen automatically
            for WCAG contrast.
          </p>
        </Section>

      </main>

      <div className="border-t border-[#1f2937] mt-6">
        <div className="max-w-5xl mx-auto px-4 py-5 text-center text-sm text-[#6b7280]">
          Comparison engine in <code>src/lib/utils/comparison.ts</code> ·
          BartTorvik scraper in <code>scripts/build_barttorvik_lookup.py</code> ·
          Draft Board ranking in <code>src/app/api/draft-board/route.ts</code>
        </div>
      </div>
    </div>
  );
}
