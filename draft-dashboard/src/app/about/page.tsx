/**
 * /about — CompBeasts About Page
 */

import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about CompBeasts — advanced NBA draft analytics powered by multi-faceted player comparison modeling.',
};

function ValueCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="cb-card p-6 hover:border-[#1a7a3f]/60 transition-all duration-200">
      <h3 className="font-bold text-[#f9fafb] mb-2">{title}</h3>
      <p className="text-[#9ca3af] text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function DataSource({
  name, description, href,
}: {
  name: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 p-4 cb-card hover:border-[#1a7a3f]/60 transition-all duration-200 group"
    >
      <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-[#1a7a3f]/20 flex items-center justify-center text-[#4ade80] mt-0.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </div>
      <div>
        <div className="font-semibold text-[#d1d5db] group-hover:text-[#4ade80] transition-colors text-sm">
          {name}
        </div>
        <div className="text-[#6b7280] text-xs mt-0.5 leading-relaxed">{description}</div>
      </div>
    </a>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0d1117]">

      {/* Hero */}
      <div className="bg-[#111827] border-b border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">About</p>
          <h1 className="text-4xl sm:text-5xl font-black text-[#f9fafb] leading-tight mb-4">
            Built for the details.
            <br />
            <span className="gradient-text">Obsessed with accuracy.</span>
          </h1>
          <p className="text-[#9ca3af] text-lg max-w-2xl leading-relaxed">
            CompBeasts is an advanced NBA draft analytics platform that uses
            multi-faceted statistical modeling to compare current prospects
            against 6,800+ historical college basketball players.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-16">

        {/* Mission */}
        <section>
          <h2 className="text-2xl font-black text-[#f9fafb] mb-6">The Mission</h2>
          <div className="cb-card p-8 border-l-4 border-l-[#1a7a3f]">
            <p className="text-[#d1d5db] leading-relaxed text-base mb-4">
              Draft analysis is often dominated by eye-test takes, highlight reels,
              and hot takes. CompBeasts cuts through the noise by anchoring every
              prospect evaluation in historical precedent — asking not "does this
              player look good?" but <em className="text-[#4ade80]">"who does this player actually
              resemble statistically?"</em>
            </p>
            <p className="text-[#9ca3af] leading-relaxed text-sm">
              By normalizing stats across eras and positions, we remove the bias
              introduced by pace changes, rule modifications, and era-specific
              scoring environments. The result is a system where a 2006 big man
              can fairly compare to a 2026 stretch four.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-2xl font-black text-[#f9fafb] mb-6">What We Stand For</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <ValueCard
              title="Transparency First"
              body="Every weight, formula, and modeling decision is documented publicly in our Methodology page. No black boxes. No proprietary mystery sauce."
            />
            <ValueCard
              title="Era-Neutral Analysis"
              body="Z-score normalization removes pace bias and era drift, so comparisons across different decades are statistically fair."
            />
            <ValueCard
              title="Holistic Profiles"
              body="We score five independent facets — efficiency, volume, playmaking, rebounding, and defense — plus optional physical profiling. One number never tells the whole story."
            />
            <ValueCard
              title="Data Over Hype"
              body="Metrics don't care about combine buzz or draft stock narratives. Our system surfaces historically-grounded comps based purely on what happened on the court."
            />
          </div>
        </section>

        {/* How the model works summary */}
        <section>
          <h2 className="text-2xl font-black text-[#f9fafb] mb-3">Under the Hood</h2>
          <p className="text-[#9ca3af] text-sm mb-6">
            A high-level overview — full technical details are in the{' '}
            <Link href="/methodology" className="text-[#4ade80] hover:underline">Methodology page</Link>.
          </p>
          <div className="space-y-4">
            {[
              {
                step: '01',
                title: 'Data collection',
                body: 'College stats (per-game, per-36, efficiency) are sourced from CollegeBasketballData.com for the 2026 class and 6,800+ historical players going back to the late 1990s.',
              },
              {
                step: '02',
                title: 'Era normalization',
                body: 'Every stat is converted to a z-score relative to all players in the same season and position cohort, eliminating pace-of-play and era bias.',
              },
              {
                step: '03',
                title: 'Facet scoring',
                body: 'Weighted Euclidean distances are computed across five independent facets. Each facet captures a different dimension of play — a player can be a great rebounder but poor playmaker, and the model reflects that nuance.',
              },
              {
                step: '04',
                title: 'Similarity conversion',
                body: 'Raw distances are converted to 0–100 similarity scores using exponential decay, then the top statistical, physical, and overall matches are surfaced.',
              },
            ].map(({ step, title, body }) => (
              <div key={step} className="flex gap-5 cb-card p-5">
                <span className="text-2xl font-black text-[#1a7a3f]/40 flex-shrink-0 w-8 leading-none">
                  {step}
                </span>
                <div>
                  <h3 className="font-bold text-[#f9fafb] mb-1">{title}</h3>
                  <p className="text-[#9ca3af] text-sm leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Data sources */}
        <section>
          <h2 className="text-2xl font-black text-[#f9fafb] mb-2">Data Sources</h2>
          <p className="text-[#9ca3af] text-sm mb-6">
            CompBeasts aggregates data from three primary sources. We are grateful
            to the maintainers of these databases.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <DataSource
              name="CollegeBasketballData.com"
              description="Primary source for per-game and per-36 college stats for both the 2026 class and historical players."
              href="https://www.collegebasketballdata.com"
            />
            <DataSource
              name="Basketball Reference"
              description="NBA career outcomes and historical context for all historical player comparisons."
              href="https://www.basketball-reference.com"
            />
            <DataSource
              name="Tankathon Big Board"
              description="2026 draft rankings used to power the ordered Draft Board view."
              href="https://www.tankathon.com"
            />
            <DataSource
              name="ESPN (images)"
              description="Player headshots and team logo assets displayed on player cards."
              href="https://www.espn.com"
            />
          </div>
        </section>

        {/* CTA */}
        <section>
          <div
            className="rounded-2xl p-10 text-center border border-[#1a7a3f]/30"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(26,122,63,0.15) 0%, transparent 70%), #111827',
            }}
          >
            <h2 className="text-2xl font-black text-[#f9fafb] mb-3">
              Ready to explore the 2026 class?
            </h2>
            <p className="text-[#9ca3af] mb-6 text-sm">
              Dive into the Draft Board or read the full Methodology documentation.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/draft" className="btn-primary">
                Open Draft Board
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="/methodology" className="btn-secondary">
                Read the Methodology
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
