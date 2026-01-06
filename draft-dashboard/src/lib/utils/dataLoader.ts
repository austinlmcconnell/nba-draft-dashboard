/**
 * Data Loading Utilities
 * Functions to load and cache prospect and historical data
 */

import type { CollegePlayer, HistoricalPlayer, DatasetStats } from '@/types/player';
import { buildDatasetStats } from './normalize';

// Cache for loaded data
let historicalDataCache: HistoricalPlayer[] | null = null;
let prospectDataCache: CollegePlayer[] | null = null;
let datasetStatsCache: DatasetStats | null = null;

/**
 * Load historical players with NBA careers
 * This data is used for comparisons
 */
export async function loadHistoricalData(): Promise<HistoricalPlayer[]> {
  if (historicalDataCache) {
    return historicalDataCache;
  }

  try {
    // In production, this loads from your generated JSON file
    // const data = await import('@/data/nba_career_stats.json');
    // historicalDataCache = data.default || data;
    
    // For now, return empty array until data is generated
    historicalDataCache = [];
    return historicalDataCache;
  } catch (error) {
    console.error('Error loading historical data:', error);
    return [];
  }
}

/**
 * Load current prospects (2024-25 season)
 * This is the data you'll collect separately
 */
export async function loadProspectData(): Promise<CollegePlayer[]> {
  if (prospectDataCache) {
    return prospectDataCache;
  }

  try {
    // In production, load from your current prospects file
    // const data = await import('@/data/current_prospects.json');
    // prospectDataCache = data.default || data;
    
    // For now, return empty array until data is collected
    prospectDataCache = [];
    return prospectDataCache;
  } catch (error) {
    console.error('Error loading prospect data:', error);
    return [];
  }
}

/**
 * Get or build dataset statistics for normalization
 * Should be called once and cached
 */
export async function getDatasetStats(): Promise<DatasetStats | null> {
  if (datasetStatsCache) {
    return datasetStatsCache;
  }

  const historicalData = await loadHistoricalData();
  
  if (historicalData.length === 0) {
    console.warn('No historical data available for normalization');
    return null;
  }

  // Extract college profiles for normalization
  const collegePlayers = historicalData.map(h => h.college_profile);
  datasetStatsCache = buildDatasetStats(collegePlayers);
  
  return datasetStatsCache;
}

/**
 * Find a specific prospect by ID
 */
export async function getProspectById(id: string): Promise<CollegePlayer | null> {
  const prospects = await loadProspectData();
  return prospects.find(p => p.id === id) || null;
}

/**
 * Get prospects filtered by position
 */
export async function getProspectsByPosition(position: string): Promise<CollegePlayer[]> {
  const prospects = await loadProspectData();
  return prospects.filter(p => p.position === position);
}

/**
 * Get prospects filtered by conference
 */
export async function getProspectsByConference(conference: string): Promise<CollegePlayer[]> {
  const prospects = await loadProspectData();
  return prospects.filter(p => p.conference === conference);
}

/**
 * Search prospects by name or school
 */
export async function searchProspects(query: string): Promise<CollegePlayer[]> {
  const prospects = await loadProspectData();
  const lowerQuery = query.toLowerCase();
  
  return prospects.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.team.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get unique conferences from prospect data
 */
export async function getConferences(): Promise<string[]> {
  const prospects = await loadProspectData();
  return [...new Set(prospects.map(p => p.conference))].sort();
}

/**
 * Get unique positions from prospect data
 */
export async function getPositions(): Promise<string[]> {
  const prospects = await loadProspectData();
  return [...new Set(prospects.map(p => p.position))].sort();
}

/**
 * Get stats summary for all prospects
 */
export async function getProspectStats(): Promise<{
  totalProspects: number;
  avgPoints: number;
  avgRebounds: number;
  avgAssists: number;
  topScorers: CollegePlayer[];
  topRebounders: CollegePlayer[];
  topPassers: CollegePlayer[];
}> {
  const prospects = await loadProspectData();

  if (prospects.length === 0) {
    return {
      totalProspects: 0,
      avgPoints: 0,
      avgRebounds: 0,
      avgAssists: 0,
      topScorers: [],
      topRebounders: [],
      topPassers: [],
    };
  }

  const avgPoints = prospects.reduce((sum, p) => sum + p.stats.points_per_game, 0) / prospects.length;
  const avgRebounds = prospects.reduce((sum, p) => sum + p.stats.rebounds_per_game, 0) / prospects.length;
  const avgAssists = prospects.reduce((sum, p) => sum + p.stats.assists_per_game, 0) / prospects.length;

  const topScorers = [...prospects]
    .sort((a, b) => b.stats.points_per_game - a.stats.points_per_game)
    .slice(0, 5);

  const topRebounders = [...prospects]
    .sort((a, b) => b.stats.rebounds_per_game - a.stats.rebounds_per_game)
    .slice(0, 5);

  const topPassers = [...prospects]
    .sort((a, b) => b.stats.assists_per_game - a.stats.assists_per_game)
    .slice(0, 5);

  return {
    totalProspects: prospects.length,
    avgPoints,
    avgRebounds,
    avgAssists,
    topScorers,
    topRebounders,
    topPassers,
  };
}

/**
 * Clear all caches (useful for development/testing)
 */
export function clearDataCache(): void {
  historicalDataCache = null;
  prospectDataCache = null;
  datasetStatsCache = null;
}

/**
 * Check if data files exist and are loaded
 */
export async function checkDataAvailability(): Promise<{
  hasHistoricalData: boolean;
  hasProspectData: boolean;
  historicalCount: number;
  prospectCount: number;
}> {
  const historical = await loadHistoricalData();
  const prospects = await loadProspectData();

  return {
    hasHistoricalData: historical.length > 0,
    hasProspectData: prospects.length > 0,
    historicalCount: historical.length,
    prospectCount: prospects.length,
  };
}
