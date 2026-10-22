# Chess Opening Traps

A desktop app for studying chess opening traps, built with Electron. All chess content is fetched exclusively from the [Lichess](https://lichess.org) public API — no other data source is used.

---

## Features

### Left sidebar — Opening navigator
- All traps are grouped by **opening family** (e.g. Italian Game, Sicilian Defense, Ruy López) derived from the Lichess PGN `[Opening]` tag
- Groups are sorted by trap count (largest first) and collapsed by default, giving a clean overview
- Click a group to **expand** it and **filter** the right panel to show only that opening's cards
- Click the same group again to collapse it and restore all cards
- Each trap entry inside a group shows a color icon (♔/♚) and a small ELO dot (green/amber/red)

### Right panel — Trap cards
- Displays trap cards matching the current sidebar selection and color filter
- Each card shows: trap name, ECO code, opening variation, color badge (♔ White / ♚ Black), and ELO level badge
- Shows a count of visible traps vs. total traps loaded

### Color filter bar
- Filter the panel and sidebar by **All**, **♔ White**, or **♚ Black** traps

### Board modal
- Click **View Trap** on any card (or a trap name in the sidebar) to open the interactive board
- Modal header shows: trap name · ECO code · color badge · ELO level badge
- **Navigate moves** with ◀ Prev / Next ▶ buttons or ← → arrow keys
- **Flip board** with the ⇅ button or press `F`
- Jump to any move by clicking it in the move list on the right
- The trap's key move is highlighted in gold in the move list
- Press `Esc` or click outside the board to close
- Rank (1–8) and file (a–h) legends are always visible

### ELO classification
Traps are classified into three levels using the Lichess Opening Explorer:

| Level | Rating brackets | Color |
|---|---|---|
| Novice | 1000 – 1400 | Green |
| Intermediate | 1400 – 1800 | Amber |
| Master | 2000 – 2500 | Red |

A trap qualifies for a level when its final position has ≥ 30 games in the Explorer bracket with ≥ 55% decisive result rate. If no bracket qualifies, the level is determined by move count (≤ 6 moves → Novice, ≤ 12 → Intermediate, > 12 → Master).

---

## Data source

All trap content is fetched from **Lichess study PGN** files and the **Lichess Opening Explorer**:

- Study PGN: `GET https://lichess.org/api/study/{studyId}.pgn`
- Opening Explorer: `GET https://explorer.lichess.org/lichess?play={uci}&ratings=...`

### Seed studies
The app ships with 12 curated Lichess study IDs covering beginner through advanced traps:

| Study | Focus |
|---|---|
| RpBT5lDV | Traps for Beginners |
| j2Th05zy | Beginner Traps |
| lcd07FLr | Beginner Traps 2 |
| kKWuX5ud | Opening Traps |
| tWUZgnpr | Opening Traps 2 |
| NJuVLTDr | Opening Traps 3 |
| kkwkTOK2 | Advanced Opening Traps |
| SsB3JhTu | Advanced Class on Opening Traps |
| 57N2pZKH | Open Sicilian Traps for Advanced Players |
| O6E5ouBO | Chess Traps |
| eIdEEVcs | Chess Traps 2 |
| qTK7ny4r | Weird Opening Traps You've Never Seen Before |

Study IDs can be edited in `data/seed-studies.json` to add or replace sources.

### Local cache
Fetched and classified traps are cached in `data/traps-cache.json` so the app loads instantly on subsequent launches. Click **↺ Refresh from Lichess** in the header to re-fetch everything from scratch.

---

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org) 18 or later
- npm

### Install dependencies
```bash
npm install
```

### Run the app
```bash
npm start
```

On first launch (or after a Refresh), the app fetches all studies from Lichess and classifies each trap via the Opening Explorer. This takes a few minutes. Progress is shown in the header status bar. Subsequent launches load from the local cache instantly.

---

## Project structure

```
ChessOpenings/
├── main.js            # Electron main process
├── launch.js          # Node launcher (strips ELECTRON_RUN_AS_NODE env var)
├── renderer.js        # UI logic — sidebar, cards, board modal, filters
├── lichess-api.js     # Lichess Study API + Opening Explorer + ELO classifier
├── pgn-parser.js      # Multi-chapter PGN parser → trap objects
├── index.html         # App shell
├── style.css          # Dark theme styles
├── data/
│   ├── seed-studies.json   # Lichess study IDs to fetch
│   └── traps-cache.json    # Auto-generated cache (gitignore recommended)
└── package.json
```

### Key modules

**`pgn-parser.js`** — Parses a Lichess study PGN (which may contain multiple chapters) into an array of trap objects. Each trap has: `name`, `eco`, `opening`, `color` (white/black), `moves` (SAN), `uciMoves`, `description`, `eloLevel`.

**`lichess-api.js`** — Fetches study PGNs and classifies each trap's ELO level by querying the Opening Explorer at three rating bracket groups.

**`renderer.js`** — All UI logic: sidebar opening groups, trap cards, board modal with move navigation, color filter, and cache management.

---

## Building a distributable

```bash
npm run dist
```

Produces a standalone Windows x64 executable in `dist/ChessOpenings-win32-x64/`.

---

## Keyboard shortcuts (board modal)

| Key | Action |
|---|---|
| `→` | Next move |
| `←` | Previous move |
| `Home` | Go to start position |
| `End` | Go to final position |
| `F` | Flip board |
| `Esc` | Close modal |
