# Cell Board Analysis

An interactive chess board that gives you an x-ray view of the entire position at a glance: every square shows how many pieces of each color can attack it, and the legal escape squares for both kings are always highlighted. Built as a learning tool for chess novices.

Open `index.html` in Chrome or Edge — no install, no server, no build step required.

---

## Features

- **Full chess rules** — castling, en passant, pawn promotion, check, checkmate, stalemate, draws (fifty-move rule, threefold repetition, insufficient material)
- **Click-to-move** — click a piece to select it (green highlight), then click a destination square; dots show empty targets, rings show captures
- **Text input** — type a move in Standard Algebraic Notation (`e4`, `Nf3`, `O-O`) or UCI format (`e2e4`) and press Enter
- **Coverage overlay** — every cell always shows:
  - Upper-left corner (red): how many **black** pieces can attack that square
  - Upper-right corner (blue): how many **white** pieces can attack that square
  - Counts of zero are hidden to keep the board clean
- **King escape indicators** — always visible for both kings:
  - Golden **♔** at top-center: squares the white king can legally move to
  - Purple **♚** at top-center: squares the black king can legally move to
- **Undo** any number of moves, all the way back to the starting position
- **Flip board** — switch between White's and Black's perspective
- **Reset** — return to the starting position
- Move history, status bar (whose turn, check/checkmate/draw), last-move highlight, red glow on the king when in check

---

## How to open

Double-click `index.html`. It opens directly in Chrome or Edge from the file system — no web server needed.

---

## Controls

| Action | How |
|---|---|
| Select a piece | Click it |
| Move the selected piece | Click the destination square |
| Enter a move by notation | Type in the input box + press Enter (or click **Move**) |
| Undo last move | Click **⟵ Undo** or press `U` |
| Flip the board | Click **⇅ Flip** or press `F` |
| Deselect a piece | Click the same piece again, or press `Escape` |
| Reset to start | Click **↺ Reset** |

---

## Reading the board

Each cell can show up to four overlays simultaneously:

```
┌─────────────────┐
│ [black]  [white]│   ← attack counts (upper corners)
│    [♔ or ♚]     │   ← king escape crown (top-center)
│                 │
│      piece      │   ← the piece itself (center)
│                 │
└─────────────────┘
```

- **Red number, upper-left** — count of black pieces that attack this square (includes pinned pieces)
- **Blue number, upper-right** — count of white pieces that attack this square (includes pinned pieces)
- **Golden ♔, top-center** — the white king can legally move here
- **Purple ♚, top-center** — the black king can legally move here

A square with a high red count and a low blue count is dominated by Black. A square showing no king escape crown is not a legal king destination. These overlays update instantly after every move or undo.

---

## Files

```
CellBoardAnalysis/
├── index.html      Page structure and controls
├── style.css       Visual styles (board, overlays, panel, modal)
├── app.js          All game logic
└── chess.min.js    chess.js v0.10.3 (local copy, no CDN needed)
```

---

## How this app was built

This app was created entirely through conversation with [Claude Code](https://claude.ai/code) (Anthropic's AI coding assistant) in a single session. No code was written by hand — every file was produced by describing what was needed in plain language.

Below are the exact prompts used, in order.

---

### Prompt 1 — Initial specification

```
# Spec: Cell Board Analysis
## Summary
I´m learning to play Chess, so I´m Chess novice. I would like to have an interactive board,
the moves are to be entry manually, the app is going to calculate for each cell in the board,
accordingly with the chess rules of the movements of the pieces, how many pieces, upper left
corner for black, upper right corner for white, have access to each cell, so all the time I
will have an x-ray view of how many white and black pieces have access to each cell.

## Requirements
### Requirement 1:
**User story**: As a Chess novice, I want to have an interactive board so that:
- I can entry the moves and they will be reflected in the board
- I can undo until the beginning of the match
- I can flip the board
- The app will validate that the move is valid, if not, will show an error without crash the app

#### Acceptance Criteria
1. GIVEN Chess match WHEN user entry the moves THEN board will reflect the moves in the board
2. GIVEN any Chess position WHEN user press undo button THEN the last move will be deleted
   and reflected on the board
3. GIVEN any not legal move, WHEN user entry them, THEN the app will validate it

### Requirement 2:
**User story**: As a Chess novice, I want to have visibility of how many pieces, black and white,
have access to each cell in the board so that give me a whole idea of the reach of every piece
on every cell
#### Acceptance Criteria
1. GIVEN the initial setup of the board, before the match start WHEN the match hasn´t start yet
   THEN the app calculates how many pieces, black and white, have access to each cell, showing
   the counts, the black pieces in the upper left corner and whites upper right corner of each cell
2. GIVEN any position, WHEN user enter a move and the move is reflected in the board THEN the app
   calculates how many pieces, black and white, have access to each cell, showing the counts, the
   black pieces in the upper left corner and whites upper right corner of each cell

## Out of Scope
It´s out of the scope any engine to suggest chess moves, to analyze any chess position, to predict
the best move

## Technical Notes
the app should follow the Chess rules for the movement of the pieces
```

---

### Prompt 2 — Piece colors

> It´s beautiful! could you improve the color of the pieces, so it will be clearly distinguish which ones are whites and blacks?

*Result: white pieces rendered as ivory with a dark outline; black pieces as near-black with a faint light outline.*

---

### Prompt 3 — King escape squares (active player)

> Now I would like to see all the time, which cells are available for the king to runaway, mark the cel with a small crown in the middle up of the cell, same size than the numbers in the corners

*Result: a small golden ♔ crown added at the top-center of each cell the active king can legally reach.*

---

### Prompt 4 — King escape squares (both kings)

> the crowns should be shown all the time there are cells to escape for both white and black kings

*Result: golden ♔ for white king escapes and purple ♚ for black king escapes, both shown simultaneously regardless of whose turn it is.*

---

### Prompt 5 — This document

> Document the app in a readme.md, include the prompts to create it

---

## Technical notes

- **No frameworks, no build tools** — plain HTML, CSS, and JavaScript
- **chess.js v0.10.3** handles all chess rules: legal move generation, move validation, castling, en passant, promotion, check/checkmate/draw detection
- **Coverage calculation** is implemented manually in `app.js`: for every piece on the board, its attack squares are computed according to its movement rules (rays for sliding pieces, fixed patterns for knights/pawns/king), then tallied per square — for both colors, independent of whose turn it is
- **Inactive king escape squares** are computed by creating a temporary Chess instance with the FEN turn indicator swapped, so the inactive king's legal moves can be queried without modifying the real game state
- The app is loaded entirely from the local file system; `chess.min.js` is saved locally (not fetched from a CDN) so it works by double-clicking `index.html` without any internet connection or web server
