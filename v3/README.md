# Pokémon Legends v3

v3 starts fresh. `docs/v3-foundations.md` is its only spec: nothing from v1 or v2 carries over unless it says so. v1 (the root) and v2 (`v2/`) stay as they are.

- **Play v3 (in development):** https://elibarrett11.github.io/Pok-monLegendsTCG/v3/
- Concept images: `docs/design/v3-concept-R1.jpg`, `-R2.jpg`, `-R6.jpg`.

## How it's built

Plain HTML, CSS and JavaScript modules: no build step, no npm dependencies, relative paths only. It runs on GitHub Pages at `…/Pok-monLegendsTCG/v3/`.

| Folder | Contents |
|---|---|
| `v3/src/rules.js` | Every number, in one place, to tune |
| `v3/src/engine/` | Rules and game state (`game.js`), the test cards (`cards.js`), the Locations (`locations.js`). **No DOM code.** |
| `v3/src/ai/` | The AI: it plays only through `applyAction` |
| `v3/src/ui/` | Drawing the match and handling clicks; coded icons |
| `v3/tests/` | `for t in v3/tests/*.test.js; do node $t; done` |
| `v3/tools/` | `node v3/tools/matches.js [n]` (AI-vs-AI report); `node v3/tools/layout.mjs` (the nothing-clipped check, run after every v3 step) |

- **Shared with the other versions:** only the art in the root `assets/`, by relative path.
- **Copied code (simple, noted in the files):**
  - `v3/src/engine/random.js` (the seeded random numbers from `src/engine/random.js`);
  - `v3/tools/layout.mjs` (v2's layout check, with v3's screens).
- **URL options:**
  - `?seed=123` replays the same match;
  - `?autoplay` lets the AI play both sides;
  - `?debug` exposes `window.__v3` for checks.
- **To play locally:** `python3 -m http.server` at the repository root, then open http://localhost:8000/v3/.

## Build log

- **V3-0 — the first playable v3.** You against a basic AI, with generic test cards.
  - **The board:**
    - 10 spaces per side, in two facing rows.
    - Pallet Town (2 lanes) starts on spaces 1–2.
    - Each player's portrait frames its space, with a Recognition medal.
    - The Trophy (the Pokémon League) waits on space 10.
    - Spaces with no Location are closed: nothing can be summoned there.
  - **The treadmill** (Elliott's ruling, recorded in `docs/v3-foundations.md`):
    - From Round 2, a new Location (1–3 lanes) arrives every Breakfast at the right end of the Locations.
    - The board grows until all 10 spaces are covered. From then on, each new Location pushes the others left by its width.
    - Locations falling off the left are removed, and their completion rewards are given then.
    - Pokémon and portraits never move.
    - **Six test Locations:**
      - Viridian Forest: each Move you play brings a Wild Bug onto your side there.
      - Pokémon Center: your Pokémon there heal fully at Supper.
      - Cerulean Cape, Mt. Ember, Lake of Rage and Floaroma Meadow.
      - Each has an objective that belongs to it, milestones (rewards at once) and a completion reward (given as it leaves).
  - **Recognition and the race:**
    - **Sources:** +2 at each Breakfast, +2 for defeating a Pokémon, and 1 per damage to the enemy player. Running out of cards gives the opponent 3, then 6, then 9….
    - **Portraits:** one space right per 10 Recognition, never past the furthest open space.
    - **The Trophy:** 100 Recognition reaches it and wins.
    - **The Regional Championship:** otherwise it arrives as the 10th Location over every space. At its end (2 Rounds) the higher Recognition is crowned Champion.
  - **Rounds:**
    - **Breakfast:** Energy = the Round number (cap 10), and draw 2. Round 1 is different: draw 6, then a mulligan whose cards shuffle back into the deck.
    - **Battle:** alternating turns, with Pass for +1 Energy.
    - **Supper:** no discard.
    - **Hand and deck:** 40-card decks, hand limit 10 (cards drawn beyond it are lost), and unused cards are kept.
  - **Overexert:** once per Round, take up to 2 Energy you don't have; at the next Breakfast you get that much less, plus 1. The Energy tile shows the +1 / +2 buttons and, once used, "Overexerted: −3 next Breakfast" in red.
  - **Pokémon:**
    - **Levels:** generic series with Levels 1–6. Off the board, a card's Level = the Round number up to its cap; it is frozen when played.
    - **Cost bands:** Light 0–5, Medium 1–6, Heavy 2–7.
    - **On the board:** one Pokémon per space, and each arrives Spent.
    - **Ready:** only Pokémon of the highest Speed among all Active Pokémon on both sides are Ready and can attack. They glow, gently animated, on both sides.
    - **Passing:** passing with an unmatched Speed makes your fastest Active Pokémon Spent.
    - **Trades:** a Ready target hits back.
    - **Guards:** Defence and Special Defence guards protect your other Pokémon in the same Location.
    - **Portrait protection:** your player character is protected only by your Pokémon on your portrait's space.
    - **Defeated** Pokémon go to the Released Pile.
  - **Cards** (`v3/src/engine/cards.js`, existing art as placeholders):
    - **10 Pokémon series**, covering Light, Medium and Heavy, every Speed-Tier, Physical and Special, and both guards: Swift Striker, Ember Pup, Sprout, Shell Guard, Mist Warden, River Runner, Storm Wing, Iron Brute, Flame Titan and Rock Hound.
    - **4 Moves** with breakpoints, each higher one better value: Quick Strike (damage), Patch Up (heal), Study (draw) and Show Off (Recognition).
    - **2 Supporters** with a Release cost and a Favour: Professor and Rival.
    - **The deck:** one 40-card test deck for both players.
  - **The look:** v2's approved look and the v3 concept images.
    - A prompt bar saying what you can do.
    - Location tiles with their midline panels: objective, both progress bars with milestone ticks, rewards. A "New" tag marks the newest.
    - Board Pokémon show their art, ⚔ Attack, the Speed-Tier icon (one, two or three chevrons) and ♥ Strength.
    - The side panel holds Round with a Championship countdown, the Energy tile with crystals and Overexert, Pass, both players' piles and the log.
    - Hand cards show cost, Level and cap, type line, text and stats.
    - All icons are coded.
  - **The AI** (`v3/src/ai/ai.js`): it tries each legal move one step ahead and plays the best, including Overexert when it pays for a play.
  - **Nothing clipped:** `node v3/tools/layout.mjs` reports `layout: ok` at 1920×1080, 1366×768 and 1280×720. It covers the mulligan, Round 1, a mid-match board, a full hand, choosing a space, choosing an attack target, a Move's breakpoints and its target, a Supporter's Release, the Overexerted Energy tile, the Championship and the end screen.
  - **Tests** (`v3/tests`):
    - `setup.test.js`: v3 stands alone (imports only from v3, no DOM code in the engine, relative paths, art present, coded icons).
    - `rules.test.js` covers:
      - setup and the mulligan;
      - the treadmill (widths, filling, shifting, removal with completion rewards, Pokémon staying put);
      - closed spaces;
      - Recognition and portrait movement, and winning at 100;
      - the Regional Championship, including a tie;
      - Energy and Overexert;
      - the hand limit and deck-out;
      - Levels and cost bands;
      - Ready, guards, portrait protection, trades and passing with unmatched Speed;
      - Supporters and Favour.
    - `ai.test.js`: every AI move is legal, and 40 AI-vs-AI matches finish.
    - v1 and v2 are untouched: no file outside `v3/` changed except the new section in `docs/v3-foundations.md`.
  - **AI-vs-AI report** (`node v3/tools/matches.js 100`):
    - All 100 matches finish, averaging **10.19 Rounds** (Round 8: 1, Round 9: 14, Round 10: 50, Round 11: 35).
    - **How they end:**
      - the Trophy before the Championship: 15;
      - the Trophy during the Championship: 74;
      - crowned at the Championship's end: 11;
      - draws: 0.
    - The player with initiative in Round 1 won 53, the other 47.
    - Per match: an average final Recognition of 87, 95 actions, 12 Overexerts and no deck-outs.
  - **Placeholders to confirm with Elliott:** listed in `docs/v3-foundations.md` ("Settled 4 Nov (V3-0)").
  - **Screenshots** (`v3/screenshots/`): `v3-0-round1.jpg`, `v3-0-round2.jpg`, `v3-0-board.jpg` (Round 6), `v3-0-attack.jpg`, `v3-0-overexerted.jpg`, `v3-0-championship.jpg`, `v3-0-game-over.jpg`.
