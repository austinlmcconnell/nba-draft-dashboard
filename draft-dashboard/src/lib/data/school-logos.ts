// NCAA school → ESPN team ID mapping for logo images.
// Logo URL: https://a.espncdn.com/i/teamlogos/ncaa/500/{espnTeamId}.png
// Expanded from the static table in ComparisonCard.tsx

export interface SchoolInfo {
  espnTeamId: number;
  primary: string;   // hex without #
  secondary: string; // hex without #
  abbreviation: string;
}

export const SCHOOL_LOGOS: Record<string, SchoolInfo> = {
  // ── Power conferences ──────────────────────────────────────────────────────
  'Alabama':            { espnTeamId: 333,  primary: '9E1B32', secondary: '828A8F', abbreviation: 'ALA'  },
  'Arizona':            { espnTeamId: 12,   primary: '003366', secondary: 'CC0033', abbreviation: 'ARIZ' },
  'Arizona State':      { espnTeamId: 9,    primary: '8C1D40', secondary: 'FFC627', abbreviation: 'ASU'  },
  'Arkansas':           { espnTeamId: 8,    primary: '9D2235', secondary: '000000', abbreviation: 'ARK'  },
  'Auburn':             { espnTeamId: 2,    primary: '0C2340', secondary: 'E87722', abbreviation: 'AUB'  },
  'Baylor':             { espnTeamId: 239,  primary: '003015', secondary: 'FFBE00', abbreviation: 'BAY'  },
  'BYU':                { espnTeamId: 252,  primary: '002E5D', secondary: 'FFFFFF', abbreviation: 'BYU'  },
  'Cincinnati':         { espnTeamId: 2132, primary: 'E00122', secondary: '000000', abbreviation: 'CIN'  },
  'Clemson':            { espnTeamId: 228,  primary: 'F56600', secondary: '522D80', abbreviation: 'CLEM' },
  'Colorado':           { espnTeamId: 38,   primary: 'CFB87C', secondary: '000000', abbreviation: 'COL'  },
  'Connecticut':        { espnTeamId: 41,   primary: '000E2F', secondary: 'E4002B', abbreviation: 'UCONN'},
  'Creighton':          { espnTeamId: 156,  primary: '005CA9', secondary: 'FFFFFF', abbreviation: 'CRE'  },
  'Duke':               { espnTeamId: 150,  primary: '001A57', secondary: 'FFFFFF', abbreviation: 'DUKE' },
  'Florida':            { espnTeamId: 57,   primary: '0021A5', secondary: 'FA4616', abbreviation: 'FLA'  },
  'Florida State':      { espnTeamId: 52,   primary: '782F40', secondary: 'CEB888', abbreviation: 'FSU'  },
  'Georgetown':         { espnTeamId: 46,   primary: '041E42', secondary: '8D817B', abbreviation: 'GU'   },
  'Georgia':            { espnTeamId: 61,   primary: 'BA0C2F', secondary: '000000', abbreviation: 'UGA'  },
  'Gonzaga':            { espnTeamId: 2250, primary: '002469', secondary: 'CC0000', abbreviation: 'GONZ' },
  'Houston':            { espnTeamId: 248,  primary: 'C8102E', secondary: '757474', abbreviation: 'HOU'  },
  'Illinois':           { espnTeamId: 356,  primary: 'E84A27', secondary: '13294B', abbreviation: 'ILL'  },
  'Indiana':            { espnTeamId: 84,   primary: '990000', secondary: 'FFFFFF', abbreviation: 'IND'  },
  'Iowa':               { espnTeamId: 2294, primary: 'FFCD00', secondary: '000000', abbreviation: 'IOWA' },
  'Iowa State':         { espnTeamId: 66,   primary: '862633', secondary: 'F1BE48', abbreviation: 'ISU'  },
  'Kansas':             { espnTeamId: 2305, primary: '0051A5', secondary: 'E8000D', abbreviation: 'KAN'  },
  'Kansas State':       { espnTeamId: 2306, primary: '512888', secondary: 'FFFFFF', abbreviation: 'KSU'  },
  'Kentucky':           { espnTeamId: 96,   primary: '0033A0', secondary: 'FFFFFF', abbreviation: 'UK'   },
  'Louisville':         { espnTeamId: 97,   primary: 'AD0000', secondary: '000000', abbreviation: 'LOU'  },
  'LSU':                { espnTeamId: 99,   primary: '461D7C', secondary: 'FDD023', abbreviation: 'LSU'  },
  'Maryland':           { espnTeamId: 120,  primary: 'E03A3E', secondary: 'FFD200', abbreviation: 'MD'   },
  'Memphis':            { espnTeamId: 235,  primary: '003087', secondary: '898D8D', abbreviation: 'MEM'  },
  'Michigan':           { espnTeamId: 130,  primary: '00274C', secondary: 'FFCB05', abbreviation: 'MICH' },
  'Michigan State':     { espnTeamId: 127,  primary: '18453B', secondary: 'FFFFFF', abbreviation: 'MSU'  },
  'Minnesota':          { espnTeamId: 135,  primary: '7A0019', secondary: 'FFCC33', abbreviation: 'MINN' },
  'Mississippi':        { espnTeamId: 145,  primary: 'CE1126', secondary: '14213D', abbreviation: 'MISS' },
  'Missouri':           { espnTeamId: 142,  primary: 'F1B82D', secondary: '000000', abbreviation: 'MIZ'  },
  'Nebraska':           { espnTeamId: 158,  primary: 'E41C38', secondary: 'FFFFFF', abbreviation: 'NEB'  },
  'North Carolina':     { espnTeamId: 153,  primary: '7BAFD4', secondary: 'FFFFFF', abbreviation: 'UNC'  },
  'NC State':           { espnTeamId: 152,  primary: 'CC0000', secondary: 'FFFFFF', abbreviation: 'NCST' },
  'Notre Dame':         { espnTeamId: 87,   primary: 'AE9142', secondary: '0C2340', abbreviation: 'ND'   },
  'Ohio State':         { espnTeamId: 194,  primary: 'BB0000', secondary: '666666', abbreviation: 'OSU'  },
  'Oklahoma':           { espnTeamId: 201,  primary: '841617', secondary: 'FDF9D8', abbreviation: 'OU'   },
  'Oklahoma State':     { espnTeamId: 197,  primary: 'FF6600', secondary: '000000', abbreviation: 'OKST' },
  'Oregon':             { espnTeamId: 2483, primary: '154733', secondary: 'FEE123', abbreviation: 'ORE'  },
  'Penn State':         { espnTeamId: 213,  primary: '1E407C', secondary: 'FFFFFF', abbreviation: 'PSU'  },
  'Purdue':             { espnTeamId: 2509, primary: 'CEB888', secondary: '000000', abbreviation: 'PUR'  },
  'Rutgers':            { espnTeamId: 164,  primary: 'CC0033', secondary: '5F6A72', abbreviation: 'RUT'  },
  'St. John\'s':        { espnTeamId: 2599, primary: 'CC0000', secondary: '000000', abbreviation: 'SJU'  },
  'South Carolina':     { espnTeamId: 2579, primary: '73000A', secondary: '000000', abbreviation: 'SC'   },
  'Tennessee':          { espnTeamId: 2633, primary: 'FF8200', secondary: 'FFFFFF', abbreviation: 'TENN' },
  'Texas':              { espnTeamId: 251,  primary: 'BF5700', secondary: 'FFFFFF', abbreviation: 'TEX'  },
  'Texas A&M':          { espnTeamId: 245,  primary: '500000', secondary: 'FFFFFF', abbreviation: 'TAMU' },
  'Texas Tech':         { espnTeamId: 2641, primary: 'CC0000', secondary: '000000', abbreviation: 'TTU'  },
  'UCLA':               { espnTeamId: 26,   primary: '2D68C4', secondary: 'F2A900', abbreviation: 'UCLA' },
  'USC':                { espnTeamId: 30,   primary: '990000', secondary: 'FFC72C', abbreviation: 'USC'  },
  'Utah':               { espnTeamId: 254,  primary: 'CC0000', secondary: '000000', abbreviation: 'UTAH' },
  'Vanderbilt':         { espnTeamId: 238,  primary: '866D4B', secondary: '000000', abbreviation: 'VAN'  },
  'Villanova':          { espnTeamId: 222,  primary: '00205B', secondary: '009BDE', abbreviation: 'NOVA' },
  'Virginia':           { espnTeamId: 258,  primary: '232D4B', secondary: 'F84C1E', abbreviation: 'UVA'  },
  'Virginia Tech':      { espnTeamId: 259,  primary: '75112B', secondary: 'E5751F', abbreviation: 'VT'   },
  'Wake Forest':        { espnTeamId: 154,  primary: '9E7E38', secondary: '000000', abbreviation: 'WF'   },
  'Washington':         { espnTeamId: 264,  primary: '4B2E83', secondary: 'B7A57A', abbreviation: 'UW'   },
  'West Virginia':      { espnTeamId: 277,  primary: '002855', secondary: 'EAAA00', abbreviation: 'WVU'  },
  'Wisconsin':          { espnTeamId: 275,  primary: 'C5050C', secondary: 'FFFFFF', abbreviation: 'WIS'  },

  // ── Mid-majors ────────────────────────────────────────────────────────────
  'Belmont':            { espnTeamId: 2051, primary: 'BC0000', secondary: '1C1B1B', abbreviation: 'BEL'  },
  'Butler':             { espnTeamId: 2086, primary: '13294B', secondary: '747C81', abbreviation: 'BUT'  },
  'Colorado State':     { espnTeamId: 36,   primary: '1E4D2B', secondary: 'C8C372', abbreviation: 'CSU'  },
  'Dayton':             { espnTeamId: 2196, primary: 'CF102D', secondary: '00234F', abbreviation: 'DAY'  },
  'Drake':              { espnTeamId: 2181, primary: '004B8D', secondary: 'FFFFFF', abbreviation: 'DRA'  },
  'Illinois State':     { espnTeamId: 2200, primary: 'CC0000', secondary: '000000', abbreviation: 'ILST' },
  'Murray State':       { espnTeamId: 93,   primary: '002144', secondary: 'B08D57', abbreviation: 'MUR'  },
  'San Diego State':    { espnTeamId: 21,   primary: '0D1C3C', secondary: 'C41230', abbreviation: 'SDSU' },
  'Saint Joseph\'s':    { espnTeamId: 2603, primary: '9E1B32', secondary: '8C8883', abbreviation: 'SJU'  },
  'Wichita State':      { espnTeamId: 2724, primary: '000000', secondary: 'FFCD00', abbreviation: 'WSU'  },
  'Xavier':             { espnTeamId: 2752, primary: '0A2B6E', secondary: '979FA2', abbreviation: 'XAV'  },

  // ── International (fallback — country flag would be ideal) ─────────────────
  'France':             { espnTeamId: 0, primary: '002395', secondary: 'ED2939', abbreviation: 'FRA'  },
  'Australia':          { espnTeamId: 0, primary: '00008B', secondary: 'FF0000', abbreviation: 'AUS'  },
  'Spain':              { espnTeamId: 0, primary: 'AA151B', secondary: 'F1BF00', abbreviation: 'ESP'  },
  'Canada':             { espnTeamId: 0, primary: 'FF0000', secondary: 'FFFFFF', abbreviation: 'CAN'  },
  'Serbia':             { espnTeamId: 0, primary: 'C6363C', secondary: '0C4076', abbreviation: 'SRB'  },
  'Germany':            { espnTeamId: 0, primary: '000000', secondary: 'DD0000', abbreviation: 'GER'  },
  'Italy':              { espnTeamId: 0, primary: '009246', secondary: 'CE2B37', abbreviation: 'ITA'  },
  'Nigeria':            { espnTeamId: 0, primary: '008751', secondary: 'FFFFFF', abbreviation: 'NIG'  },
  'Turkey':             { espnTeamId: 0, primary: 'E30A17', secondary: 'FFFFFF', abbreviation: 'TUR'  },
  'Lithuania':          { espnTeamId: 0, primary: '006A44', secondary: 'FDB913', abbreviation: 'LTU'  },
  'Senegal':            { espnTeamId: 0, primary: '00853F', secondary: 'FDEF42', abbreviation: 'SEN'  },
  'Georgia (Country)':  { espnTeamId: 0, primary: 'FFFFFF', secondary: 'FF0000', abbreviation: 'GEO'  },
  'Slovenia':           { espnTeamId: 0, primary: '003DA5', secondary: 'FF0000', abbreviation: 'SLO'  },
  'Bosnia':             { espnTeamId: 0, primary: '002395', secondary: 'FCDD09', abbreviation: 'BIH'  },
  'Denmark':            { espnTeamId: 0, primary: 'C60C30', secondary: 'FFFFFF', abbreviation: 'DEN'  },
  'Latvia':             { espnTeamId: 0, primary: '9E3039', secondary: 'FFFFFF', abbreviation: 'LAT'  },
};

export function findSchool(name: string): SchoolInfo | null {
  if (!name) return null;
  // Exact match
  if (SCHOOL_LOGOS[name]) return SCHOOL_LOGOS[name];
  // Case-insensitive
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(SCHOOL_LOGOS)) {
    if (key.toLowerCase() === lower) return val;
  }
  return null;
}

export function schoolLogoUrl(espnTeamId: number): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnTeamId}.png`;
}

export function collegeHeadshotUrl(espnAthleteId: number): string {
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${espnAthleteId}.png`;
}
