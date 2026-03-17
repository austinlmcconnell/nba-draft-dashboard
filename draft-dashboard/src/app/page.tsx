/**
 * CompBeasts — Landing Page
 */

import React from 'react';
import Link from 'next/link';

// ─── Stat highlight cards ────────────────────────────────────────────────────
function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-black text-[#4ade80]">{value}</div>
      <div className="text-sm text-[#9ca3af] mt-1">{label}</div>
    </div>
  );
}

// ─── Feature cards ────────────────────────────────────────────────────────────
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="cb-card p-6 cb-glow transition-all duration-300 hover:border-[#1a7a3f]/60">
      <div className="w-11 h-11 rounded-lg bg-[#1a7a3f]/20 flex items-center justify-center text-[#4ade80] mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg text-[#f9fafb] mb-2">{title}</h3>
      <p className="text-[#9ca3af] text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────
function Step({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <div className="flex gap-5">
      <div className="flex-shrink-0 w-9 h-9 rounded-full border-2 border-[#1a7a3f] flex items-center justify-center">
        <span className="text-sm font-bold text-[#4ade80]">{num}</span>
      </div>
      <div>
        <h3 className="font-bold text-[#f9fafb] mb-1">{title}</h3>
        <p className="text-[#9ca3af] text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ─── Arrow icon ───────────────────────────────────────────────────────────────
function ArrowRight() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="bg-[#0d1117]">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Radial green glow behind hero */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 50% -10%, rgba(26,122,63,0.22) 0%, transparent 70%)',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#1a7a3f]/40 bg-[#1a7a3f]/10 text-[#4ade80] text-xs font-semibold tracking-wide mb-8 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            2026 NBA Draft · Live Analytics
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="gradient-text-brand">Draft Intel.</span>
            <br />
            <span className="text-[#f9fafb]">Beast Mode.</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#9ca3af] max-w-2xl mx-auto mb-10 leading-relaxed">
            Compare every 2026 NBA draft prospect to their closest historical
            matches — across 6,800+ college players — using advanced
            multi-faceted statistical modeling.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/draft" className="btn-primary text-base py-3 px-7">
              Explore the Draft Board
              <ArrowRight />
            </Link>
            <Link href="/methodology" className="btn-secondary text-base py-3 px-7">
              How It Works
            </Link>
          </div>

          {/* Divider stats */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-2xl mx-auto">
            <StatBadge value="6,800+" label="Historical players" />
            <StatBadge value="5"      label="Comparison facets" />
            <StatBadge value="40+"    label="Statistical fields" />
            <StatBadge value="2026"   label="Draft class" />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-[#f9fafb] mb-4">
            Why <span className="gradient-text">CompBeasts?</span>
          </h2>
          <p className="text-[#9ca3af] max-w-xl mx-auto">
            Purpose-built for draft analysts, fantasy managers, and hoops fans
            who want data over hype.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            title="Multi-Faceted Comparisons"
            description="Every comparison scores five independent facets — efficiency, scoring volume, playmaking, rebounding, and defense — then blends them into a holistic similarity score."
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
              </svg>
            }
            title="Z-Score Normalization"
            description="Stats are normalized by era and position so a mid-2000s point guard compares fairly to a modern wing — no apples-to-oranges distortions."
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            title="Physical Profiling"
            description="Height, weight, and wingspan are layered on top of stats, surfacing comps who match the physical archetype in addition to the statistical one."
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            title="Instant Results"
            description="Client-side data loading means comparisons run in your browser with no server roundtrip — results appear in milliseconds."
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
            title="Full Prospect Database"
            description="Search beyond the top-60 big board. Filter by position, conference, or school to surface hidden gems across the entire 2026 class."
          />
          <FeatureCard
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Transparent Methodology"
            description="Every weight, formula, and tuning decision is documented in plain English. No black-box magic — just reproducible sports science."
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#111827] border-y border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#4ade80] mb-3">How It Works</p>
              <h2 className="text-3xl font-black text-[#f9fafb] mb-6 leading-tight">
                From prospect stats to historical comp in three steps
              </h2>
              <div className="space-y-7">
                <Step
                  num={1}
                  title="Normalize across eras"
                  body="Raw stats are converted to z-scores relative to all players in the same season and position cohort, removing era and pace bias."
                />
                <Step
                  num={2}
                  title="Measure five facets"
                  body="Weighted Euclidean distances are computed across efficiency, volume, playmaking, rebounding, and defense — plus an optional physical profile."
                />
                <Step
                  num={3}
                  title="Rank and surface comps"
                  body="Distances are converted to 0–100 similarity scores using exponential decay, then the top historical matches are displayed with a full breakdown."
                />
              </div>
            </div>

            {/* Visual card */}
            <div className="cb-card p-6 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-widest font-bold text-[#4ade80]">Similarity Breakdown</span>
                <span className="text-xs text-[#6b7280]">Example</span>
              </div>
              {[
                { label: 'Efficiency',  pct: 82 },
                { label: 'Scoring',     pct: 74 },
                { label: 'Playmaking',  pct: 68 },
                { label: 'Rebounding',  pct: 91 },
                { label: 'Defense',     pct: 55 },
              ].map(({ label, pct }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#d1d5db] font-medium">{label}</span>
                    <span className="text-[#4ade80] font-bold">{pct}</span>
                  </div>
                  <div className="h-2 bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, #1a7a3f, #4ade80)`,
                      }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-[#1f2937] flex justify-between">
                <span className="text-xs text-[#6b7280] font-semibold">Overall</span>
                <span className="text-sm font-black text-[#4ade80]">74</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div
          className="relative rounded-2xl overflow-hidden border border-[#1a7a3f]/30 p-12"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(26,122,63,0.18) 0%, transparent 70%), #111827',
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-black text-[#f9fafb] mb-4">
            Ready to hunt for your next star?
          </h2>
          <p className="text-[#9ca3af] max-w-lg mx-auto mb-8">
            Dive into the 2026 Draft Board, filter by position or school,
            and pull up full comparison breakdowns for any prospect.
          </p>
          <Link href="/draft" className="btn-primary text-base py-3.5 px-8 inline-flex">
            Open the Draft Board
            <ArrowRight />
          </Link>
        </div>
      </section>

    </div>
  );
}
