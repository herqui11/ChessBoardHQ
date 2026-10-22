'use strict';

const { Chess } = require('chess.js');

function parseStudyPGN(pgnText, studyId) {
  const chunks = pgnText.split(/\n(?=\[Event\b)/);
  const traps = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const trap = parseChapter(chunk.trim(), studyId);
    if (trap) traps.push(trap);
  }
  return traps;
}

function parseChapter(chunkText, studyId) {
  const blankIdx = chunkText.indexOf('\n\n');
  const headerText = blankIdx >= 0 ? chunkText.slice(0, blankIdx) : chunkText;
  const movesText  = blankIdx >= 0 ? chunkText.slice(blankIdx + 2) : '';

  const headers = extractHeaders(headerText);

  if (headers.setup === '1') return null;
  if (headers.variant && headers.variant !== 'Standard') return null;

  const chapterId   = extractChapterId(headers.site || '');
  const name        = extractChapterName(headers.event || '');
  const eco         = headers.eco || '';
  const opening     = headers.opening || '';
  const description = extractDescription(movesText);
  const sanMoves    = cleanMoves(movesText);

  if (sanMoves.length < 3) return null;

  const uciMoves = sanToUci(sanMoves);
  if (uciMoves.length < 3) return null;

  return {
    id:           slugify(name) || slugify(studyId + '-' + chapterId),
    name,
    eco,
    opening,
    color:         detectColor(sanMoves),
    eloLevel:      'intermediate',
    moves:         sanMoves,
    uciMoves,
    trapMoveIndex: sanMoves.length - 1,
    description,
    studyId,
    chapterId,
  };
}

function extractHeaders(headerText) {
  const result = {};
  const re = /\[(\w+)\s+"([^"]*)"\]/g;
  let m;
  while ((m = re.exec(headerText)) !== null) {
    result[m[1].toLowerCase()] = m[2];
  }
  return result;
}

function extractChapterId(siteUrl) {
  const m = siteUrl.match(/lichess\.org\/study\/[^/]+\/([^/\s#]+)/);
  return m ? m[1] : '';
}

function extractChapterName(eventString) {
  const idx = eventString.lastIndexOf(': ');
  return idx >= 0 ? eventString.slice(idx + 2).trim() : eventString.trim();
}

function removeVariations(text) {
  let result = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') { depth++; continue; }
    if (ch === ')') { depth--; continue; }
    if (depth === 0) result += ch;
  }
  return result;
}

function cleanMoves(movesText) {
  let text = removeVariations(movesText);
  text = text.replace(/\{[^}]*\}/gs, ' ');
  text = text.replace(/\$\d+/g, ' ');
  text = text.replace(/[!?]+/g, '');
  const tokens = text.split(/\s+/);
  return tokens.filter(t =>
    t &&
    !/^\d+\.{1,3}$/.test(t) &&
    !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)
  );
}

function sanToUci(sanMoves) {
  const chess = new Chess();
  const uci = [];
  for (const san of sanMoves) {
    try {
      const move = chess.move(san);
      uci.push(move.from + move.to + (move.promotion || ''));
    } catch {
      break;
    }
  }
  return uci;
}

function detectColor(sanMoves) {
  return sanMoves.length % 2 === 1 ? 'white' : 'black';
}

function extractDescription(movesText) {
  const re = /\{([^}]*)\}/gs;
  let m;
  while ((m = re.exec(movesText)) !== null) {
    const text = m[1].trim();
    if (!text.startsWith('[%')) return text;
  }
  return '';
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

module.exports = { parseStudyPGN };
