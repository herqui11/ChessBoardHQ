// chess.js v0.13 is loaded as a global via <script> tag (window.Chess)

// ── State ──────────────────────────────────────────────────────────────────
let chess = new Chess();
let flipped = false;
let selectedSquare = null;
let legalMoveTargets = new Set();
let lastCoverage = {};
let whiteKingMoves = new Set();
let blackKingMoves = new Set();
let errorTimeout = null;
let pendingPromotion = null;

// ── Piece Unicode ──────────────────────────────────────────────────────────
const PIECE_UNICODE = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const FILES = 'abcdefgh';
const RANKS = '12345678';

// ── Square helpers ─────────────────────────────────────────────────────────
function getSquare(displayRow, displayCol) {
  const fileIndex = flipped ? (7 - displayCol) : displayCol;
  const rankIndex = flipped ? displayRow : (7 - displayRow);
  return FILES[fileIndex] + RANKS[rankIndex];
}

function isLightSquare(sq) {
  const f = FILES.indexOf(sq[0]);
  const r = RANKS.indexOf(sq[1]);
  return (f + r) % 2 !== 0;
}

function coordsToSquare(f, r) {
  if (f < 0 || f > 7 || r < 0 || r > 7) return null;
  return FILES[f] + RANKS[r];
}

// board[rankRow][fileCol] where rankRow 0 = rank 8, rankRow 7 = rank 1
function getPieceAt(fileIdx, rankIdx, board) {
  return board[7 - rankIdx][fileIdx]; // null or { type, color }
}

// ── Coverage (manual, works for both colors regardless of turn) ────────────
function getAttackSquares(type, color, fileIdx, rankIdx, board) {
  const sq = [];

  if (type === 'p') {
    const dir = color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const s = coordsToSquare(fileIdx + df, rankIdx + dir);
      if (s) sq.push(s);
    }
    return sq;
  }

  if (type === 'n') {
    for (const [df, dr] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const s = coordsToSquare(fileIdx + df, rankIdx + dr);
      if (s) sq.push(s);
    }
    return sq;
  }

  if (type === 'k') {
    for (const [df, dr] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const s = coordsToSquare(fileIdx + df, rankIdx + dr);
      if (s) sq.push(s);
    }
    return sq;
  }

  const rays = [];
  if (type === 'b' || type === 'q') rays.push([-1,-1],[-1,1],[1,-1],[1,1]);
  if (type === 'r' || type === 'q') rays.push([-1,0],[1,0],[0,-1],[0,1]);

  for (const [df, dr] of rays) {
    let f = fileIdx + df, r = rankIdx + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      sq.push(FILES[f] + RANKS[r]);
      if (getPieceAt(f, r, board)) break; // blocked by any piece
      f += df; r += dr;
    }
  }
  return sq;
}

function computeCoverage() {
  const board = chess.board();
  const cov = {};
  for (const f of FILES) for (const r of RANKS) cov[f + r] = { white: 0, black: 0 };

  for (let ri = 0; ri < 8; ri++) {
    for (let fi = 0; fi < 8; fi++) {
      const piece = board[ri][fi];
      if (!piece) continue;
      const fileIdx = fi;
      const rankIdx = 7 - ri;
      const attacks = getAttackSquares(piece.type, piece.color, fileIdx, rankIdx, board);
      for (const s of attacks) {
        if (piece.color === 'w') cov[s].white++;
        else cov[s].black++;
      }
    }
  }
  return cov;
}

// ── King escape squares ────────────────────────────────────────────────────
function computeKingMovesForColor(color) {
  const board = chess.board();
  let kingSq = null;
  outer: for (let ri = 0; ri < 8; ri++) {
    for (let fi = 0; fi < 8; fi++) {
      const p = board[ri][fi];
      if (p && p.type === 'k' && p.color === color) {
        kingSq = FILES[fi] + RANKS[7 - ri];
        break outer;
      }
    }
  }
  if (!kingSq) return new Set();

  if (chess.turn() === color) {
    return new Set(chess.moves({ square: kingSq, verbose: true }).map(m => m.to));
  }
  // Inactive side: swap turn in FEN to get its legal moves
  const parts = chess.fen().split(' ');
  parts[1] = color;
  parts[3] = '-'; // clear en passant (belongs to the other side)
  const tmp = new Chess(parts.join(' '));
  return new Set(tmp.moves({ square: kingSq, verbose: true }).map(m => m.to));
}

// ── Last move ──────────────────────────────────────────────────────────────
function getLastMove() {
  const history = chess.history({ verbose: true });
  return history.length > 0 ? history[history.length - 1] : null;
}

// ── Board render ──────────────────────────────────────────────────────────
function renderBoard(coverage) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';
  const lastMove = getLastMove();
  const inCheck = chess.in_check();
  let kingInCheckSquare = null;

  if (inCheck) {
    const boardState = chess.board();
    const kingColor = chess.turn();
    outer: for (let ri = 0; ri < 8; ri++) {
      for (let fi = 0; fi < 8; fi++) {
        const p = boardState[ri][fi];
        if (p && p.type === 'k' && p.color === kingColor) {
          kingInCheckSquare = FILES[fi] + RANKS[7 - ri];
          break outer;
        }
      }
    }
  }

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const sq = getSquare(row, col);
      const piece = chess.get(sq);
      const cov = coverage[sq] || { white: 0, black: 0 };

      const cell = document.createElement('div');
      cell.className = 'cell ' + (isLightSquare(sq) ? 'light' : 'dark');
      cell.dataset.square = sq;

      if (sq === selectedSquare) {
        cell.classList.add('selected');
      } else if (lastMove && (sq === lastMove.from || sq === lastMove.to)) {
        cell.classList.add(sq === lastMove.from ? 'last-move-from' : 'last-move-to');
      }

      if (sq === kingInCheckSquare) cell.classList.add('in-check');

      if (legalMoveTargets.has(sq)) {
        const occupant = chess.get(sq);
        cell.classList.add(occupant && occupant.color !== chess.turn() ? 'legal-capture' : 'legal-move');
      }

      if (cov.black > 0) {
        const span = document.createElement('span');
        span.className = 'attack-count black-attacks';
        span.textContent = cov.black;
        cell.appendChild(span);
      }

      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
        span.textContent = PIECE_UNICODE[piece.color + piece.type.toUpperCase()] || '?';
        cell.appendChild(span);
      }

      if (cov.white > 0) {
        const span = document.createElement('span');
        span.className = 'attack-count white-attacks';
        span.textContent = cov.white;
        cell.appendChild(span);
      }

      if (whiteKingMoves.has(sq)) {
        const span = document.createElement('span');
        span.className = 'king-escape king-escape-white';
        span.textContent = '♔';
        cell.appendChild(span);
      }
      if (blackKingMoves.has(sq)) {
        const span = document.createElement('span');
        span.className = 'king-escape king-escape-black';
        span.textContent = '♚';
        cell.appendChild(span);
      }

      if (col === 0) {
        const lbl = document.createElement('span');
        lbl.className = 'coord-rank';
        lbl.textContent = sq[1];
        cell.appendChild(lbl);
      }
      if (row === 7) {
        const lbl = document.createElement('span');
        lbl.className = 'coord-file';
        lbl.textContent = sq[0];
        cell.appendChild(lbl);
      }

      cell.addEventListener('click', () => handleCellClick(sq));
      boardEl.appendChild(cell);
    }
  }
}

// ── Click-to-move ──────────────────────────────────────────────────────────
function handleCellClick(sq) {
  if (pendingPromotion) return;
  const piece = chess.get(sq);

  if (!selectedSquare) {
    if (piece && piece.color === chess.turn()) {
      selectedSquare = sq;
      legalMoveTargets = new Set(chess.moves({ square: sq, verbose: true }).map(m => m.to));
      renderBoard(lastCoverage);
    }
    return;
  }

  if (sq === selectedSquare) {
    selectedSquare = null;
    legalMoveTargets = new Set();
    renderBoard(lastCoverage);
    return;
  }

  if (legalMoveTargets.has(sq)) {
    const promoMoves = chess.moves({ square: selectedSquare, verbose: true })
      .filter(m => m.to === sq && m.promotion);
    if (promoMoves.length > 0) {
      pendingPromotion = { from: selectedSquare, to: sq };
      showPromotionModal();
    } else {
      executeMove({ from: selectedSquare, to: sq });
    }
    return;
  }

  if (piece && piece.color === chess.turn()) {
    selectedSquare = sq;
    legalMoveTargets = new Set(chess.moves({ square: sq, verbose: true }).map(m => m.to));
    renderBoard(lastCoverage);
    return;
  }

  selectedSquare = null;
  legalMoveTargets = new Set();
  renderBoard(lastCoverage);
}

function executeMove(moveObj) {
  const result = chess.move(moveObj); // v0.x returns null on illegal move
  if (result) {
    selectedSquare = null;
    legalMoveTargets = new Set();
    update();
  } else {
    showError('Invalid move');
  }
}

// ── Promotion modal ────────────────────────────────────────────────────────
const PROMO_SYMBOLS = {
  wq: '♕', wr: '♖', wb: '♗', wn: '♘',
  bq: '♛', br: '♜', bb: '♝', bn: '♞',
};

function showPromotionModal() {
  const color = chess.turn();
  const modal = document.getElementById('promotion-modal');
  modal.querySelectorAll('.promo-btn').forEach(btn => {
    btn.textContent = PROMO_SYMBOLS[color + btn.dataset.piece] || '?';
  });
  modal.classList.remove('hidden');
}

function hidePromotionModal() {
  document.getElementById('promotion-modal').classList.add('hidden');
  pendingPromotion = null;
}

document.querySelectorAll('.promo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!pendingPromotion) return;
    executeMove({ ...pendingPromotion, promotion: btn.dataset.piece });
    hidePromotionModal();
  });
});

document.getElementById('promotion-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    hidePromotionModal();
    selectedSquare = null;
    legalMoveTargets = new Set();
    renderBoard(lastCoverage);
  }
});

// ── Text input ─────────────────────────────────────────────────────────────
function handleTextInput() {
  const input = document.getElementById('move-input');
  const raw = input.value.trim();
  if (!raw) return;

  let result = chess.move(raw); // try SAN

  if (!result) {
    const uci = raw.toLowerCase();
    if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
      result = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    }
  }

  if (result) {
    input.value = '';
    clearError();
    selectedSquare = null;
    legalMoveTargets = new Set();
    update();
  } else {
    showError('Illegal move: "' + raw + '"');
  }
}

document.getElementById('move-submit').addEventListener('click', handleTextInput);
document.getElementById('move-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleTextInput();
});

// ── Error display ──────────────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById('error-display');
  el.textContent = msg;
  if (errorTimeout) clearTimeout(errorTimeout);
  errorTimeout = setTimeout(clearError, 3000);
}

function clearError() {
  document.getElementById('error-display').textContent = '';
  errorTimeout = null;
}

// ── Status bar ─────────────────────────────────────────────────────────────
function updateStatus() {
  const el = document.getElementById('status');
  el.className = '';
  let text, cls;

  if (chess.in_checkmate()) {
    const winner = chess.turn() === 'w' ? 'Black' : 'White';
    text = 'Checkmate — ' + winner + ' wins!';
    cls = 'status-over';
  } else if (chess.in_stalemate()) {
    text = 'Stalemate — draw';
    cls = 'status-draw';
  } else if (chess.in_threefold_repetition()) {
    text = 'Threefold repetition — draw';
    cls = 'status-draw';
  } else if (chess.insufficient_material()) {
    text = 'Insufficient material — draw';
    cls = 'status-draw';
  } else if (chess.in_draw()) {
    text = 'Draw';
    cls = 'status-draw';
  } else if (chess.in_check()) {
    text = (chess.turn() === 'w' ? 'White' : 'Black') + ' is in check!';
    cls = 'status-check';
  } else {
    text = (chess.turn() === 'w' ? 'White' : 'Black') + ' to move';
    cls = 'status-normal';
  }

  el.textContent = text;
  el.classList.add(cls);
}

// ── Move history ───────────────────────────────────────────────────────────
function updateHistory() {
  const container = document.getElementById('move-history');
  container.innerHTML = '';
  const moves = chess.history();

  for (let i = 0; i < moves.length; i += 2) {
    const row = document.createElement('div');
    row.className = 'history-row';

    const num = document.createElement('span');
    num.className = 'history-num';
    num.textContent = (Math.floor(i / 2) + 1) + '.';

    const white = document.createElement('span');
    white.className = 'history-white';
    white.textContent = moves[i];

    row.appendChild(num);
    row.appendChild(white);

    if (moves[i + 1]) {
      const black = document.createElement('span');
      black.className = 'history-black';
      black.textContent = moves[i + 1];
      row.appendChild(black);
    }

    container.appendChild(row);
  }
  container.scrollTop = container.scrollHeight;
}

// ── Master update ──────────────────────────────────────────────────────────
function update() {
  lastCoverage = computeCoverage();
  whiteKingMoves = computeKingMovesForColor('w');
  blackKingMoves = computeKingMovesForColor('b');
  renderBoard(lastCoverage);
  updateStatus();
  updateHistory();
}

// ── Controls ───────────────────────────────────────────────────────────────
document.getElementById('undo-btn').addEventListener('click', () => {
  if (chess.undo()) {
    selectedSquare = null;
    legalMoveTargets = new Set();
    update();
  }
});

document.getElementById('flip-btn').addEventListener('click', () => {
  flipped = !flipped;
  renderBoard(lastCoverage);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  chess = new Chess();
  selectedSquare = null;
  legalMoveTargets = new Set();
  pendingPromotion = null;
  hidePromotionModal();
  clearError();
  update();
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target === document.getElementById('move-input')) return;
  if (e.key === 'Escape') {
    selectedSquare = null;
    legalMoveTargets = new Set();
    renderBoard(lastCoverage);
    hidePromotionModal();
  } else if (e.key === 'u' || e.key === 'U') {
    if (chess.undo()) { selectedSquare = null; legalMoveTargets = new Set(); update(); }
  } else if (e.key === 'f' || e.key === 'F') {
    flipped = !flipped;
    renderBoard(lastCoverage);
  }
});

// ── Init ───────────────────────────────────────────────────────────────────
update();
