import { fetchAndProcessStudies } from './lichess-api.js';
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0/dist/esm/chess.js';

const CACHE_VERSION = 2;
const CACHE_KEY     = 'chess-openings-cache';

// ── Unicode pieces ───────────────────────────────────────────────
const PIECE_UNICODE = {
  wp: '♙', wn: '♘', wb: '♗', wr: '♖', wq: '♕', wk: '♔',
  bp: '♟', bn: '♞', bb: '♝', br: '♜', bq: '♛', bk: '♚',
};

// ── App state ────────────────────────────────────────────────────
let state = {
  traps: [],
  filters: { color: 'all' },
  expandedGroups: new Set(),
  selectedGroup: null,
};

let boardState = {
  trap:         null,
  positions:    [],
  currentIndex: 0,
  flipped:      false,
};

// ── Cache helpers ────────────────────────────────────────────────
function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== CACHE_VERSION) return null;
    return Array.isArray(data.traps) && data.traps.length > 0 ? data.traps : null;
  } catch { return null; }
}

function saveCache(traps) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION, fetchedAt: new Date().toISOString(), traps
    }));
  } catch {}
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

// ── Loading state ────────────────────────────────────────────────
function setLoading(active, text = '') {
  document.getElementById('spinner').classList.toggle('hidden', !active);
  document.getElementById('status-text').textContent = text;
  document.getElementById('refresh-btn').disabled = active;
}

// ── Trap loading from Lichess ────────────────────────────────────
async function loadFromLichess() {
  setLoading(true, 'Connecting to Lichess…');
  state.traps = [];
  renderCards();
  renderSidebar();

  try {
    const seed = await fetch('./data/seed-studies.json').then(r => r.json());
    const ids  = seed.studies.map(s => s.id);

    const traps = await fetchAndProcessStudies(ids, ({ loaded, trap }) => {
      state.traps.push(trap);
      setLoading(true, `Loaded ${loaded} trap${loaded !== 1 ? 's' : ''}…`);
      renderCards();
      renderSidebar();
    });

    state.traps = traps;
    saveCache(state.traps);
    setLoading(false, `${state.traps.length} traps ready`);
  } catch (err) {
    setLoading(false, `Error: ${err.message}`);
  }

  renderCards();
  renderSidebar();
}

// ── Filters ──────────────────────────────────────────────────────
function applyFilters(traps) {
  return traps.filter(t => {
    if (state.filters.color !== 'all' && t.color !== state.filters.color) return false;
    if (state.selectedGroup !== null && openingFamily(t) !== state.selectedGroup) return false;
    return true;
  });
}

// ── HTML helpers ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Opening family helper ─────────────────────────────────────────
function openingFamily(trap) {
  if (trap.opening) {
    const colon = trap.opening.indexOf(':');
    return colon > 0 ? trap.opening.slice(0, colon).trim() : trap.opening.trim();
  }
  const letter = trap.eco && trap.eco[0];
  if (letter === 'A') return 'Flank & Irregular';
  if (letter === 'B') return '1.e4 (Sicilian & Others)';
  if (letter === 'C') return '1.e4 e5 & French';
  if (letter === 'D') return '1.d4 d5';
  if (letter === 'E') return 'Indian Defenses';
  return 'Other';
}

// ── Sidebar rendering ─────────────────────────────────────────────
function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';

  const visible = state.traps.filter(t =>
    state.filters.color === 'all' || t.color === state.filters.color
  );

  const groupMap = new Map();
  for (const trap of visible) {
    const key = openingFamily(trap);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(trap);
  }

  const groups = [...groupMap.entries()].sort((a, b) => {
    if (a[0] === 'Other') return 1;
    if (b[0] === 'Other') return -1;
    return b[1].length - a[1].length;
  });

  for (const [family, traps] of groups) {
    const isExpanded = state.expandedGroups.has(family);
    const isSelected = state.selectedGroup === family;

    const header = document.createElement('button');
    header.className = 'sg-header'
      + (isExpanded ? ' sg-open' : '')
      + (isSelected ? ' sg-selected' : '');
    header.innerHTML = `
      <span class="sg-arrow">${isExpanded ? '▼' : '▶'}</span>
      <span class="sg-name">${escapeHtml(family)}</span>
      <span class="sg-count">${traps.length}</span>`;
    header.addEventListener('click', () => {
      if (state.selectedGroup === family) {
        state.selectedGroup = null;
        state.expandedGroups.delete(family);
      } else {
        if (state.selectedGroup !== null) state.expandedGroups.delete(state.selectedGroup);
        state.selectedGroup = family;
        state.expandedGroups.add(family);
      }
      renderSidebar();
      renderCards();
    });
    sidebar.appendChild(header);

    if (isExpanded) {
      for (const trap of traps) {
        const icon = trap.color === 'black' ? '♚' : '♔';
        const lvl  = trap.eloLevel || 'intermediate';
        const btn  = document.createElement('button');
        btn.className = 'sg-trap-btn';
        btn.innerHTML = `
          <span class="stb-icon">${icon}</span>
          <span class="stb-name">${escapeHtml(trap.name || 'Trap')}</span>
          <span class="stb-level stb-level-${lvl}"></span>`;
        btn.addEventListener('click', () => openTrapModal(trap));
        sidebar.appendChild(btn);
      }
    }
  }

  if (groups.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sidebar-empty';
    empty.textContent = state.traps.length === 0 ? 'Loading…' : 'No traps match filter';
    sidebar.appendChild(empty);
  }
}

// ── Card rendering ────────────────────────────────────────────────
function renderTrapCard(trap) {
  const div   = document.createElement('div');
  const color = trap.color || 'white';
  const level = trap.eloLevel || 'intermediate';
  div.className = `trap-card trap-card-${color}`;

  const colorIcon  = color === 'black' ? '♚' : '♔';
  const colorLabel = color === 'black' ? 'Black' : 'White';
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  div.innerHTML = `
    <div class="card-header">
      <span class="trap-name">${escapeHtml(trap.name || 'Unknown Trap')}</span>
      ${trap.eco ? `<span class="eco-badge">${escapeHtml(trap.eco)}</span>` : ''}
    </div>
    ${trap.opening ? `<div class="card-opening">${escapeHtml(trap.opening)}</div>` : ''}
    <div class="card-badges">
      <span class="color-badge color-badge-${color}">${colorIcon} ${colorLabel}</span>
      <span class="level-badge level-badge-${level}">${levelLabel}</span>
    </div>
    <button class="view-btn">View Trap</button>`;

  div.querySelector('.view-btn').addEventListener('click', () => openTrapModal(trap));
  return div;
}

function renderCards() {
  const panel      = document.getElementById('panel');
  const countLabel = document.getElementById('trap-count-label');
  const filtered   = applyFilters(state.traps);

  panel.innerHTML = '';

  if (state.traps.length === 0) {
    panel.innerHTML = '<div class="empty-state">Fetching traps from Lichess…</div>';
  } else if (filtered.length === 0) {
    panel.innerHTML = '<div class="empty-state">No traps match the current filters.</div>';
  } else {
    const grid = document.createElement('div');
    grid.className = 'trap-grid';
    for (const trap of filtered) grid.appendChild(renderTrapCard(trap));
    panel.appendChild(grid);
  }

  countLabel.textContent = `Showing ${filtered.length} of ${state.traps.length} traps`;
}

// ── Board modal ───────────────────────────────────────────────────
function openTrapModal(trap) {
  const chess     = new Chess();
  const positions = [{ fen: chess.fen(), from: null, to: null, san: null }];

  for (const san of (trap.moves || [])) {
    try {
      const move = chess.move(san);
      positions.push({ fen: chess.fen(), from: move.from, to: move.to, san: move.san });
    } catch { break; }
  }

  boardState = { trap, positions, currentIndex: 0, flipped: false };

  document.getElementById('modal-trap-name').textContent   = trap.name || 'Trap';
  document.getElementById('modal-eco').textContent         = trap.eco || '';
  document.getElementById('modal-description').textContent = trap.description || '';
  document.getElementById('btn-flip').classList.remove('active');

  const color = trap.color || 'white';
  const level = trap.eloLevel || 'intermediate';
  const colorIcon  = color === 'black' ? '♚' : '♔';
  const colorLabel = color === 'black' ? 'Black' : 'White';

  const colorEl = document.getElementById('modal-color');
  colorEl.className   = `color-badge color-badge-${color}`;
  colorEl.textContent = `${colorIcon} ${colorLabel}`;

  const levelEl = document.getElementById('modal-level');
  levelEl.className   = `level-badge level-badge-${level}`;
  levelEl.textContent = level.charAt(0).toUpperCase() + level.slice(1);

  renderMoveList();
  goToPosition(0);
  document.getElementById('board-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('board-modal').classList.add('hidden');
}

// ── Move list ─────────────────────────────────────────────────────
function renderMoveList() {
  const { trap, positions } = boardState;
  const container = document.getElementById('move-list');
  container.innerHTML = '';

  const startEl = document.createElement('span');
  startEl.className = 'move-entry move-start';
  startEl.textContent = 'Start';
  startEl.dataset.index = '0';
  startEl.addEventListener('click', () => goToPosition(0));
  container.appendChild(startEl);

  container.appendChild(document.createElement('br'));

  for (let i = 1; i < positions.length; i++) {
    const { san } = positions[i];
    const isWhite = i % 2 === 1;
    const moveNum = Math.ceil(i / 2);
    const isTrap  = (i - 1) === trap.trapMoveIndex;

    if (isWhite) {
      const numEl = document.createElement('span');
      numEl.className = 'move-number';
      numEl.textContent = `${moveNum}.`;
      container.appendChild(numEl);
    }

    const moveEl = document.createElement('span');
    moveEl.className = 'move-san' + (isTrap ? ' move-trap' : '');
    moveEl.dataset.index = String(i);
    moveEl.textContent = san;
    moveEl.addEventListener('click', () => goToPosition(i));
    container.appendChild(moveEl);
  }
}

function updateMoveHighlight(index) {
  document.getElementById('move-list').querySelectorAll('[data-index]').forEach(el => {
    el.classList.toggle('move-active', Number(el.dataset.index) === index);
  });
  const active = document.getElementById('move-list').querySelector('.move-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function updateNavControls() {
  const { positions, currentIndex } = boardState;
  document.getElementById('btn-prev').disabled = currentIndex === 0;
  document.getElementById('btn-next').disabled = currentIndex === positions.length - 1;
  document.getElementById('move-counter').textContent =
    currentIndex === 0 ? 'Start' : `${currentIndex} / ${positions.length - 1}`;
}

function goToPosition(index) {
  const { positions } = boardState;
  index = Math.max(0, Math.min(index, positions.length - 1));
  boardState.currentIndex = index;

  const { fen, from, to } = positions[index];
  const chess = new Chess();
  chess.load(fen);
  renderBoard(chess.board(), from, to, boardState.flipped);
  updateMoveHighlight(index);
  updateNavControls();
}

// ── Board rendering ───────────────────────────────────────────────
function renderBoard(board2d, from, to, flipped) {
  const container = document.getElementById('chess-board');
  container.innerHTML = '';

  for (let dr = 0; dr < 9; dr++) {
    for (let dc = 0; dc < 9; dc++) {
      const cell = document.createElement('div');

      if (dr === 8 && dc === 0) {
        cell.className = 'board-corner';
        container.appendChild(cell);
        continue;
      }

      if (dc === 0) {
        cell.className = 'board-rank-label';
        cell.textContent = String(flipped ? (dr + 1) : (8 - dr));
        container.appendChild(cell);
        continue;
      }

      if (dr === 8) {
        const fi = flipped ? (8 - dc) : (dc - 1);
        cell.className = 'board-file-label';
        cell.textContent = 'abcdefgh'[fi];
        container.appendChild(cell);
        continue;
      }

      const boardRow = flipped ? (7 - dr) : dr;
      const boardCol = flipped ? (8 - dc) : (dc - 1);
      const piece    = board2d[boardRow][boardCol];
      const rankNum  = 8 - boardRow;
      const fileChar = 'abcdefgh'[boardCol];
      const sqName   = fileChar + rankNum;
      const isLight  = (boardCol + rankNum - 1) % 2 !== 0;

      cell.className = `board-square ${isLight ? 'sq-light' : 'sq-dark'}`;
      if (sqName === from) cell.classList.add('sq-from');
      if (sqName === to)   cell.classList.add('sq-to');

      if (piece) {
        cell.textContent = PIECE_UNICODE[piece.color + piece.type] || '';
        cell.classList.add(piece.color === 'w' ? 'piece-white' : 'piece-black');
      }

      container.appendChild(cell);
    }
  }
}

// ── Event wiring & init ──────────────────────────────────────────
function init() {
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.dataset.filter;
      const value  = pill.dataset.value;
      state.filters[filter] = value;
      document.querySelectorAll(`.filter-pill[data-filter="${filter}"]`).forEach(p =>
        p.classList.toggle('active', p.dataset.value === value)
      );
      renderCards();
      renderSidebar();
    });
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    clearCache();
    state.traps = [];
    loadFromLichess();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('board-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  document.getElementById('btn-prev').addEventListener('click', () =>
    goToPosition(boardState.currentIndex - 1)
  );
  document.getElementById('btn-next').addEventListener('click', () =>
    goToPosition(boardState.currentIndex + 1)
  );

  document.getElementById('btn-flip').addEventListener('click', () => {
    boardState.flipped = !boardState.flipped;
    document.getElementById('btn-flip').classList.toggle('active', boardState.flipped);
    goToPosition(boardState.currentIndex);
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('board-modal').classList.contains('hidden')) return;
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); goToPosition(boardState.currentIndex + 1); break;
      case 'ArrowLeft':  e.preventDefault(); goToPosition(boardState.currentIndex - 1); break;
      case 'Home':       e.preventDefault(); goToPosition(0); break;
      case 'End':        e.preventDefault(); goToPosition(boardState.positions.length - 1); break;
      case 'f': case 'F':
        boardState.flipped = !boardState.flipped;
        document.getElementById('btn-flip').classList.toggle('active', boardState.flipped);
        goToPosition(boardState.currentIndex);
        break;
      case 'Escape': closeModal(); break;
    }
  });

  const cached = loadCache();
  if (cached) {
    state.traps = cached;
    renderCards();
    renderSidebar();
    setLoading(false, `${state.traps.length} traps loaded`);
  } else {
    loadFromLichess();
  }
}

document.addEventListener('DOMContentLoaded', init);
