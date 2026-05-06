'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import type { ProspectEvalEntry, ProspectEvalApiResponse } from '../api/prospect-eval/route';

// ─── Z-score color helpers ───────────────────────────────────────────────────
// All metrics here are "higher = better" so we shade green at high z, red at low.
// Athleticism is mapped to a numeric scale before z-scoring.
function zScore(value: number, mean: number, sd: number): number {
  if (!isFinite(value) || sd === 0) return 0;
  return (value - mean) / sd;
}

function shadeForZ(z: number | null): string {
  if (z === null) return 'bg-[#0d1117] text-[#374151]';
  if (z >= 1.5)  return 'bg-emerald-900/60 text-emerald-200';
  if (z >= 0.5)  return 'bg-emerald-900/30 text-emerald-300';
  if (z >= -0.5) return 'bg-[#1a2332] text-[#9ca3af]';
  if (z >= -1.5) return 'bg-amber-900/30 text-amber-300';
  return 'bg-red-900/40 text-red-300';
}

const ATHLETICISM_SCALE: Record<string, number> = {
  'Bad': 1, 'Below Average': 2, 'Average': 3, 'Above Average': 4, 'Great': 5,
};

// ─── Compute pool stats for one numeric field ────────────────────────────────
type NumericKey = keyof Pick<
  ProspectEvalEntry,
  'rimPts40' | 'midPts40' | 'threePts40' | 'astPct' | 'orbPct' |
  'stlPct' | 'blkPct' | 'drbPct' | 'wingspanInches'
>;

function meanSd(values: (number | null | undefined)[]): { mean: number; sd: number } {
  const nums = values.filter((v): v is number => typeof v === 'number' && isFinite(v));
  if (nums.length === 0) return { mean: 0, sd: 0 };
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  const variance = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / nums.length;
  return { mean, sd: Math.sqrt(variance) };
}

// ─── Cell renderer ───────────────────────────────────────────────────────────
function MetricCell({ value, z, format = 'num1', suffix = '' }: {
  value: number | null;
  z: number | null;
  format?: 'num1' | 'num2' | 'pct1' | 'int';
  suffix?: string;
}) {
  const display = value === null
    ? '—'
    : format === 'pct1' ? `${value.toFixed(1)}%`
    : format === 'num2' ? value.toFixed(2)
    : format === 'int'  ? `${Math.round(value)}`
    : value.toFixed(1);
  return (
    <td className={`px-3 py-2 text-center text-xs font-bold tabular-nums whitespace-nowrap ${shadeForZ(z)}`}>
      {value !== null ? display + suffix : <span className="text-[#374151]">—</span>}
    </td>
  );
}

// ─── Header cell ─────────────────────────────────────────────────────────────
function HeaderCell({ label, sub }: { label: string; sub?: string }) {
  return (
    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-[#9ca3af] border-b border-[#1f2937] whitespace-nowrap align-bottom">
      {label}
      {sub && <div className="text-[9px] text-[#4b5563] font-semibold normal-case tracking-normal mt-0.5">{sub}</div>}
    </th>
  );
}

// ─── Section divider in header ────────────────────────────────────────────────
function SectionHeader({ label, span, color }: { label: string; span: number; color: string }) {
  return (
    <th colSpan={span}
        className={`text-[10px] font-black uppercase tracking-widest text-center py-1.5 border-b border-l border-r border-[#1f2937] ${color}`}>
      {label}
    </th>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EvaluatePage() {
  const [entries, setEntries]   = useState<ProspectEvalEntry[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/prospect-eval', { cache: 'no-store' });
      const data: ProspectEvalApiResponse = await res.json();
      if (data.error && (data.entries?.length ?? 0) === 0) throw new Error(data.error);
      setEntries(data.entries);
      setUpdatedAt(data.updatedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 60_000);
    const focus = () => load();
    window.addEventListener('focus', focus);
    return () => { clearInterval(iv); window.removeEventListener('focus', focus); };
  }, [load]);

  // ─── Stats pool: only entries with hasStats (for offense/defense z-scores) ─
  const statsPool = useMemo(() => entries.filter(e => e.hasStats), [entries]);
  const numericMeans = useMemo(() => {
    const keys: NumericKey[] = [
      'rimPts40', 'midPts40', 'threePts40', 'astPct', 'orbPct',
      'stlPct', 'blkPct', 'drbPct', 'wingspanInches',
    ];
    const out: Record<string, { mean: number; sd: number }> = {};
    for (const k of keys) {
      out[k] = meanSd(statsPool.map(e => e[k] as number | null));
    }
    // Wingspan uses the full board (everyone with a measurement), not just stats pool
    out['wingspanInches'] = meanSd(entries.map(e => e.wingspanInches));
    return out;
  }, [statsPool, entries]);

  // Athleticism z (scaled 1-5)
  const athleticismMeans = useMemo(() => {
    const vals = entries
      .map(e => e.athleticism ? ATHLETICISM_SCALE[e.athleticism] : null)
      .filter((v): v is number => v !== null);
    return meanSd(vals);
  }, [entries]);

  // Age — z-scored across full board (lower = better, so we invert)
  const ageMeans = useMemo(() =>
    meanSd(entries.map(e => e.draftAge)), [entries]);

  // Position-relative size: group by simple position bucket and z within group
  // (height + weight). Returns lookup function: (entry) -> { hZ, wZ }.
  const sizeZ = useMemo(() => {
    const bucket = (pos: string): string => {
      const p = pos.toUpperCase();
      if (p.includes('PG') || p.includes('SG') || p === 'G')  return 'G';
      if (p.includes('SF') || p.includes('PF') || p === 'F')  return 'F';
      if (p === 'C')                                          return 'C';
      // hybrids
      if (p.includes('G/F') || p.includes('G-F') || p.includes('SG/SF')) return 'G';
      if (p.includes('F/C') || p.includes('F-C') || p.includes('PF/C'))  return 'F';
      return 'F';
    };
    const groups: Record<string, ProspectEvalEntry[]> = {};
    for (const e of entries) {
      const b = bucket(e.position);
      (groups[b] ??= []).push(e);
    }
    const stats: Record<string, { h: { mean: number; sd: number }; w: { mean: number; sd: number } }> = {};
    for (const [g, arr] of Object.entries(groups)) {
      stats[g] = {
        h: meanSd(arr.map(e => e.heightInches)),
        w: meanSd(arr.map(e => e.weightPounds)),
      };
    }
    return (e: ProspectEvalEntry) => {
      const s = stats[bucket(e.position)];
      if (!s) return { hZ: null, wZ: null };
      return {
        hZ: e.heightInches !== null ? zScore(e.heightInches, s.h.mean, s.h.sd) : null,
        wZ: e.weightPounds !== null ? zScore(e.weightPounds, s.w.mean, s.w.sd) : null,
      };
    };
  }, [entries]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-[#6b7280] text-sm">Loading evaluation board…</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button onClick={load} className="btn-primary text-sm">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117]">
      {/* Header */}
      <div className="border-b border-[#1f2937] bg-[#111827]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#1a7a3f]/20 border border-[#1a7a3f]/40 rounded-full text-xs font-semibold text-[#4ade80]">
                  2025-26 Stat Profile
                </span>
                {updatedAt && (
                  <span className="text-xs text-[#6b7280]">
                    Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#f9fafb]">
                Prospect <span className="gradient-text">Evaluation</span>
              </h1>
              <p className="mt-1 text-[#6b7280] text-sm max-w-2xl">
                Per-possession breakdown of every Big Board prospect&apos;s 2025-26 college season.
                Each cell is shaded by z-score within the current Big Board — green = above the group, red = below.
              </p>
            </div>
            <Link href="/draft" className="btn-secondary text-sm self-start">← Comp board</Link>
          </div>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-[#111827] rounded-xl border border-[#1f2937] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                {/* Section row */}
                <tr className="bg-[#0d1117]">
                  <th colSpan={2} className="border-b border-[#1f2937]" />
                  <SectionHeader label="Offense" span={9}  color="text-[#4ade80]" />
                  <SectionHeader label="Defense" span={3}  color="text-amber-400" />
                  <SectionHeader label="Physical Tools" span={4}  color="text-[#9ca3af]" />
                  <SectionHeader label="Age"     span={1}  color="text-[#6b7280]" />
                </tr>
                {/* Metric row */}
                <tr className="bg-[#0d1117]">
                  <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-[#9ca3af] border-b border-[#1f2937] whitespace-nowrap">Rank · Name</th>
                  <HeaderCell label="School" />
                  <HeaderCell label="Rim" sub="pts/40" />
                  <HeaderCell label="Rim" sub="FG%" />
                  <HeaderCell label="Rim" sub="Share" />
                  <HeaderCell label="Mid" sub="pts/40" />
                  <HeaderCell label="Mid" sub="FG%" />
                  <HeaderCell label="Mid" sub="Share" />
                  <HeaderCell label="3PT" sub="pts/40" />
                  <HeaderCell label="3PT" sub="3P%" />
                  <HeaderCell label="Pass" sub="AST%" />
                  <HeaderCell label="O Reb" sub="ORB%" />
                  <HeaderCell label="STL%" />
                  <HeaderCell label="BLK%" />
                  <HeaderCell label="D Reb" sub="DRB%" />
                  <HeaderCell label="Height" sub="vs pos" />
                  <HeaderCell label="Weight" sub="vs pos" />
                  <HeaderCell label="Wing" sub="inches" />
                  <HeaderCell label="Athl" sub="eye test" />
                  <HeaderCell label="Age" sub="draft" />
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const m = numericMeans;
                  const z = (k: NumericKey) => {
                    const v = e[k] as number | null;
                    if (v === null || !isFinite(v as number)) return null;
                    return zScore(v as number, m[k].mean, m[k].sd);
                  };
                  const sz = sizeZ(e);
                  const athNum = e.athleticism ? ATHLETICISM_SCALE[e.athleticism] : null;
                  const athZ = athNum !== null ? zScore(athNum, athleticismMeans.mean, athleticismMeans.sd) : null;
                  // Age: lower is better, so invert sign
                  const ageZ = e.draftAge !== null
                    ? -zScore(e.draftAge, ageMeans.mean, ageMeans.sd)
                    : null;

                  return (
                    <tr key={e.slug} className="border-b border-[#1f2937] hover:bg-white/[0.02]">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link href={`/draft/${e.slug}`} className="block group">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-[#4b5563] w-5 text-right">{e.rank}</span>
                            <span className="text-xs font-bold text-[#f9fafb] group-hover:text-[#4ade80] transition-colors">{e.name}</span>
                          </div>
                          <div className="text-[10px] text-[#6b7280] mt-0.5 ml-7">{e.position}</div>
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-[#6b7280] whitespace-nowrap">{e.school}</td>

                      {/* Offense — Rim */}
                      <MetricCell value={e.rimPts40} z={z('rimPts40')} format="num1" />
                      <MetricCell value={e.rimFgPct} z={z('rimPts40')} format="num1" suffix="%" />
                      <MetricCell value={e.rimShare} z={null} format="num1" suffix="%" />
                      {/* Mid */}
                      <MetricCell value={e.midPts40} z={z('midPts40')} format="num1" />
                      <MetricCell value={e.midFgPct} z={z('midPts40')} format="num1" suffix="%" />
                      <MetricCell value={e.midShare} z={null} format="num1" suffix="%" />
                      {/* 3PT */}
                      <MetricCell value={e.threePts40} z={z('threePts40')} format="num1" />
                      <MetricCell value={e.threeFgPct} z={z('threePts40')} format="num1" suffix="%" />
                      {/* Passing + ORB */}
                      <MetricCell value={e.astPct} z={z('astPct')} format="num1" suffix="%" />
                      <MetricCell value={e.orbPct} z={z('orbPct')} format="num1" suffix="%" />
                      {/* Defense */}
                      <MetricCell value={e.stlPct} z={z('stlPct')} format="num1" suffix="%" />
                      <MetricCell value={e.blkPct} z={z('blkPct')} format="num1" suffix="%" />
                      <MetricCell value={e.drbPct} z={z('drbPct')} format="num1" suffix="%" />
                      {/* Physical */}
                      <MetricCell value={e.heightInches} z={sz.hZ} format="int" suffix={'″'} />
                      <MetricCell value={e.weightPounds} z={sz.wZ} format="int" />
                      <MetricCell value={e.wingspanInches} z={z('wingspanInches')} format="int" suffix={'″'} />
                      <td className={`px-3 py-2 text-center text-xs font-bold whitespace-nowrap ${shadeForZ(athZ)}`}>
                        {e.athleticism ?? <span className="text-[#374151]">—</span>}
                      </td>
                      {/* Age */}
                      <MetricCell value={e.draftAge} z={ageZ} format="num1" />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-[#1f2937] flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] text-[#374151]">
              {entries.length} prospects · {statsPool.length} with 2025-26 college stats · click a name for full comp breakdown
            </p>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider">
              <span className="text-[#374151]">Z-score:</span>
              <span className="px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 font-black">≥ +1.5</span>
              <span className="px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-300 font-black">≥ +0.5</span>
              <span className="px-2 py-0.5 rounded bg-[#1a2332] text-[#9ca3af] font-black">±0.5</span>
              <span className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-300 font-black">≥ −1.5</span>
              <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-300 font-black">&lt; −1.5</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#374151] mt-4">
          Rim &amp; Mid points/40 = points scored from each location per 40 minutes (combines volume + efficiency).
          AST%, ORB%, STL%, BLK%, DRB% are per-possession rates from Bart Torvik. Height &amp; Weight z-scored within position group.
          Athleticism is your manual eye-test rating from column N. Lower draft age shaded as positive.
        </p>
      </main>
    </div>
  );
}
