// NBA team metadata — ESPN team IDs + brand colors
// Logo URL: https://a.espncdn.com/i/teamlogos/nba/500/{espnId}.png

export interface NBATeam {
  espnId: number;
  primary: string;   // hex without #
  secondary: string; // hex without #
  city: string;
  name: string;
}

// Keys: lowercase team names (how they appear in Austin's sheet)
export const NBA_TEAMS: Record<string, NBATeam> = {
  'hawks':          { espnId: 1,  primary: 'C1D32F', secondary: 'E03A3E', city: 'Atlanta',       name: 'Hawks'          },
  'celtics':        { espnId: 2,  primary: '007A33', secondary: 'BA9653', city: 'Boston',         name: 'Celtics'        },
  'nets':           { espnId: 17, primary: '000000', secondary: 'FFFFFF', city: 'Brooklyn',       name: 'Nets'           },
  'hornets':        { espnId: 30, primary: '1D1160', secondary: '00788C', city: 'Charlotte',      name: 'Hornets'        },
  'bulls':          { espnId: 4,  primary: 'CE1141', secondary: '000000', city: 'Chicago',        name: 'Bulls'          },
  'cavaliers':      { espnId: 5,  primary: '860038', secondary: 'FDBB30', city: 'Cleveland',      name: 'Cavaliers'      },
  'mavericks':      { espnId: 6,  primary: '00538C', secondary: 'B8C4CA', city: 'Dallas',         name: 'Mavericks'      },
  'nuggets':        { espnId: 7,  primary: '0E2240', secondary: 'FEC524', city: 'Denver',         name: 'Nuggets'        },
  'pistons':        { espnId: 8,  primary: 'C8102E', secondary: '006BB6', city: 'Detroit',        name: 'Pistons'        },
  'warriors':       { espnId: 9,  primary: '1D428A', secondary: 'FFC72C', city: 'Golden State',   name: 'Warriors'       },
  'rockets':        { espnId: 10, primary: 'CE1141', secondary: '000000', city: 'Houston',        name: 'Rockets'        },
  'pacers':         { espnId: 11, primary: '002D62', secondary: 'FDBB30', city: 'Indiana',        name: 'Pacers'         },
  'clippers':       { espnId: 12, primary: 'C8102E', secondary: '1D428A', city: 'LA',             name: 'Clippers'       },
  'lakers':         { espnId: 13, primary: '552583', secondary: 'FDB927', city: 'Los Angeles',    name: 'Lakers'         },
  'grizzlies':      { espnId: 29, primary: '5D76A9', secondary: '12173F', city: 'Memphis',        name: 'Grizzlies'      },
  'heat':           { espnId: 14, primary: '98002E', secondary: 'F9A01B', city: 'Miami',          name: 'Heat'           },
  'bucks':          { espnId: 15, primary: '00471B', secondary: 'EEE1C6', city: 'Milwaukee',      name: 'Bucks'          },
  'timberwolves':   { espnId: 16, primary: '0C2340', secondary: '236192', city: 'Minnesota',      name: 'Timberwolves'   },
  'pelicans':       { espnId: 3,  primary: '0C2340', secondary: 'C8102E', city: 'New Orleans',    name: 'Pelicans'       },
  'knicks':         { espnId: 18, primary: '006BB6', secondary: 'F58426', city: 'New York',       name: 'Knicks'         },
  'thunder':        { espnId: 25, primary: '007AC1', secondary: 'EF3B24', city: 'Oklahoma City',  name: 'Thunder'        },
  'magic':          { espnId: 19, primary: '0077C0', secondary: 'C4CED4', city: 'Orlando',        name: 'Magic'          },
  '76ers':          { espnId: 20, primary: '006BB6', secondary: 'ED174C', city: 'Philadelphia',   name: '76ers'          },
  'suns':           { espnId: 21, primary: '1D1160', secondary: 'E56020', city: 'Phoenix',        name: 'Suns'           },
  'trail blazers':  { espnId: 22, primary: 'E03A3E', secondary: '000000', city: 'Portland',       name: 'Trail Blazers'  },
  'kings':          { espnId: 23, primary: '5A2D81', secondary: '63727A', city: 'Sacramento',     name: 'Kings'          },
  'spurs':          { espnId: 24, primary: 'C4CED4', secondary: '000000', city: 'San Antonio',    name: 'Spurs'          },
  'raptors':        { espnId: 28, primary: 'CE1141', secondary: '000000', city: 'Toronto',        name: 'Raptors'        },
  'jazz':           { espnId: 26, primary: '002B5C', secondary: '00471B', city: 'Utah',           name: 'Jazz'           },
  'wizards':        { espnId: 27, primary: '002B5C', secondary: 'E31837', city: 'Washington',     name: 'Wizards'        },
};

// Flexible lookup — handles partial names like "Mavericks", "Dallas Mavericks", "DAL"
export function findNBATeam(input: string): NBATeam | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();

  // Direct key match
  if (NBA_TEAMS[normalized]) return NBA_TEAMS[normalized];

  // Search for any team where name or city matches
  for (const team of Object.values(NBA_TEAMS)) {
    if (
      normalized === team.name.toLowerCase() ||
      normalized === team.city.toLowerCase() ||
      normalized === `${team.city.toLowerCase()} ${team.name.toLowerCase()}` ||
      normalized.endsWith(team.name.toLowerCase())
    ) {
      return team;
    }
  }

  return null;
}

export function nbaLogoUrl(espnId: number): string {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${espnId}.png`;
}
