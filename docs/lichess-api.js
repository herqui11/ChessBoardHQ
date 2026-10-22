import { parseStudyPGN } from './pgn-parser.js';

const STUDY_BASE    = 'https://lichess.org/api/study';
const EXPLORER_BASE = 'https://explorer.lichess.org/lichess';
const SPEEDS        = 'blitz,rapid,classical';
const MIN_GAMES     = 30;
const WIN_THRESHOLD = 0.55;
const API_DELAY_MS  = 350;

const BRACKET_GROUPS = [
  { name: 'novice',       ratings: [1000, 1200, 1400] },
  { name: 'intermediate', ratings: [1400, 1600, 1800] },
  { name: 'master',       ratings: [2000, 2200, 2500] },
];

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchStudyPGN(studyId) {
  const url = `${STUDY_BASE}/${studyId}.pgn`;
  const response = await fetch(url, {
    headers: {
      Accept: 'text/plain',
      'User-Agent': 'ChessOpenings/1.0',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function fetchExplorer(play, ratings) {
  const ratingParams = ratings.map(r => `ratings=${r}`).join('&');
  const url = `${EXPLORER_BASE}?play=${encodeURIComponent(play)}&${ratingParams}&speeds=${SPEEDS}&moves=0`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ChessOpenings/1.0' },
    });
    if (!response.ok) return { white: 0, draws: 0, black: 0 };
    const data = await response.json();
    return {
      white: data.white || 0,
      draws: data.draws || 0,
      black: data.black || 0,
    };
  } catch {
    return { white: 0, draws: 0, black: 0 };
  }
}

async function classifyEloLevel(uciMoves) {
  if (!uciMoves || uciMoves.length === 0) return 'intermediate';

  const play = uciMoves.join(',');
  const qualifying = [];

  for (const group of BRACKET_GROUPS) {
    await delay(API_DELAY_MS);
    const data = await fetchExplorer(play, group.ratings);
    const total = data.white + data.draws + data.black;
    if (total < MIN_GAMES) continue;

    const maxRate = Math.max(data.white / total, data.black / total);
    if (maxRate >= WIN_THRESHOLD) {
      qualifying.push({ name: group.name, total });
    }
  }

  if (qualifying.length > 0) {
    qualifying.sort((a, b) => b.total - a.total);
    return qualifying[0].name;
  }

  // Fallback: classify by move count when Explorer data is insufficient
  const n = uciMoves.length;
  if (n <= 6)  return 'novice';
  if (n <= 12) return 'intermediate';
  return 'master';
}

export async function fetchAndProcessStudies(studyIds, onProgress) {
  const allTraps = [];

  for (const studyId of studyIds) {
    try {
      const pgnText = await fetchStudyPGN(studyId);
      const chapters = parseStudyPGN(pgnText, studyId);

      for (const trap of chapters) {
        trap.eloLevel = await classifyEloLevel(trap.uciMoves);
        allTraps.push(trap);
        if (onProgress) onProgress({ loaded: allTraps.length, trap });
      }
    } catch (err) {
      console.warn(`Study ${studyId} failed:`, err.message);
    }
  }

  return allTraps;
}
